import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getSurveyDefinition,
  getSurveyVersion,
  buildSurveyPrompt
} from "./survey-metadata.js";
import { parseSurveyResponse } from "./analysis/parser.js";
import { analyzeResponses } from "./analysis/analyzer.js";
import { calculateAxisVector } from "./analysis/scoring.js";
import {
  buildPrescriptionReport,
  buildSubmissionPayload
} from "./analysis/report.js";
import {
  initializePage,
  renderResults,
  setLoadingState,
  showStatusMessage,
  bindResultActions
} from "./analysis/renderer.js";

const surveyDefinition = getSurveyDefinition();
const surveyVersion = getSurveyVersion();

const elements = {
  startBtn: document.getElementById("startBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  surveySection: document.getElementById("surveySection"),
  analysisForm: document.getElementById("analysisForm"),
  submitButton: document.getElementById("submitBtn"),
  statusMessage: document.getElementById("statusMessage"),
  providerNameInput: document.getElementById("providerName"),
  modelNameInput: document.getElementById("modelName"),
  analystLabelInput: document.getElementById("analystLabel"),
  surveyVersionInput: document.getElementById("surveyVersionInput"),
  rawResponseInput: document.getElementById("rawResponse"),
  resultsSection: document.getElementById("resultsSection"),
  surveyVersionLabel: document.getElementById("surveyVersionLabel"),
  completenessLabel: document.getElementById("completenessLabel"),
  reportMeta: document.getElementById("reportMeta"),
  diagnosticNotes: document.getElementById("diagnosticNotes"),
  recommendedUsage: document.getElementById("recommendedUsage"),
  behavioralWarnings: document.getElementById("behavioralWarnings"),
  axisScores: document.getElementById("axisScores"),
  summaryText: document.getElementById("summaryText"),
  parseSummary: document.getElementById("parseSummary"),
  metadataSummary: document.getElementById("metadataSummary"),
  questionAnalysisList: document.getElementById("questionAnalysisList"),
  insightSort: document.getElementById("insightSort"),
  insightToggle: document.getElementById("insightToggle"),
  copyReportBtn: document.getElementById("copyReportBtn")
};

let latestRenderedPayload = null;

initializePage(elements, surveyVersion);
bindResultActions(elements, {
  getPayload: () => latestRenderedPayload,
  onSortChange: (sortMode) => {
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, { sortMode });
    }
  },
  onToggleInsights: () => {
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, {
        showAllInsights: !latestRenderedPayload.uiState.showAllInsights
      });
    }
  },
  onCopyReport: async () => {
    if (!latestRenderedPayload) {
      return;
    }

    const reportText = buildCopyableReport(latestRenderedPayload);
    await navigator.clipboard.writeText(reportText);
    showStatusMessage(elements.statusMessage, "리포트 요약을 복사했습니다.");
  }
});

elements.startBtn.addEventListener("click", () => {
  elements.surveySection.scrollIntoView({ behavior: "smooth" });
});

elements.downloadBtn.addEventListener("click", () => {
  const content = buildSurveyPrompt(surveyVersion);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ai-behavior-survey-${surveyVersion}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

elements.analysisForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoadingState(elements, true, "응답을 파싱하고 분석 중입니다...");

  const providerName = elements.providerNameInput.value.trim();
  const modelName = elements.modelNameInput.value.trim();
  const analystLabel = elements.analystLabelInput.value.trim();
  const rawResponse = elements.rawResponseInput.value.trim();

  try {
    const parsed = parseSurveyResponse(rawResponse, surveyDefinition);
    const analyzedResponses = analyzeResponses(parsed.answersByQuestion, surveyDefinition);
    const axisScores = calculateAxisVector(analyzedResponses, surveyDefinition.axes);
    const report = buildPrescriptionReport({
      axisScores,
      surveyVersion,
      rawResponse,
      modelName
    });

    const payload = buildSubmissionPayload({
      providerName,
      modelName,
      analystLabel,
      surveyVersion,
      rawResponse,
      surveyDefinition,
      parsed,
      analyzedResponses,
      axisScores,
      report
    });

    latestRenderedPayload = {
      ...payload,
      uiState: {
        sortMode: "question-order",
        showAllInsights: false
      }
    };

    renderResults(elements, latestRenderedPayload);
    setLoadingState(elements, true, "분석 결과를 저장 중입니다...");

    const docRef = await addDoc(collection(db, "surveyResponses"), {
      ...payload,
      createdAt: serverTimestamp()
    });

    latestRenderedPayload = {
      ...latestRenderedPayload,
      firestore: {
        collection: "surveyResponses",
        documentId: docRef.id
      }
    };

    renderResults(elements, latestRenderedPayload);
    showStatusMessage(elements.statusMessage, "분석과 저장이 완료되었습니다.");
  } catch (error) {
    console.error("Submission pipeline error:", error);
    showStatusMessage(elements.statusMessage, `제출 중 오류 발생: ${error.message}`);
  } finally {
    setLoadingState(elements, false);
  }
});

function buildCopyableReport(payload) {
  const vectorLines = Object.entries(payload.axisScores)
    .map(([axis, score]) => `${axis}: ${score}`)
    .join("\n");
  const usageLines = payload.report.recommendedUsage.map((item) => `- ${item}`).join("\n");
  const warningLines = payload.report.behavioralWarnings.length
    ? payload.report.behavioralWarnings.map((item) => `- ${item}`).join("\n")
    : "- 뚜렷한 취약 축이 감지되지 않았습니다.";

  return [
    payload.report.reportHeader.reportType,
    `Survey Version: ${payload.surveyVersion}`,
    `Analysis ID: ${payload.report.reportHeader.analysisId}`,
    "",
    vectorLines,
    "",
    `진단 소견: ${payload.report.diagnosticSummary}`,
    "",
    "Recommended Usage",
    usageLines,
    "",
    "Behavioral Warnings",
    warningLines
  ].join("\n");
}
