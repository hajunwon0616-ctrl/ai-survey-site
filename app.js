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
let currentLocale = "ko";

const elements = {
  startBtn: document.getElementById("startBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  langKoBtn: document.getElementById("langKoBtn"),
  langEnBtn: document.getElementById("langEnBtn"),
  shortcutLinks: document.querySelectorAll(".shortcut-link"),
  surveySection: document.getElementById("surveySection"),
  analysisForm: document.getElementById("analysisForm"),
  submitButton: document.getElementById("submitBtn"),
  statusMessage: document.getElementById("statusMessage"),
  providerNameInput: document.getElementById("providerName"),
  modelNameInput: document.getElementById("modelName"),
  testLabelInput: document.getElementById("testLabel"),
  surveyVersionInput: document.getElementById("surveyVersionInput"),
  rawResponseInput: document.getElementById("rawResponse"),
  resultsSection: document.getElementById("resultsSection"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingMessage: document.getElementById("loadingMessage"),
  reportBackdrop: document.getElementById("reportBackdrop"),
  closeReportBtn: document.getElementById("closeReportBtn"),
  surveyVersionLabel: document.getElementById("surveyVersionLabel"),
  completenessLabel: document.getElementById("completenessLabel"),
  reportMeta: document.getElementById("reportMeta"),
  diagnosticNotes: document.getElementById("diagnosticNotes"),
  recommendedUsage: document.getElementById("recommendedUsage"),
  behavioralWarnings: document.getElementById("behavioralWarnings"),
  axisScores: document.getElementById("axisScores"),
  axisTableBody: document.getElementById("axisTableBody"),
  strongAxes: document.getElementById("strongAxes"),
  weakAxes: document.getElementById("weakAxes"),
  summaryText: document.getElementById("summaryText"),
  parseSummary: document.getElementById("parseSummary"),
  metadataSummary: document.getElementById("metadataSummary"),
  questionAnalysisList: document.getElementById("questionAnalysisList"),
  insightSort: document.getElementById("insightSort"),
  copyReportBtn: document.getElementById("copyReportBtn"),
  downloadReportBtn: document.getElementById("downloadReportBtn")
};

const PROVIDER_MODELS = {
  ChatGPT: ["GPT-5", "GPT-4o", "GPT-4o mini", "GPT-4.1", "GPT-4.1 mini"],
  Claude: ["Claude Opus", "Claude Sonnet", "Claude Haiku"],
  Gemini: ["Gemini 2.0 Ultra", "Gemini 2.0 Pro", "Gemini 1.5 Pro"]
};

const UI_COPY = {
  ko: {
    heroBadge: "Behavioral Profile Analysis",
    heroTitle: "AI 행동 성향 분석 시스템",
    heroDescription: "질문을 직접 답하는 설문이 아니라, AI가 작성한 전체 응답을 붙여넣어 행동 벡터를 분석하는 도구입니다.",
    startBtn: "분석 시작하기",
    downloadBtn: "질문지 다운로드",
    shortcutTitle: "AI 바로가기",
    shortcutDescription: "질문지를 받은 뒤 바로 원하는 AI 창으로 이동할 수 있습니다.",
    shortcutChatGPT: "ChatGPT 열기",
    shortcutGemini: "Gemini 열기",
    shortcutClaude: "Claude 열기",
    processTitle: "사용자 흐름",
    processKicker: "Download -> Prompt -> Paste -> Analyze",
    processStep1Title: "1. 질문지 다운로드",
    processStep1Desc: "버전이 포함된 질문 세트를 내려받아 AI에 그대로 입력합니다.",
    processStep2Title: "2. AI 응답 수집",
    processStep2Desc: "AI가 작성한 전체 답변을 형식 그대로 복사합니다.",
    processStep3Title: "3. 응답 붙여넣기",
    processStep3Desc: "제출 화면에 전체 텍스트를 넣고 분석을 실행합니다.",
    processStep4Title: "4. 행동 벡터 생성",
    processStep4Desc: "파싱, 축별 분석, 요약 생성 후 Firestore에 저장합니다.",
    surveySectionTitle: "AI 응답 제출",
    surveyDescription: "AI의 전체 응답 텍스트를 붙여넣으세요. 형식은 Q1: 부터 Q60:, 그리고 마지막의 [END OF SURVEY]를 포함해야 합니다.",
    providerNameLabel: "AI 서비스명",
    providerPlaceholder: "서비스 선택",
    modelNameLabel: "모델명",
    modelPlaceholder: "먼저 AI 서비스를 선택하세요",
    testLabelLabel: "테스트 라벨",
    testLabelPlaceholder: "예: GPT 비교 테스트, 3월 실험",
    surveyVersionInputLabel: "질문 세트 버전",
    rawResponseLabel: "AI 전체 답변",
    rawResponsePlaceholder: "Q1:\n...\n\nQ1-1:\n...\n\n...\n\n[END OF SURVEY]",
    hintParseTitle: "파싱 기준",
    hintParseDesc: "Q번호: 헤더를 기준으로 질문별 답변을 분리합니다.",
    hintVersionTitle: "버전 관리",
    hintVersionDesc: "응답은 현재 질문 세트 버전과 함께 저장됩니다.",
    hintStorageTitle: "저장 구조",
    hintStorageDesc: "질문, 축, 제약, 분석 태그, 점수가 함께 Firestore에 기록됩니다.",
    loadingTitle: "응답을 분석 중입니다",
    loadingEyebrow: "AI Behavior Analysis",
    reportLabel: "AI Behavior Analysis",
    reportTitle: "AI 행동 분석 리포트",
    reportSubtitle: "AI 행동 프로파일과 사용 전략을 한 화면에서 확인하는 결과 리포트입니다.",
    reportOverviewTitle: "AI Behavior Report",
    diagnosticTitle: "Diagnostic Summary",
    diagnosticKicker: "Strengths vs Weaknesses",
    strengthsTitle: "Strengths",
    weaknessesTitle: "Weaknesses",
    vectorScoresTitle: "Vector Scores",
    vectorScoresKicker: "9 Axes",
    axisTableTitle: "Axis Score Table",
    axisTableKicker: "Interpretation",
    axisTableHeadAxis: "Axis",
    axisTableHeadScore: "Score",
    axisTableHeadInterpretation: "Interpretation",
    axisTableHeadStatus: "Status",
    recommendedUsageTitle: "Recommended Usage",
    recommendedUsageKicker: "Prompt Strategy",
    behavioralWarningsTitle: "Behavioral Warnings",
    behavioralWarningsKicker: "Watchouts",
    parseSummaryTitle: "파싱 요약",
    parseSummaryKicker: "Parsing Summary",
    metadataTitle: "질문 세트 메타데이터",
    metadataKicker: "Metadata",
    questionInsightsTitle: "Question Insights",
    questionInsightsCopy: "질문별 전략 태그와 점수를 빠르게 훑어볼 수 있습니다.",
    sortQuestionOrder: "질문 순서",
    sortHighest: "점수 높은 순",
    sortLowest: "점수 낮은 순",
    copyReportBtn: "리포트 복사",
    downloadReportBtn: "리포트 다운로드",
    closeReportBtn: "닫기",
    loadingParsing: "질문별 응답을 파싱하는 중",
    loadingAnalyzing: "질문별 행동 특성을 분석하는 중",
    loadingScoring: "행동 벡터를 계산하는 중",
    loadingReporting: "리포트를 생성하는 중",
    loadingSaving: "분석 결과를 저장 중입니다...",
    savedStatus: "분석과 저장이 완료되었습니다.",
    copyDone: "리포트 요약을 복사했습니다.",
    downloadDone: "리포트 파일을 다운로드했습니다."
  },
  en: {
    heroBadge: "Behavioral Profile Analysis",
    heroTitle: "AI Behavioral Analysis System",
    heroDescription: "This is not a survey where users answer questions directly. It analyzes a full response generated by an AI and turns it into a behavioral vector.",
    startBtn: "Start Analysis",
    downloadBtn: "Download Survey",
    shortcutTitle: "AI Shortcuts",
    shortcutDescription: "After downloading the survey, jump directly to the AI service you want to test.",
    shortcutChatGPT: "Open ChatGPT",
    shortcutGemini: "Open Gemini",
    shortcutClaude: "Open Claude",
    processTitle: "Workflow",
    processKicker: "Download -> Prompt -> Paste -> Analyze",
    processStep1Title: "1. Download Survey",
    processStep1Desc: "Download the versioned question set and paste it into the AI as-is.",
    processStep2Title: "2. Collect Response",
    processStep2Desc: "Copy the AI's full answer exactly as it was produced.",
    processStep3Title: "3. Paste Response",
    processStep3Desc: "Paste the full text into the submission form and run the analysis.",
    processStep4Title: "4. Generate Vector",
    processStep4Desc: "The site parses, scores, summarizes, and stores the result in Firestore.",
    surveySectionTitle: "Submit AI Response",
    surveyDescription: "Paste the AI's full response text. It should include Q1: through Q60: and the final [END OF SURVEY] line.",
    providerNameLabel: "AI Provider",
    providerPlaceholder: "Select a provider",
    modelNameLabel: "Model",
    modelPlaceholder: "Select a provider first",
    testLabelLabel: "Test Label",
    testLabelPlaceholder: "Example: GPT comparison test, March run",
    surveyVersionInputLabel: "Survey Version",
    rawResponseLabel: "Full AI Response",
    rawResponsePlaceholder: "Q1:\n...\n\nQ1-1:\n...\n\n...\n\n[END OF SURVEY]",
    hintParseTitle: "Parsing Rule",
    hintParseDesc: "Responses are split by Q-number headers such as Q1: and Q1-1:.",
    hintVersionTitle: "Versioning",
    hintVersionDesc: "Each submission is stored with the active survey version.",
    hintStorageTitle: "Storage Shape",
    hintStorageDesc: "Questions, axes, constraints, analysis tags, and scores are stored together in Firestore.",
    loadingTitle: "Analyzing the response",
    loadingEyebrow: "AI Behavior Analysis",
    reportLabel: "AI Behavior Analysis",
    reportTitle: "AI Behavior Report",
    reportSubtitle: "A report window that summarizes the AI's behavioral profile and usage strategy in one place.",
    reportOverviewTitle: "AI Behavior Report",
    diagnosticTitle: "Diagnostic Summary",
    diagnosticKicker: "Strengths vs Weaknesses",
    strengthsTitle: "Strengths",
    weaknessesTitle: "Weaknesses",
    vectorScoresTitle: "Vector Scores",
    vectorScoresKicker: "9 Axes",
    axisTableTitle: "Axis Score Table",
    axisTableKicker: "Interpretation",
    axisTableHeadAxis: "Axis",
    axisTableHeadScore: "Score",
    axisTableHeadInterpretation: "Interpretation",
    axisTableHeadStatus: "Status",
    recommendedUsageTitle: "Recommended Usage",
    recommendedUsageKicker: "Prompt Strategy",
    behavioralWarningsTitle: "Behavioral Warnings",
    behavioralWarningsKicker: "Watchouts",
    parseSummaryTitle: "Parsing Summary",
    parseSummaryKicker: "Parsing Summary",
    metadataTitle: "Survey Metadata",
    metadataKicker: "Metadata",
    questionInsightsTitle: "Question Insights",
    questionInsightsCopy: "Scan each question's strategy tags and scores at a glance.",
    sortQuestionOrder: "Question order",
    sortHighest: "Highest scores",
    sortLowest: "Lowest scores",
    copyReportBtn: "Copy Report",
    downloadReportBtn: "Download Report",
    closeReportBtn: "Close",
    loadingParsing: "Parsing question-by-question responses",
    loadingAnalyzing: "Analyzing behavioral traits by question",
    loadingScoring: "Calculating the behavioral vector",
    loadingReporting: "Generating the report",
    loadingSaving: "Saving analysis results...",
    savedStatus: "Analysis and storage completed.",
    copyDone: "Copied the report summary.",
    downloadDone: "Downloaded the report file."
  }
};

let latestRenderedPayload = null;

initializePage(elements, surveyVersion, currentLocale);
applyLocale(currentLocale);
bindResultActions(elements, {
  getPayload: () => latestRenderedPayload,
  onSortChange: (sortMode) => {
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, { sortMode, locale: currentLocale });
    }
  },
  onCopyReport: async () => {
    if (!latestRenderedPayload) {
      return;
    }

    const reportText = buildCopyableReport(latestRenderedPayload);
    await navigator.clipboard.writeText(reportText);
    showStatusMessage(elements.statusMessage, UI_COPY[currentLocale].copyDone);
  },
  onDownloadReport: () => {
    if (!latestRenderedPayload) {
      return;
    }

    const reportText = buildCopyableReport(latestRenderedPayload);
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${latestRenderedPayload.report.reportHeader.analysisId}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showStatusMessage(elements.statusMessage, UI_COPY[currentLocale].downloadDone);
  },
  onCloseReport: () => {
    closeResultsModal(elements);
  }
});

initializeProviderModelControls(elements);
initializeLanguageControls(elements);

elements.startBtn.addEventListener("click", () => {
  elements.surveySection.scrollIntoView({ behavior: "smooth" });
});

elements.downloadBtn.addEventListener("click", () => {
  const content = buildSurveyPrompt(surveyVersion, currentLocale);
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
  const loadingStartedAt = Date.now();
  setLoadingState(elements, true, UI_COPY[currentLocale].loadingParsing, currentLocale);

  const providerName = elements.providerNameInput.value.trim();
  const modelName = elements.modelNameInput.value.trim();
  const testLabel = elements.testLabelInput.value.trim();
  const rawResponse = elements.rawResponseInput.value.trim();

  try {
    const parsed = parseSurveyResponse(rawResponse, surveyDefinition);
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingAnalyzing, currentLocale);
    const analyzedResponses = analyzeResponses(parsed.answersByQuestion, surveyDefinition);
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingScoring, currentLocale);
    const axisScores = calculateAxisVector(analyzedResponses, surveyDefinition.axes);
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingReporting, currentLocale);
    const report = buildPrescriptionReport({
      axisScores,
      surveyVersion,
      rawResponse,
      modelName,
      locale: currentLocale
    });

    const payload = buildSubmissionPayload({
      providerName,
      modelName,
      testLabel,
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
        showAllInsights: true,
        locale: currentLocale
      }
    };

    renderResults(elements, latestRenderedPayload, { locale: currentLocale });
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingSaving, currentLocale);

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

    renderResults(elements, latestRenderedPayload, { locale: currentLocale });
    showStatusMessage(elements.statusMessage, UI_COPY[currentLocale].savedStatus);
  } catch (error) {
    console.error("Submission pipeline error:", error);
    showStatusMessage(elements.statusMessage, `제출 중 오류 발생: ${error.message}`);
  } finally {
    await ensureMinimumLoadingTime(loadingStartedAt, 3000);
    setLoadingState(elements, false, "", currentLocale);
  }
});

function buildCopyableReport(payload) {
  const locale = payload.uiState?.locale || currentLocale;
  const copy = UI_COPY[locale];
  const vectorLines = Object.entries(payload.axisScores)
    .map(([axis, score]) => `${axis}: ${score}`)
    .join("\n");
  const usageLines = payload.report.recommendedUsage.map((item) => `- ${item}`).join("\n");
  const warningLines = payload.report.behavioralWarnings.length
    ? payload.report.behavioralWarnings.map((item) => `- ${item}`).join("\n")
    : locale === "en"
      ? "- No major weakness axes were detected."
      : "- 뚜렷한 취약 축이 감지되지 않았습니다.";

  return [
    payload.report.reportHeader.reportType,
    `Survey Version: ${payload.surveyVersion}`,
    `Analysis ID: ${payload.report.reportHeader.analysisId}`,
    "",
    vectorLines,
    "",
    `${locale === "en" ? "Diagnostic Summary" : "진단 소견"}: ${payload.report.diagnosticSummary}`,
    "",
    copy.recommendedUsageTitle,
    usageLines,
    "",
    copy.behavioralWarningsTitle,
    warningLines
  ].join("\n");
}

function initializeProviderModelControls(elements) {
  elements.providerNameInput.addEventListener("change", () => {
    syncModelOptions(elements, elements.providerNameInput.value);
  });

  elements.shortcutLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const provider = link.dataset.provider || "";
      if (!provider) {
        return;
      }

      elements.providerNameInput.value = provider;
      syncModelOptions(elements, provider);
    });
  });

  syncModelOptions(elements, elements.providerNameInput.value);
}

function initializeLanguageControls(elements) {
  elements.langKoBtn?.addEventListener("click", () => setLocale("ko"));
  elements.langEnBtn?.addEventListener("click", () => setLocale("en"));
}

function setLocale(locale) {
  currentLocale = locale;
  applyLocale(locale);
  initializePage(elements, surveyVersion, locale);
  syncModelOptions(elements, elements.providerNameInput.value);
  if (latestRenderedPayload) {
    renderResults(elements, latestRenderedPayload, {
      sortMode: latestRenderedPayload.uiState?.sortMode ?? "question-order",
      locale
    });
  }
}

function applyLocale(locale) {
  const copy = UI_COPY[locale];
  document.documentElement.lang = locale;

  const textTargets = {
    heroBadge: copy.heroBadge,
    heroTitle: copy.heroTitle,
    heroDescription: copy.heroDescription,
    startBtn: copy.startBtn,
    downloadBtn: copy.downloadBtn,
    shortcutTitle: copy.shortcutTitle,
    shortcutDescription: copy.shortcutDescription,
    shortcutChatGPT: copy.shortcutChatGPT,
    shortcutGemini: copy.shortcutGemini,
    shortcutClaude: copy.shortcutClaude,
    processTitle: copy.processTitle,
    processKicker: copy.processKicker,
    processStep1Title: copy.processStep1Title,
    processStep1Desc: copy.processStep1Desc,
    processStep2Title: copy.processStep2Title,
    processStep2Desc: copy.processStep2Desc,
    processStep3Title: copy.processStep3Title,
    processStep3Desc: copy.processStep3Desc,
    processStep4Title: copy.processStep4Title,
    processStep4Desc: copy.processStep4Desc,
    surveySectionTitle: copy.surveySectionTitle,
    providerNameLabel: copy.providerNameLabel,
    modelNameLabel: copy.modelNameLabel,
    testLabelLabel: copy.testLabelLabel,
    surveyVersionInputLabel: copy.surveyVersionInputLabel,
    rawResponseLabel: copy.rawResponseLabel,
    hintParseTitle: copy.hintParseTitle,
    hintVersionTitle: copy.hintVersionTitle,
    hintStorageTitle: copy.hintStorageTitle,
    loadingEyebrow: copy.loadingEyebrow,
    loadingTitle: copy.loadingTitle,
    reportLabel: copy.reportLabel,
    reportTitle: copy.reportTitle,
    reportSubtitle: copy.reportSubtitle,
    reportOverviewTitle: copy.reportOverviewTitle,
    diagnosticTitle: copy.diagnosticTitle,
    diagnosticKicker: copy.diagnosticKicker,
    strengthsTitle: copy.strengthsTitle,
    weaknessesTitle: copy.weaknessesTitle,
    vectorScoresTitle: copy.vectorScoresTitle,
    vectorScoresKicker: copy.vectorScoresKicker,
    axisTableTitle: copy.axisTableTitle,
    axisTableKicker: copy.axisTableKicker,
    axisTableHeadAxis: copy.axisTableHeadAxis,
    axisTableHeadScore: copy.axisTableHeadScore,
    axisTableHeadInterpretation: copy.axisTableHeadInterpretation,
    axisTableHeadStatus: copy.axisTableHeadStatus,
    recommendedUsageTitle: copy.recommendedUsageTitle,
    recommendedUsageKicker: copy.recommendedUsageKicker,
    behavioralWarningsTitle: copy.behavioralWarningsTitle,
    behavioralWarningsKicker: copy.behavioralWarningsKicker,
    parseSummaryTitle: copy.parseSummaryTitle,
    parseSummaryKicker: copy.parseSummaryKicker,
    metadataTitle: copy.metadataTitle,
    metadataKicker: copy.metadataKicker,
    questionInsightsTitle: copy.questionInsightsTitle,
    questionInsightsCopy: copy.questionInsightsCopy,
    copyReportBtn: copy.copyReportBtn,
    downloadReportBtn: copy.downloadReportBtn,
    closeReportBtn: copy.closeReportBtn
  };

  Object.entries(textTargets).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });

  elements.testLabelInput.placeholder = copy.testLabelPlaceholder;
  elements.rawResponseInput.placeholder = copy.rawResponsePlaceholder;

  const surveyDescription = document.getElementById("surveyDescription");
  if (surveyDescription) {
    surveyDescription.innerHTML = `${copy.surveyDescription.replace("Q1:", "<code>Q1:</code>").replace("Q60:", "<code>Q60:</code>").replace("[END OF SURVEY]", "<code>[END OF SURVEY]</code>")}`;
  }

  const parseHintDesc = document.getElementById("hintParseDesc");
  if (parseHintDesc) {
    parseHintDesc.innerHTML = locale === "ko"
      ? "<code>Q번호:</code> 헤더를 기준으로 질문별 답변을 분리합니다."
      : "Responses are split by headers such as <code>Q1:</code> and <code>Q1-1:</code>.";
  }

  const hintVersionDesc = document.getElementById("hintVersionDesc");
  if (hintVersionDesc) {
    hintVersionDesc.textContent = copy.hintVersionDesc;
  }

  const hintStorageDesc = document.getElementById("hintStorageDesc");
  if (hintStorageDesc) {
    hintStorageDesc.textContent = copy.hintStorageDesc;
  }

  elements.providerNameInput.options[0].textContent = copy.providerPlaceholder;
  if (!elements.providerNameInput.value) {
    elements.modelNameInput.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = copy.modelPlaceholder;
    elements.modelNameInput.appendChild(option);
    elements.modelNameInput.disabled = true;
  }

  updateInsightSortLabels(locale);
  elements.langKoBtn?.classList.toggle("is-active", locale === "ko");
  elements.langEnBtn?.classList.toggle("is-active", locale === "en");
}

function updateInsightSortLabels(locale) {
  const copy = UI_COPY[locale];
  const [questionOrder, highestScore, lowestScore] = elements.insightSort.options;
  if (questionOrder) questionOrder.textContent = copy.sortQuestionOrder;
  if (highestScore) highestScore.textContent = copy.sortHighest;
  if (lowestScore) lowestScore.textContent = copy.sortLowest;
}

function syncModelOptions(elements, providerName) {
  const options = PROVIDER_MODELS[providerName] || [];
  elements.modelNameInput.innerHTML = "";

  if (!options.length) {
    elements.modelNameInput.disabled = true;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = UI_COPY[currentLocale].modelPlaceholder;
    elements.modelNameInput.appendChild(placeholder);
    return;
  }

  elements.modelNameInput.disabled = false;
  options.forEach((modelName, index) => {
    const option = document.createElement("option");
    option.value = modelName;
    option.textContent = modelName;
    option.selected = index === 0;
    elements.modelNameInput.appendChild(option);
  });
}

function closeResultsModal(elements) {
  elements.resultsSection.hidden = true;
  document.body.classList.remove("modal-open");
}

async function ensureMinimumLoadingTime(startedAt, minimumMs) {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, remaining));
  }
}
