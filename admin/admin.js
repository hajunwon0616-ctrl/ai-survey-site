import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  isAdminProfile,
  observeAuthSession,
  signInWithProvider,
  signOutCurrentUser
} from "../auth/auth.js";
import { runAutonomyCycle } from "../autonomy/autonomy-runner.js";
import { loadActiveRuntimeConfig } from "../autonomy/runtime-config.js";
import { COLLECTIONS } from "../data/autonomy-schemas.js";
import {
  getSurveyDefinition,
  getSurveyVersion,
  hasSurveyDefinition
} from "../survey-metadata.js";

const DEFAULT_SURVEY_VERSION = getSurveyVersion();
const DEFAULT_SCORING_VERSION = "scoring-v1";

const AGENT_LABELS = {
  "curator-ai": "질문 개선 AI",
  "scoring-auditor-ai": "채점 점검 AI",
  "simulator-ai": "시뮬레이션 AI",
  "deployer-ai": "배포 AI",
  "trend-analyst-ai": "추세 분석 AI",
  "meta-evaluator-ai": "메타 평가 AI",
  "strategy-manager-ai": "전략 관리자 AI",
  system: "시스템"
};

const elements = {
  adminAuthSummary: document.getElementById("adminAuthSummary"),
  adminLoginGoogleBtn: document.getElementById("adminLoginGoogleBtn"),
  adminLoginFacebookBtn: document.getElementById("adminLoginFacebookBtn"),
  adminLoginGithubBtn: document.getElementById("adminLoginGithubBtn"),
  adminSignOutBtn: document.getElementById("adminSignOutBtn"),
  adminGate: document.getElementById("adminGate"),
  adminGateMessage: document.getElementById("adminGateMessage"),
  adminDashboard: document.getElementById("adminDashboard"),
  adminRunCycleBtn: document.getElementById("adminRunCycleBtn"),
  adminRefreshBtn: document.getElementById("adminRefreshBtn"),
  adminStatus: document.getElementById("adminStatus"),
  adminActiveConfig: document.getElementById("adminActiveConfig"),
  adminSummaryMetrics: document.getElementById("adminSummaryMetrics"),
  adminSevenDayTrend: document.getElementById("adminSevenDayTrend"),
  adminAgentBoard: document.getElementById("adminAgentBoard"),
  adminQuestionVersions: document.getElementById("adminQuestionVersions"),
  adminScoringVersions: document.getElementById("adminScoringVersions"),
  adminEvaluationRuns: document.getElementById("adminEvaluationRuns"),
  adminProposals: document.getElementById("adminProposals"),
  adminLogs: document.getElementById("adminLogs"),
  adminReports: document.getElementById("adminReports")
};

let adminSession = {
  user: null,
  profile: null
};

initializeAdminAuth();

function initializeAdminAuth() {
  elements.adminLoginGoogleBtn?.addEventListener("click", async () => {
    await handleLogin("google");
  });
  elements.adminLoginFacebookBtn?.addEventListener("click", async () => {
    await handleLogin("facebook");
  });
  elements.adminLoginGithubBtn?.addEventListener("click", async () => {
    await handleLogin("github");
  });
  elements.adminSignOutBtn?.addEventListener("click", async () => {
    await signOutCurrentUser();
    setStatus("로그아웃했습니다.");
  });
  elements.adminRunCycleBtn?.addEventListener("click", async () => {
    await runCycleFromAdmin();
  });
  elements.adminRefreshBtn?.addEventListener("click", async () => {
    await loadAdminDashboard();
  });

  observeAuthSession(async (session) => {
    adminSession = session;
    renderAuthSummary(session);

    if (!session.user) {
      gateDashboard("로그인 후 관리자 권한을 확인합니다.", false);
      return;
    }

    if (!isAdminProfile(session.profile)) {
      gateDashboard("이 계정은 관리자 권한이 없습니다. userProfiles 컬렉션에서 role을 admin으로 설정해야 합니다.", false);
      return;
    }

    gateDashboard("관리자 권한이 확인되었습니다.", true);
    await loadAdminDashboard();
  });
}

async function handleLogin(providerKey) {
  try {
    await signInWithProvider(providerKey);
    setStatus("로그인에 성공했습니다.");
  } catch (error) {
    console.error("Admin login error:", error);
    setStatus(`로그인 중 오류가 발생했습니다. ${error.message}`, true);
  }
}

function renderAuthSummary(session) {
  elements.adminAuthSummary.innerHTML = "";
  const user = session?.user;
  const profile = session?.profile;
  [elements.adminLoginGoogleBtn, elements.adminLoginFacebookBtn, elements.adminLoginGithubBtn].forEach((button) => {
    if (button) {
      button.hidden = Boolean(user);
    }
  });

  if (!user) {
    elements.adminAuthSummary.textContent = "운영 대시보드는 로그인 후 관리자 권한이 있는 계정에서만 열립니다.";
    elements.adminSignOutBtn.hidden = true;
    return;
  }

  const name = document.createElement("strong");
  name.textContent = profile?.displayName || user.displayName || "관리자";
  const meta = document.createElement("span");
  meta.textContent = `${profile?.email || user.email || ""} · 권한 ${profile?.role || "authenticated"}`;
  elements.adminAuthSummary.append(name, meta);
  elements.adminSignOutBtn.hidden = false;
}

function gateDashboard(message, allowed) {
  elements.adminGateMessage.textContent = message;
  elements.adminDashboard.hidden = !allowed;
}

async function loadAdminDashboard() {
  setButtonsBusy(true);
  setStatus("운영 대시보드를 불러오는 중입니다.");

  try {
    const [activeConfig, questionVersions, scoringVersions, evaluationRuns, agentLogs, questionProposals, scoringProposals, trendReports, agentProfiles, metaEvaluations] = await Promise.all([
      loadSingleDoc(COLLECTIONS.activeConfig, "current"),
      loadCollection(COLLECTIONS.questionVersions, 12),
      loadCollection(COLLECTIONS.scoringVersions, 12),
      loadCollection(COLLECTIONS.evaluationRuns, 12),
      loadCollection(COLLECTIONS.agentLogs, 40),
      loadCollection(COLLECTIONS.questionProposals, 12),
      loadCollection(COLLECTIONS.scoringProposals, 12),
      loadCollection(COLLECTIONS.trendReports, 8),
      loadCollection(COLLECTIONS.agentProfiles, 12, "updatedAt"),
      loadCollection(COLLECTIONS.metaEvaluations, 8)
    ]);

    renderActiveConfig(activeConfig);
    renderSummaryMetrics({
      questionVersions,
      scoringVersions,
      evaluationRuns,
      agentLogs,
      questionProposals,
      scoringProposals
    });
    renderSevenDayTrend(agentLogs);
    renderAgentBoard(agentProfiles, agentLogs);
    renderQuestionVersions(questionVersions);
    renderScoringVersions(scoringVersions);
    renderEvaluationRuns(evaluationRuns);
    renderProposals(questionProposals, scoringProposals);
    renderLogs(agentLogs);
    renderReports(trendReports, metaEvaluations);
    setStatus("운영 대시보드를 최신 상태로 갱신했습니다.");
  } catch (error) {
    console.error("Admin dashboard load error:", error);
    setStatus(`운영 데이터를 불러오는 중 오류가 발생했습니다. ${error.message}`, true);
  } finally {
    setButtonsBusy(false);
  }
}

async function runCycleFromAdmin() {
  setButtonsBusy(true);
  setStatus("자율 운영 사이클을 실행 중입니다.");

  try {
    const runtimeConfig = await loadActiveRuntimeConfig({
      db,
      fallbackSurveyVersion: DEFAULT_SURVEY_VERSION,
      fallbackScoringVersion: DEFAULT_SCORING_VERSION,
      fallbackSurveyDefinition: getSurveyDefinition(DEFAULT_SURVEY_VERSION),
      hasSurveyDefinition
    });

    const surveyVersion = runtimeConfig.activeSurveyVersion || DEFAULT_SURVEY_VERSION;
    const surveyDefinition = runtimeConfig.runtimeSurveyDefinition || getSurveyDefinition(surveyVersion);

    const result = await runAutonomyCycle({
      db,
      surveyDefinition,
      surveyVersion
    });

    if (!result.ok && result.reason === "no-submissions") {
      setStatus("누적된 사용자 응답이 없어 자율 운영 사이클을 실행할 수 없습니다.", true);
      return;
    }

    setStatus("자율 운영 사이클이 완료되었습니다.");
    await loadAdminDashboard();
  } catch (error) {
    console.error("Admin cycle error:", error);
    setStatus(`자율 운영 사이클 실행 중 오류가 발생했습니다. ${error.message}`, true);
  } finally {
    setButtonsBusy(false);
  }
}

async function loadSingleDoc(collectionName, documentId) {
  const snapshot = await getDoc(doc(db, collectionName, documentId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function loadCollection(collectionName, size, orderField = "createdAt") {
  const snapshot = await getDocs(query(
    collection(db, collectionName),
    orderBy(orderField, "desc"),
    limit(size)
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function renderActiveConfig(activeConfig) {
  elements.adminActiveConfig.innerHTML = "";
  addKeyValue("활성 질문 버전", activeConfig?.activeSurveyVersion || "없음");
  addKeyValue("활성 채점 버전", activeConfig?.activeScoringVersion || "없음");
  addKeyValue("이전 질문 버전", activeConfig?.previousSurveyVersion || "없음");
  addKeyValue("이전 채점 버전", activeConfig?.previousScoringVersion || "없음");

  function addKeyValue(label, value) {
    const row = document.createElement("div");
    row.className = "autonomy-kv-row";
    row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    elements.adminActiveConfig.appendChild(row);
  }
}

function renderSummaryMetrics(data) {
  const rollbackCount = data.agentLogs.filter((item) => item.action === "rollback").length;
  const rows = [
    ["질문 버전 수", data.questionVersions.length],
    ["채점 버전 수", data.scoringVersions.length],
    ["평가 실행 수", data.evaluationRuns.length],
    ["최근 롤백 수", rollbackCount],
    ["질문 제안 수", data.questionProposals.length],
    ["채점 제안 수", data.scoringProposals.length]
  ];

  elements.adminSummaryMetrics.innerHTML = "";
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "metric-row";
    row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    elements.adminSummaryMetrics.appendChild(row);
  });
}

function renderSevenDayTrend(agentLogs) {
  const counts = new Map();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    counts.set(date.toISOString().slice(0, 10), 0);
  }

  agentLogs.forEach((log) => {
    const key = normalizeDateKey(log.createdAt);
    if (counts.has(key)) {
      counts.set(key, counts.get(key) + 1);
    }
  });

  const maxValue = Math.max(...counts.values(), 1);
  elements.adminSevenDayTrend.innerHTML = "";

  counts.forEach((value, key) => {
    const row = document.createElement("div");
    row.className = "trend-bar-row";
    row.innerHTML = `
      <span class="trend-bar-label">${key.slice(5)}</span>
      <div class="trend-bar-track"><div class="trend-bar-fill" style="width:${(value / maxValue) * 100}%"></div></div>
      <span class="trend-bar-value">${value}건</span>
    `;
    elements.adminSevenDayTrend.appendChild(row);
  });
}

function renderAgentBoard(agentProfiles, agentLogs) {
  elements.adminAgentBoard.innerHTML = "";
  if (!agentProfiles.length) {
    const empty = document.createElement("p");
    empty.className = "autonomy-empty";
    empty.textContent = "AI 직원 프로필이 아직 없습니다.";
    elements.adminAgentBoard.appendChild(empty);
    return;
  }

  agentProfiles.forEach((profile) => {
    const latestLog = agentLogs.find((item) => item.agent === profile.agentId);
    const card = document.createElement("article");
    card.className = "agent-card";
    card.innerHTML = `
      <div class="agent-card-head">
        <strong>${translateAgent(profile.agentId)}</strong>
        <span class="agent-chip">${profile.roleLabel || "운영 중"}</span>
      </div>
      <p class="agent-objectives">${(profile.currentObjectives || []).map(translateObjective).join(" / ") || "목표 정보 없음"}</p>
      <div class="agent-stats">
        <span>최근 작업 ${latestLog ? formatDate(latestLog.createdAt) : "없음"}</span>
        <span>전략 ${translateStrategy(profile.strategyType)}</span>
      </div>
      <p class="agent-memory-label">최근 활동</p>
      <p class="agent-memory-text">${latestLog ? formatLogSummary(latestLog) : "최근 작업 기록이 없습니다."}</p>
    `;
    elements.adminAgentBoard.appendChild(card);
  });
}

function renderQuestionVersions(items) {
  renderStackList(elements.adminQuestionVersions, items, (item) => ({
    title: `${item.versionId} · ${translateStatus(item.status)}`,
    lines: [
      `기반 버전: ${item.basedOn || "없음"}`,
      `문항 수: ${item.questionCount || item.questions?.length || 0}`,
      `앵커 문항 수: ${item.anchorCount || 0}`,
      `생성 주체: ${translateAgent(item.createdBy)}`
    ]
  }), "질문 버전 이력이 아직 없습니다.");
}

function renderScoringVersions(items) {
  renderStackList(elements.adminScoringVersions, items, (item) => ({
    title: `${item.versionId} · ${translateStatus(item.status)}`,
    lines: [
      `기반 버전: ${item.basedOn || "없음"}`,
      `생성 주체: ${translateAgent(item.createdBy)}`,
      `규칙 수: ${item.rules?.derivedFromProposals?.length || 1}`
    ]
  }), "채점 버전 이력이 아직 없습니다.");
}

function renderEvaluationRuns(items) {
  renderStackList(elements.adminEvaluationRuns, items, (item) => ({
    title: `${item.runId} · ${translateDecision(item.decision)}`,
    lines: [
      `비교 버전: ${item.baselineSurvey} / ${item.baselineScoring}`,
      `후보 버전: ${item.surveyCandidate} / ${item.scoringCandidate}`,
      `커버리지 ${item.metrics?.coverageRate ?? 0}, 변별력 ${item.metrics?.questionDiscrimination ?? 0}, 앵커 안정성 ${item.metrics?.anchorQuestionStability ?? 0}`
    ]
  }), "평가 실행 기록이 아직 없습니다.");
}

function renderProposals(questionProposals, scoringProposals) {
  const rows = [
    ...questionProposals.map((item) => ({
      title: `${translateProposalType(item.proposalType)} · ${item.targetQuestionId || "신규 문항"}`,
      lines: [
        `축: ${item.primaryAxis || "미지정"} / ${(item.secondaryAxes || []).join(", ") || "없음"}`,
        `상태: ${translateStatus(item.status)}`,
        `설명: ${buildQuestionProposalSummary(item)}`
      ]
    })),
    ...scoringProposals.map((item) => ({
      title: `채점 규칙 제안 · ${item.targetRule}`,
      lines: [
        `상태: ${translateStatus(item.status)}`,
        `설명: ${buildScoringProposalSummary(item)}`
      ]
    }))
  ];

  renderStackList(elements.adminProposals, rows, (item) => item, "질문 또는 채점 제안이 아직 없습니다.");
}

function renderLogs(agentLogs) {
  renderStackList(elements.adminLogs, agentLogs, (item) => ({
    title: `${translateAgent(item.agent)} · ${translateAction(item.action)}`,
    lines: [
      formatLogSummary(item),
      `시각: ${formatDate(item.createdAt)}`
    ]
  }), "운영 로그가 아직 없습니다.");
}

function renderReports(trendReports, metaEvaluations) {
  const rows = [
    ...trendReports.map((item) => ({
      title: `추세 분석 · ${item.reportId}`,
      lines: [
        `최근 커버리지 ${item.metrics?.coverageRate ?? 0}, non-answer ${item.metrics?.nonAnswerRate ?? 0}`,
        `서비스 분포: ${Object.entries(item.metrics?.providerBreakdown || {}).map(([key, value]) => `${key} ${value}`).join(" / ") || "없음"}`
      ]
    })),
    ...metaEvaluations.map((item) => ({
      title: `메타 평가 · ${translateAgent(item.targetAgent)}`,
      lines: [
        `성공률 ${Math.round((item.findings?.successRate || 0) * 100)}%, 승격 ${item.findings?.promoted ?? 0}, 롤백 ${item.findings?.rolledBack ?? 0}`,
        `조정 제안: ${(item.proposedAdjustments || []).map(translateAdjustment).join(" / ")}`
      ]
    }))
  ];

  renderStackList(elements.adminReports, rows, (item) => item, "추세 리포트와 메타 평가가 아직 없습니다.");
}

function renderStackList(container, items, mapItem, emptyText) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "stack-card";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const mapped = mapItem(item);
    const card = document.createElement("article");
    card.className = "stack-card";
    card.innerHTML = `
      <h4>${mapped.title}</h4>
      ${mapped.lines.map((line) => `<p>${line}</p>`).join("")}
    `;
    container.appendChild(card);
  });
}

function translateAgent(agentId) {
  return AGENT_LABELS[agentId] || agentId;
}

function translateAction(action) {
  const map = {
    cycle_start: "사이클 시작",
    autonomy_cycle_skipped: "사이클 건너뜀",
    proposal_batch: "제안 배치 생성",
    evaluation_run: "시뮬레이션 평가",
    promote: "활성 반영",
    reject: "반영 거부",
    rollback: "자동 롤백",
    trend_report: "추세 리포트 생성",
    meta_evaluation: "메타 평가",
    strategy_update: "전략 갱신",
    cycle_complete: "사이클 완료"
  };
  return map[action] || action;
}

function translateDecision(decision) {
  return decision === "promote" ? "승격" : "거부";
}

function translateStatus(status) {
  const map = {
    active: "활성",
    candidate: "후보",
    promoted: "승격됨",
    rejected: "거부됨",
    archived: "보관",
    rolled_back: "롤백됨"
  };
  return map[status] || status || "미정";
}

function translateProposalType(type) {
  return type === "revise_question" ? "기존 문항 수정" : "신규 문항 생성";
}

function translateObjective(text) {
  const map = {
    "stabilize baseline metrics": "기준 지표 안정화",
    "avoid unsafe promotion": "불안정한 승격 방지",
    "improve proposal quality": "제안 품질 향상",
    "protect anchor comparability": "앵커 비교 가능성 보호",
    "avoid unstable promotion": "불안정한 반영 방지"
  };
  return map[text] || text;
}

function translateStrategy(text) {
  if (!text) {
    return "기본 전략";
  }
  const map = {
    baseline: "기본 전략",
    "maintain balanced strategy with slightly higher exploration": "균형형 탐색 강화 전략",
    "shift to conservative strategy with stronger rollback avoidance": "보수형 안정 전략"
  };
  return map[text] || text;
}

function translateAdjustment(text) {
  const map = {
    "lower risk tolerance": "위험 허용도 낮추기",
    "reduce aggressive candidate promotion": "과도한 후보 승격 줄이기",
    "increase anchor stability weighting": "앵커 안정성 가중치 높이기",
    "slightly increase exploration rate": "탐색률 소폭 상향",
    "keep current strategy family": "현재 전략군 유지",
    "tighten proposal screening": "제안 선별 강화",
    "increase simulation threshold sensitivity": "시뮬레이션 기준 민감도 상향"
  };
  return map[text] || text;
}

function buildQuestionProposalSummary(item) {
  if (item.proposalType === "revise_question") {
    return `${item.targetQuestionId} 문항을 보강하는 후보입니다.`;
  }
  return `${item.primaryAxis || "목표 축"} 측정 강화를 위한 신규 문항 후보입니다.`;
}

function buildScoringProposalSummary(item) {
  if (item.targetRule === "non_answer_detection") {
    return "무의미 응답 감지 규칙을 더 엄격하게 조정하는 제안입니다.";
  }
  if (item.targetRule === "minimum_validity_threshold") {
    return "설명형 문항의 최소 유효 응답 기준을 강화하는 제안입니다.";
  }
  return "채점 이상을 줄이기 위한 규칙 조정 제안입니다.";
}

function formatLogSummary(log) {
  switch (log.action) {
    case "cycle_start":
      return "새 자율 운영 사이클이 시작되었습니다.";
    case "autonomy_cycle_skipped":
      return "분석할 사용자 응답이 없어 사이클을 건너뛰었습니다.";
    case "proposal_batch":
      return `${translateAgent(log.agent)}가 ${log.details?.proposalIds?.length || 0}개의 후보를 생성했습니다.`;
    case "evaluation_run":
      return `후보 버전을 비교 평가했고 결정은 ${translateDecision(log.summary?.includes("promote") ? "promote" : "reject")}입니다.`;
    case "promote":
      return "배포 AI가 새 질문/채점 버전을 활성화했습니다.";
    case "reject":
      return "배포 AI가 새 후보 버전을 활성화하지 않고 거부했습니다.";
    case "rollback":
      return "배포 AI가 성능 저하를 감지해 이전 버전으로 롤백했습니다.";
    case "trend_report":
      return "최근 응답 기준 장기 추세와 drift 지표를 계산했습니다.";
    case "meta_evaluation":
      return "메타 평가 AI가 최근 제안 전략의 성과를 평가했습니다.";
    case "strategy_update":
      return "전략 관리자 AI가 직원 전략 파라미터를 조정했습니다.";
    case "cycle_complete":
      return "자율 운영 사이클이 완료되었습니다.";
    default:
      return log.summary || "운영 로그";
  }
}

function normalizeDateKey(value) {
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? "" : dateValue.toISOString().slice(0, 10);
}

function formatDate(value) {
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? String(value || "") : dateValue.toLocaleString("ko-KR");
}

function setStatus(message, isError = false) {
  elements.adminStatus.textContent = message;
  elements.adminStatus.dataset.state = isError ? "error" : "normal";
}

function setButtonsBusy(isBusy) {
  elements.adminRunCycleBtn.disabled = isBusy;
  elements.adminRefreshBtn.disabled = isBusy;
}
