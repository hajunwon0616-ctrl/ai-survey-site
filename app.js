import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getSurveyDefinition,
  getSurveyVersion,
  buildSurveyPromptFromDefinition,
  hasSurveyDefinition
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
import {
  loadAutonomySnapshot,
  runAutonomyCycle
} from "./autonomy/autonomy-runner.js";
import {
  renderAutonomySnapshot,
  renderAutonomyStatus
} from "./autonomy/ui.js";
import { loadActiveRuntimeConfig } from "./autonomy/runtime-config.js";
import {
  isAdminProfile,
  observeAuthSession,
  getAuthErrorMessage,
  signInWithProvider,
  signOutCurrentUser
} from "./auth/auth.js";
import {
  renderAuthPanel,
  renderUserHistory
} from "./user/history.js";

const DEFAULT_SURVEY_VERSION = getSurveyVersion();
const DEFAULT_SCORING_VERSION = "scoring-v1";
let surveyVersion = DEFAULT_SURVEY_VERSION;
let surveyDefinition = getSurveyDefinition(DEFAULT_SURVEY_VERSION);
let currentLocale = "ko";
let authSession = {
  user: null,
  profile: null
};
let userHistoryRecords = [];
let runtimeConfig = {
  requestedSurveyVersion: DEFAULT_SURVEY_VERSION,
  activeSurveyVersion: DEFAULT_SURVEY_VERSION,
  activeScoringVersion: DEFAULT_SCORING_VERSION,
  previousSurveyVersion: null,
  previousScoringVersion: null,
  source: "fallback"
};

const elements = {
  startBtn: document.getElementById("startBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  authActions: document.getElementById("authActions"),
  authSummary: document.getElementById("authSummary"),
  loginGoogleBtn: document.getElementById("loginGoogleBtn"),
  loginFacebookBtn: document.getElementById("loginFacebookBtn"),
  loginGithubBtn: document.getElementById("loginGithubBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  adminLink: document.getElementById("adminLink"),
  langKoBtn: document.getElementById("langKoBtn"),
  langEnBtn: document.getElementById("langEnBtn"),
  shortcutLinks: document.querySelectorAll(".shortcut-link"),
  providerButtons: document.querySelectorAll(".provider-chip"),
  surveySection: document.getElementById("surveySection"),
  analysisForm: document.getElementById("analysisForm"),
  submitButton: document.getElementById("submitBtn"),
  viewResultsBtn: document.getElementById("viewResultsBtn"),
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
  insightExpandBtn: document.getElementById("insightExpandBtn"),
  copyReportBtn: document.getElementById("copyReportBtn"),
  downloadReportBtn: document.getElementById("downloadReportBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  userHistorySection: document.getElementById("userHistorySection"),
  userHistoryList: document.getElementById("userHistoryList"),
  runAutonomyBtn: document.getElementById("runAutonomyBtn"),
  refreshAutonomyBtn: document.getElementById("refreshAutonomyBtn"),
  autonomyStatus: document.getElementById("autonomyStatus"),
  autonomyActiveConfig: document.getElementById("autonomyActiveConfig"),
  autonomySurveyDetails: document.getElementById("autonomySurveyDetails"),
  autonomyAgentBoard: document.getElementById("autonomyAgentBoard"),
  autonomyTimeline: document.getElementById("autonomyTimeline"),
  autonomyEvaluations: document.getElementById("autonomyEvaluations"),
  autonomyQuestionProposals: document.getElementById("autonomyQuestionProposals"),
  autonomyScoringProposals: document.getElementById("autonomyScoringProposals"),
  autonomyTrends: document.getElementById("autonomyTrends"),
  autonomyLogs: document.getElementById("autonomyLogs")
};

const PROVIDER_MODELS = {
  ChatGPT: ["GPT-5", "GPT-4o", "GPT-4o mini", "GPT-4.1", "GPT-4.1 mini"],
  Claude: ["Claude Opus", "Claude Sonnet", "Claude Haiku"],
  Gemini: ["Gemini 2.0 Ultra", "Gemini 2.0 Pro", "Gemini 1.5 Pro"],
  Perplexity: ["Sonar Large", "Sonar Pro", "Deep Research"],
  Other: ["Custom / Unknown", "Local Model", "Open-source Model"]
};

const UI_COPY = {
  ko: {
    heroBadge: "Behavioral Profile Analysis",
    authTitle: "선택 로그인",
    authDescription: "로그인하지 않아도 기본 분석은 사용할 수 있습니다. 로그인하면 내 기록이 저장됩니다.",
    loginGoogleBtn: "Google로 계속",
    loginFacebookBtn: "Facebook으로 계속",
    loginGithubBtn: "GitHub로 계속",
    signOutBtn: "로그아웃",
    adminLink: "운영 대시보드",
    heroTitle: "AI 행동 성향 분석 시스템",
    heroDescription: "질문을 직접 답하는 설문이 아니라, AI가 작성한 전체 응답을 붙여넣어 행동 벡터를 분석하는 도구입니다.",
    startBtn: "분석 시작하기",
    downloadBtn: "질문지 다운로드",
    shortcutTitle: "AI 바로가기",
    shortcutDescription: "질문지를 받은 뒤 바로 원하는 AI 창으로 이동할 수 있습니다.",
    shortcutChatGPT: "ChatGPT 열기",
    shortcutGemini: "Gemini 열기",
    shortcutClaude: "Claude 열기",
    shortcutPerplexity: "Perplexity 열기",
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
    providerHelper: "원하는 AI 서비스를 선택하면 모델 목록이 자동으로 바뀝니다.",
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
    historyTitle: "내 분석 기록",
    historyKicker: "Signed-in Users",
    historyDescription: "로그인하면 이전 제출 기록과 분석 리포트를 다시 열어볼 수 있습니다.",
    questionInsightsTitle: "Question Insights",
    questionInsightsCopy: "질문별 전략 태그와 점수를 빠르게 훑어볼 수 있습니다.",
    sortQuestionOrder: "질문 순서",
    sortHighest: "점수 높은 순",
    sortLowest: "점수 낮은 순",
    copyReportBtn: "리포트 복사",
    downloadReportBtn: "리포트 다운로드",
    exportPdfBtn: "PDF로 저장",
    closeReportBtn: "닫기",
    viewResultsBtn: "결과 보기",
    insightExpandBtn: "전체 펼치기",
    insightCollapseBtn: "접기",
    autonomyTitle: "Autonomy Lab",
    autonomyKicker: "Curator / Auditor / Simulator / Deployer",
    autonomyDescription: "기존 응답 데이터를 기반으로 자율 개선 사이클을 실행하고, candidate proposal, evaluation run, trend report 상태를 확인합니다.",
    runAutonomyBtn: "자율 운영 사이클 실행",
    refreshAutonomyBtn: "상태 새로고침",
    autonomyActiveConfigTitle: "Active Config",
    autonomySurveyDetailsTitle: "활성 질문 세트",
    autonomyAgentBoardTitle: "AI 직원 보드",
    autonomyTimelineTitle: "활동 타임라인",
    autonomyEvaluationsTitle: "Recent Evaluations",
    autonomyQuestionProposalsTitle: "Question Proposals",
    autonomyScoringProposalsTitle: "Scoring Proposals",
    autonomyTrendsTitle: "Trend Reports",
    autonomyLogsTitle: "Agent Logs",
    autonomyStatusReady: "자율 운영 상태를 불러왔습니다.",
    autonomyStatusRunning: "자율 운영 사이클을 실행 중입니다...",
    autonomyStatusCompleted: "자율 운영 사이클이 완료되었습니다.",
    autonomyStatusNoData: "분석할 응답 데이터가 아직 없습니다.",
    autonomyStatusFailed: "자율 운영 사이클 실행 중 오류가 발생했습니다.",
    loginSuccess: "로그인되었습니다.",
    logoutSuccess: "로그아웃되었습니다.",
    loginError: "로그인 중 오류가 발생했습니다.",
    loginRedirecting: "브라우저 보안 설정 때문에 리디렉션 방식으로 로그인 화면을 여는 중입니다.",
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
    authTitle: "Optional Sign-in",
    authDescription: "Guest mode stays available. Sign in to save and revisit your own analysis history.",
    loginGoogleBtn: "Continue with Google",
    loginFacebookBtn: "Continue with Facebook",
    loginGithubBtn: "Continue with GitHub",
    signOutBtn: "Sign out",
    adminLink: "Admin Dashboard",
    heroTitle: "AI Behavioral Analysis System",
    heroDescription: "This is not a survey where users answer questions directly. It analyzes a full response generated by an AI and turns it into a behavioral vector.",
    startBtn: "Start Analysis",
    downloadBtn: "Download Survey",
    shortcutTitle: "AI Shortcuts",
    shortcutDescription: "After downloading the survey, jump directly to the AI service you want to test.",
    shortcutChatGPT: "Open ChatGPT",
    shortcutGemini: "Open Gemini",
    shortcutClaude: "Open Claude",
    shortcutPerplexity: "Open Perplexity",
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
    providerHelper: "Choose an AI provider and the model list will update automatically.",
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
    historyTitle: "My Analysis History",
    historyKicker: "Signed-in Users",
    historyDescription: "Signed-in users can reopen previous submissions and saved reports here.",
    questionInsightsTitle: "Question Insights",
    questionInsightsCopy: "Scan each question's strategy tags and scores at a glance.",
    sortQuestionOrder: "Question order",
    sortHighest: "Highest scores",
    sortLowest: "Lowest scores",
    copyReportBtn: "Copy Report",
    downloadReportBtn: "Download Report",
    exportPdfBtn: "Export PDF",
    closeReportBtn: "Close",
    viewResultsBtn: "View Results",
    insightExpandBtn: "Expand all",
    insightCollapseBtn: "Collapse",
    autonomyTitle: "Autonomy Lab",
    autonomyKicker: "Curator / Auditor / Simulator / Deployer",
    autonomyDescription: "Run the autonomous improvement cycle on accumulated responses and inspect candidate proposals, evaluation runs, and trend reports.",
    runAutonomyBtn: "Run autonomy cycle",
    refreshAutonomyBtn: "Refresh status",
    autonomyActiveConfigTitle: "Active Config",
    autonomySurveyDetailsTitle: "Active Survey Set",
    autonomyAgentBoardTitle: "AI Worker Board",
    autonomyTimelineTitle: "Activity Timeline",
    autonomyEvaluationsTitle: "Recent Evaluations",
    autonomyQuestionProposalsTitle: "Question Proposals",
    autonomyScoringProposalsTitle: "Scoring Proposals",
    autonomyTrendsTitle: "Trend Reports",
    autonomyLogsTitle: "Agent Logs",
    autonomyStatusReady: "Loaded the autonomy lab state.",
    autonomyStatusRunning: "Running the autonomy cycle...",
    autonomyStatusCompleted: "Autonomy cycle completed.",
    autonomyStatusNoData: "There are no stored responses to analyze yet.",
    autonomyStatusFailed: "The autonomy cycle failed.",
    loginSuccess: "Signed in successfully.",
    logoutSuccess: "Signed out.",
    loginError: "Sign-in failed.",
    loginRedirecting: "The popup was blocked, so the sign-in page is opening with redirect.",
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
let autonomyInitialized = false;

initializePage(elements, surveyVersion, currentLocale);
applyLocale(currentLocale);
updateResultsButtonState(false);
bindResultActions(elements, {
  getPayload: () => latestRenderedPayload,
  onSortChange: (sortMode) => {
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, { sortMode, locale: currentLocale });
    }
  },
  onToggleInsightExpansion: () => {
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, {
        sortMode: latestRenderedPayload.uiState?.sortMode ?? "question-order",
        locale: currentLocale,
        insightsExpanded: !latestRenderedPayload.uiState?.insightsExpanded
      });
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
  onExportPdf: () => {
    document.body.classList.add("print-report-mode");
    window.print();
    window.setTimeout(() => {
      document.body.classList.remove("print-report-mode");
    }, 250);
  },
  onCloseReport: () => {
    closeResultsModal(elements);
  }
});

initializeProviderModelControls(elements);
initializeLanguageControls(elements);
initializeAuthControls(elements);
initializeAuthSession();
initializeAutonomyLab();
initializeRuntimeConfig();

elements.startBtn.addEventListener("click", () => {
  elements.surveySection.scrollIntoView({ behavior: "smooth" });
});

elements.downloadBtn.addEventListener("click", () => {
  const content = buildSurveyPromptFromDefinition(surveyDefinition, currentLocale);
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
    if (!providerName) {
      throw new Error(currentLocale === "en" ? "Please select an AI provider first." : "먼저 AI 서비스를 선택해 주세요.");
    }

    const parsed = parseSurveyResponse(rawResponse, surveyDefinition);
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingAnalyzing, currentLocale);
    const analyzedResponses = analyzeResponses(parsed.answersByQuestion, surveyDefinition);
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingScoring, currentLocale);
    const axisScores = calculateAxisVector(analyzedResponses, surveyDefinition.axes);
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingReporting, currentLocale);
    const report = buildPrescriptionReport({
      axisScores,
      surveyVersion,
      scoringVersion: runtimeConfig.activeScoringVersion,
      rawResponse,
      modelName,
      locale: currentLocale
    });

    const payload = buildSubmissionPayload({
      providerName,
      modelName,
      testLabel,
      surveyVersion,
      scoringVersion: runtimeConfig.activeScoringVersion,
      rawResponse,
      surveyDefinition,
      parsed,
      analyzedResponses,
      axisScores,
      report,
      activeConfig: runtimeConfig,
      authSession
    });

    latestRenderedPayload = {
      ...payload,
      uiState: {
        sortMode: "question-order",
        showAllInsights: true,
        locale: currentLocale,
        insightsExpanded: false
      }
    };
    setLoadingState(elements, true, UI_COPY[currentLocale].loadingSaving, currentLocale);

    const docRef = await addDoc(collection(db, "surveyResponses"), {
      ...payload,
      createdAt: serverTimestamp()
    });

    let historyWarning = "";
    if (authSession.user) {
      try {
        await saveUserHistoryRecord(docRef.id, payload);
        await loadUserHistory();
      } catch (historyError) {
        console.error("User history save error:", historyError);
        historyWarning = currentLocale === "en"
          ? " Analysis is saved, but the personal history entry could not be synced."
          : " 분석은 저장됐지만 개인 기록 동기화는 완료되지 않았습니다.";
      }
    }

    latestRenderedPayload = {
      ...latestRenderedPayload,
      firestore: {
        collection: "surveyResponses",
        documentId: docRef.id
      }
    };

    await ensureMinimumLoadingTime(loadingStartedAt, 3000);
    setLoadingState(elements, false, "", currentLocale);
    updateResultsButtonState(true);
    renderResults(elements, latestRenderedPayload, { locale: currentLocale });
    showStatusMessage(elements.statusMessage, `${UI_COPY[currentLocale].savedStatus}${historyWarning}`);
  } catch (error) {
    console.error("Submission pipeline error:", error);
    if (latestRenderedPayload) {
      updateResultsButtonState(true);
    }
    await ensureMinimumLoadingTime(loadingStartedAt, 3000);
    setLoadingState(elements, false, "", currentLocale);
    showStatusMessage(elements.statusMessage, `제출 중 오류 발생: ${error.message}`);
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, { locale: currentLocale });
    }
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
    `Scoring Version: ${payload.scoringVersion || payload.report.reportHeader.scoringVersion || DEFAULT_SCORING_VERSION}`,
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
  elements.providerButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.provider || "";
      elements.providerNameInput.value = provider;
      syncModelOptions(elements, provider);
    });
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
  elements.viewResultsBtn?.addEventListener("click", () => {
    if (latestRenderedPayload) {
      renderResults(elements, latestRenderedPayload, {
        sortMode: latestRenderedPayload.uiState?.sortMode ?? "question-order",
        locale: currentLocale,
        insightsExpanded: latestRenderedPayload.uiState?.insightsExpanded ?? false
      });
    }
  });
}

function initializeAuthControls(elements) {
  elements.loginGoogleBtn?.addEventListener("click", async () => {
    await handleProviderLogin("google");
  });
  elements.loginFacebookBtn?.addEventListener("click", async () => {
    await handleProviderLogin("facebook");
  });
  elements.loginGithubBtn?.addEventListener("click", async () => {
    await handleProviderLogin("github");
  });
  elements.signOutBtn?.addEventListener("click", async () => {
    await signOutCurrentUser();
    showStatusMessage(elements.statusMessage, UI_COPY[currentLocale].logoutSuccess);
  });
  elements.userHistoryList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-open]");
    if (!button) {
      return;
    }

    const targetId = button.dataset.historyOpen;
    const matched = userHistoryRecords.find((item) => item.id === targetId);
    if (!matched) {
      return;
    }

    latestRenderedPayload = {
      ...matched,
      uiState: {
        sortMode: "question-order",
        showAllInsights: true,
        locale: currentLocale,
        insightsExpanded: false
      }
    };
    updateResultsButtonState(true);
    renderResults(elements, latestRenderedPayload, { locale: currentLocale });
  });
}

function initializeAuthSession() {
  observeAuthSession(async (session) => {
    authSession = session;
    renderAuthPanel(elements, authSession, currentLocale);

    if (authSession.user) {
      await loadUserHistory();
    } else {
      userHistoryRecords = [];
      renderUserHistory(elements, userHistoryRecords, currentLocale);
    }

    if (elements.adminLink) {
      elements.adminLink.hidden = !isAdminProfile(authSession.profile);
    }
  });
}

async function handleProviderLogin(providerKey) {
  try {
    const result = await signInWithProvider(providerKey);
    if (result?.redirected) {
      showStatusMessage(elements.statusMessage, UI_COPY[currentLocale].loginRedirecting);
      return;
    }
    showStatusMessage(elements.statusMessage, UI_COPY[currentLocale].loginSuccess);
  } catch (error) {
    console.error("Provider sign-in error:", error);
    showStatusMessage(elements.statusMessage, getAuthErrorMessage(error, currentLocale));
  }
}

async function loadUserHistory() {
  if (!authSession.user) {
    userHistoryRecords = [];
    renderUserHistory(elements, userHistoryRecords, currentLocale);
    return;
  }

  const snapshot = await getDocs(query(
    collection(db, "userHistory"),
    where("userId", "==", authSession.user.uid)
  ));

  userHistoryRecords = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => toComparableDate(b.createdAt) - toComparableDate(a.createdAt));

  renderUserHistory(elements, userHistoryRecords, currentLocale);
}

async function saveUserHistoryRecord(responseId, payload) {
  if (!authSession.user) {
    return;
  }

  await setDoc(doc(db, "userHistory", responseId), {
    userId: authSession.user.uid,
    surveyResponseId: responseId,
    providerName: payload.providerName,
    modelName: payload.modelName,
    testLabel: payload.testLabel || "",
    surveyVersion: payload.surveyVersion,
    scoringVersion: payload.scoringVersion,
    summary: payload.summary,
    axisScores: payload.axisScores,
    report: payload.report,
    parserSummary: payload.parserSummary,
    questionResponses: payload.questionResponses,
    storageTargets: payload.storageTargets,
    analysisMeta: payload.analysisMeta,
    auth: payload.auth,
    createdAt: serverTimestamp()
  });
}

function setLocale(locale) {
  currentLocale = locale;
  applyLocale(locale);
  initializePage(elements, surveyVersion, locale);
  syncModelOptions(elements, elements.providerNameInput.value);
  if (latestRenderedPayload) {
    renderResults(elements, latestRenderedPayload, {
      sortMode: latestRenderedPayload.uiState?.sortMode ?? "question-order",
      locale,
      insightsExpanded: latestRenderedPayload.uiState?.insightsExpanded ?? false
    });
  }
}

function applyLocale(locale) {
  const copy = UI_COPY[locale];
  document.documentElement.lang = locale;

  const textTargets = {
    authTitle: copy.authTitle,
    authDescription: copy.authDescription,
    loginGoogleBtn: copy.loginGoogleBtn,
    loginFacebookBtn: copy.loginFacebookBtn,
    loginGithubBtn: copy.loginGithubBtn,
    signOutBtn: copy.signOutBtn,
    adminLink: copy.adminLink,
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
    shortcutPerplexity: copy.shortcutPerplexity,
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
    historyTitle: copy.historyTitle,
    historyKicker: copy.historyKicker,
    historyDescription: copy.historyDescription,
    questionInsightsTitle: copy.questionInsightsTitle,
    questionInsightsCopy: copy.questionInsightsCopy,
    providerHelper: copy.providerHelper,
    copyReportBtn: copy.copyReportBtn,
    downloadReportBtn: copy.downloadReportBtn,
    exportPdfBtn: copy.exportPdfBtn,
    closeReportBtn: copy.closeReportBtn,
    viewResultsBtn: copy.viewResultsBtn
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

  if (!elements.providerNameInput.value) {
    elements.modelNameInput.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = copy.modelPlaceholder;
    elements.modelNameInput.appendChild(option);
    elements.modelNameInput.disabled = true;
  }

  updateInsightSortLabels(locale);
  updateInsightExpansionLabel(locale);
  elements.langKoBtn?.classList.toggle("is-active", locale === "ko");
  elements.langEnBtn?.classList.toggle("is-active", locale === "en");
  renderAuthPanel(elements, authSession, locale);
  renderUserHistory(elements, userHistoryRecords, locale);
  const autonomyTextTargets = {
    autonomyTitle: copy.autonomyTitle,
    autonomyKicker: copy.autonomyKicker,
    autonomyDescription: copy.autonomyDescription,
    runAutonomyBtn: copy.runAutonomyBtn,
    refreshAutonomyBtn: copy.refreshAutonomyBtn,
    autonomyActiveConfigTitle: copy.autonomyActiveConfigTitle,
    autonomySurveyDetailsTitle: copy.autonomySurveyDetailsTitle,
    autonomyAgentBoardTitle: copy.autonomyAgentBoardTitle,
    autonomyTimelineTitle: copy.autonomyTimelineTitle,
    autonomyEvaluationsTitle: copy.autonomyEvaluationsTitle,
    autonomyQuestionProposalsTitle: copy.autonomyQuestionProposalsTitle,
    autonomyScoringProposalsTitle: copy.autonomyScoringProposalsTitle,
    autonomyTrendsTitle: copy.autonomyTrendsTitle,
    autonomyLogsTitle: copy.autonomyLogsTitle
  };

  Object.entries(autonomyTextTargets).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  });

  if (elements.viewResultsBtn && !elements.viewResultsBtn.hidden) {
    elements.viewResultsBtn.textContent = copy.viewResultsBtn;
  }
}

function updateInsightSortLabels(locale) {
  const copy = UI_COPY[locale];
  const [questionOrder, highestScore, lowestScore] = elements.insightSort.options;
  if (questionOrder) questionOrder.textContent = copy.sortQuestionOrder;
  if (highestScore) highestScore.textContent = copy.sortHighest;
  if (lowestScore) lowestScore.textContent = copy.sortLowest;
}

function updateInsightExpansionLabel(locale, expanded = latestRenderedPayload?.uiState?.insightsExpanded ?? false) {
  if (!elements.insightExpandBtn) {
    return;
  }
  elements.insightExpandBtn.textContent = expanded ? UI_COPY[locale].insightCollapseBtn : UI_COPY[locale].insightExpandBtn;
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

  elements.providerButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.provider === providerName);
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

function updateResultsButtonState(hasResults) {
  if (!elements.viewResultsBtn) {
    return;
  }

  elements.viewResultsBtn.hidden = !hasResults;
  elements.viewResultsBtn.disabled = !hasResults;
  if (hasResults) {
    elements.viewResultsBtn.textContent = UI_COPY[currentLocale].viewResultsBtn;
  }
}

function toComparableDate(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function initializeAutonomyLab() {
  if (autonomyInitialized || !elements.runAutonomyBtn || !elements.refreshAutonomyBtn) {
    return;
  }

  autonomyInitialized = true;

  elements.runAutonomyBtn.addEventListener("click", async () => {
    await executeAutonomyCycle();
  });

  elements.refreshAutonomyBtn.addEventListener("click", async () => {
    await refreshAutonomyLab();
  });

  refreshAutonomyLab();
}

async function initializeRuntimeConfig() {
  const nextConfig = await loadActiveRuntimeConfig({
    db,
    fallbackSurveyVersion: DEFAULT_SURVEY_VERSION,
    fallbackScoringVersion: DEFAULT_SCORING_VERSION,
    fallbackSurveyDefinition: getSurveyDefinition(DEFAULT_SURVEY_VERSION),
    hasSurveyDefinition
  });

  applyRuntimeConfig(nextConfig);
}

async function refreshAutonomyLab() {
  if (!elements.autonomyStatus) {
    return;
  }

  setAutonomyBusy(true);
  renderAutonomyStatus(elements.autonomyStatus, UI_COPY[currentLocale].autonomyStatusReady);

  try {
    const snapshot = await loadAutonomySnapshot({ db });
    renderAutonomySnapshot(elements, snapshot);
    await initializeRuntimeConfig();
  } catch (error) {
    console.error("Autonomy snapshot error:", error);
    renderAutonomyStatus(
      elements.autonomyStatus,
      `${UI_COPY[currentLocale].autonomyStatusFailed} ${error.message}`,
      true
    );
  } finally {
    setAutonomyBusy(false);
  }
}

async function executeAutonomyCycle() {
  if (!elements.autonomyStatus) {
    return;
  }

  setAutonomyBusy(true);
  renderAutonomyStatus(elements.autonomyStatus, UI_COPY[currentLocale].autonomyStatusRunning);

  try {
    const result = await runAutonomyCycle({
      db,
      surveyDefinition,
      surveyVersion
    });

    renderAutonomySnapshot(elements, result.snapshot);
    await initializeRuntimeConfig();

    if (!result.ok && result.reason === "no-submissions") {
      renderAutonomyStatus(elements.autonomyStatus, UI_COPY[currentLocale].autonomyStatusNoData, true);
      return;
    }

    renderAutonomyStatus(elements.autonomyStatus, UI_COPY[currentLocale].autonomyStatusCompleted);
  } catch (error) {
    console.error("Autonomy cycle error:", error);
    renderAutonomyStatus(
      elements.autonomyStatus,
      `${UI_COPY[currentLocale].autonomyStatusFailed} ${error.message}`,
      true
    );
  } finally {
    setAutonomyBusy(false);
  }
}

function setAutonomyBusy(isBusy) {
  if (elements.runAutonomyBtn) {
    elements.runAutonomyBtn.disabled = isBusy;
  }
  if (elements.refreshAutonomyBtn) {
    elements.refreshAutonomyBtn.disabled = isBusy;
  }
}

function applyRuntimeConfig(nextConfig) {
  runtimeConfig = nextConfig;
  surveyVersion = nextConfig.activeSurveyVersion || DEFAULT_SURVEY_VERSION;
  surveyDefinition = nextConfig.runtimeSurveyDefinition || getSurveyDefinition(surveyVersion);
  initializePage(elements, surveyVersion, currentLocale);
  elements.surveyVersionInput.value = surveyVersion;

  if (nextConfig.source === "fallback-missing-survey") {
    showStatusMessage(
      elements.statusMessage,
      currentLocale === "en"
        ? `Active survey version ${nextConfig.requestedSurveyVersion} is not installed locally. Falling back to ${surveyVersion}.`
        : `활성 설문 버전 ${nextConfig.requestedSurveyVersion}이 로컬에 없어 ${surveyVersion}으로 대체합니다.`
    );
  }
}
