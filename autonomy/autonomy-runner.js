import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAnchorQuestions } from "../survey-metadata.js";
import {
  COLLECTIONS,
  VERSION_STATUS,
  createActiveConfigDoc,
  createAgentLogDoc,
  createAgentMemoryDoc,
  createAgentProfileDoc,
  createQuestionVersionDoc,
  createScoringVersionDoc
} from "../data/autonomy-schemas.js";
import { buildHealthSnapshot } from "../ops/health-check.js";
import { buildEvaluationMetrics } from "../ops/metrics.js";
import { runCuratorAgent } from "../agents/curator.js";
import { runScoringAuditorAgent } from "../agents/scoring-auditor.js";
import { runSimulatorAgent } from "../agents/simulator.js";
import { runDeployerAgent } from "../agents/deployer.js";
import { runTrendAnalystAgent } from "../agents/trend-analyst.js";
import { runMetaEvaluatorAgent } from "../agents/meta-evaluator.js";
import { runStrategyManagerAgent } from "../agents/strategy-manager.js";

const AGENT_IDS = [
  "curator-ai",
  "scoring-auditor-ai",
  "simulator-ai",
  "deployer-ai",
  "trend-analyst-ai",
  "meta-evaluator-ai",
  "strategy-manager-ai"
];

async function loadAutonomySnapshot({ db }) {
  const [activeConfig, recentEvaluations, recentLogs, recentQuestionProposals, recentScoringProposals, recentTrendReports] = await Promise.all([
    loadSingleDoc(db, COLLECTIONS.activeConfig, "current"),
    loadCollectionDocs(db, COLLECTIONS.evaluationRuns, 5),
    loadCollectionDocs(db, COLLECTIONS.agentLogs, 8),
    loadCollectionDocs(db, COLLECTIONS.questionProposals, 5),
    loadCollectionDocs(db, COLLECTIONS.scoringProposals, 5),
    loadCollectionDocs(db, COLLECTIONS.trendReports, 3)
  ]);

  return {
    activeConfig,
    recentEvaluations,
    recentLogs,
    recentQuestionProposals,
    recentScoringProposals,
    recentTrendReports
  };
}

async function runAutonomyCycle({ db, surveyDefinition, surveyVersion }) {
  await ensureBootstrap(db, surveyVersion);

  const submissions = await loadCollectionDocs(db, "surveyResponses", 120);
  if (!submissions.length) {
    await addDoc(collection(db, COLLECTIONS.agentLogs), createAgentLogDoc({
      agent: "system",
      action: "autonomy_cycle_skipped",
      target: "surveyResponses",
      summary: "No survey responses were available for the autonomy cycle."
    }));

    return {
      ok: false,
      reason: "no-submissions",
      snapshot: await loadAutonomySnapshot({ db })
    };
  }

  const anchorQuestionIds = getAnchorQuestions().map((question) => question.questionId);
  const questionDiagnostics = buildQuestionDiagnostics(submissions, surveyDefinition.questions);
  const scoringDiagnostics = buildScoringDiagnostics(submissions);

  const questionProposals = runCuratorAgent({ questionDiagnostics });
  const scoringProposals = runScoringAuditorAgent({ scoringDiagnostics });

  await Promise.all([
    ...questionProposals.map((proposal) => addDoc(collection(db, COLLECTIONS.questionProposals), proposal)),
    ...scoringProposals.map((proposal) => addDoc(collection(db, COLLECTIONS.scoringProposals), proposal))
  ]);

  const candidateSurveyVersion = questionProposals.length
    ? createQuestionVersionDoc({
        versionId: `survey-candidate-${Date.now()}`,
        basedOn: surveyVersion,
        questions: surveyDefinition.questions,
        createdBy: "curator-ai",
        status: VERSION_STATUS.candidate
      })
    : null;

  const candidateScoringVersion = scoringProposals.length
    ? createScoringVersionDoc({
        versionId: `scoring-candidate-${Date.now()}`,
        basedOn: "scoring-v1",
        rules: {
          derivedFromProposals: scoringProposals.map((proposal) => ({
            targetRule: proposal.targetRule,
            proposedChange: proposal.proposedChange
          }))
        },
        createdBy: "scoring-auditor-ai",
        status: VERSION_STATUS.candidate
      })
    : null;

  if (candidateSurveyVersion) {
    await addDoc(collection(db, COLLECTIONS.questionVersions), candidateSurveyVersion);
  }
  if (candidateScoringVersion) {
    await addDoc(collection(db, COLLECTIONS.scoringVersions), candidateScoringVersion);
  }

  const activeConfig = await loadSingleDoc(db, COLLECTIONS.activeConfig, "current");
  const baselineSurvey = activeConfig?.activeSurveyVersion || surveyVersion;
  const baselineScoring = activeConfig?.activeScoringVersion || "scoring-v1";

  const evaluationRun = runSimulatorAgent({
    runId: `eval-${Date.now()}`,
    surveyCandidate: candidateSurveyVersion?.versionId || baselineSurvey,
    scoringCandidate: candidateScoringVersion?.versionId || baselineScoring,
    baselineSurvey,
    baselineScoring,
    baselineSubmissions: submissions,
    candidateSubmissions: submissions,
    anchorQuestionIds
  });
  await addDoc(collection(db, COLLECTIONS.evaluationRuns), evaluationRun);

  const liveMetrics = buildEvaluationMetrics({
    baselineSubmissions: submissions,
    candidateSubmissions: submissions,
    anchorQuestionIds
  });
  const healthSnapshot = buildHealthSnapshot({
    baselineMetrics: evaluationRun.metrics,
    liveMetrics: {
      ...liveMetrics,
      scoringAnomalyRate: scoringDiagnostics.filter((item) => item.severity >= 0.7).length
    }
  });

  const deployerLog = runDeployerAgent({ evaluationRun, healthSnapshot });
  await addDoc(collection(db, COLLECTIONS.agentLogs), deployerLog);

  const trendReport = runTrendAnalystAgent({
    reportId: `trend-${Date.now()}`,
    submissions,
    providerBreakdown: buildProviderBreakdown(submissions)
  });
  await addDoc(collection(db, COLLECTIONS.trendReports), trendReport);

  const metaEvaluation = runMetaEvaluatorAgent({
    evaluationId: `meta-${Date.now()}`,
    targetAgent: "curator-ai",
    proposalOutcomes: [
      ...questionProposals.map(() => ({ result: evaluationRun.decision === "promote" ? "promoted" : "rejected" })),
      ...scoringProposals.map(() => ({ result: evaluationRun.decision === "promote" ? "promoted" : "rejected" }))
    ]
  });
  await addDoc(collection(db, COLLECTIONS.metaEvaluations), metaEvaluation);

  const strategyExperiment = runStrategyManagerAgent({
    experimentId: `strategy-${Date.now()}`,
    agentId: "curator-ai",
    baselineProfile: await ensureAgentProfile(db, "curator-ai"),
    recentMetaEvaluation: metaEvaluation
  });
  await addDoc(collection(db, COLLECTIONS.strategyExperiments), strategyExperiment);

  await appendAgentMemory(db, "curator-ai", {
    type: "cycle-summary",
    evaluationRunId: evaluationRun.runId,
    questionProposalCount: questionProposals.length,
    scoringProposalCount: scoringProposals.length,
    decision: evaluationRun.decision,
    createdAt: new Date().toISOString()
  });

  return {
    ok: true,
    questionProposalCount: questionProposals.length,
    scoringProposalCount: scoringProposals.length,
    evaluationRun,
    trendReport,
    snapshot: await loadAutonomySnapshot({ db })
  };
}

async function ensureBootstrap(db, surveyVersion) {
  const activeConfigRef = doc(db, COLLECTIONS.activeConfig, "current");
  const activeConfigSnap = await getDoc(activeConfigRef);
  if (!activeConfigSnap.exists()) {
    await setDoc(activeConfigRef, createActiveConfigDoc({
      activeSurveyVersion: surveyVersion,
      activeScoringVersion: "scoring-v1",
      previousSurveyVersion: null,
      previousScoringVersion: null
    }));
  }

  await Promise.all(AGENT_IDS.map((agentId) => ensureAgentProfile(db, agentId)));
}

async function ensureAgentProfile(db, agentId) {
  const profileRef = doc(db, COLLECTIONS.agentProfiles, agentId);
  const profileSnap = await getDoc(profileRef);
  if (profileSnap.exists()) {
    return profileSnap.data();
  }

  const profile = createAgentProfileDoc({
    agentId,
    strategyType: "baseline",
    strengths: [],
    weaknesses: [],
    currentObjectives: ["stabilize baseline metrics", "avoid unsafe promotion"]
  });
  await setDoc(profileRef, profile);
  await setDoc(doc(db, COLLECTIONS.agentMemory, agentId), createAgentMemoryDoc({
    agentId,
    memoryEntries: []
  }));
  return profile;
}

async function appendAgentMemory(db, agentId, entry) {
  const memoryRef = doc(db, COLLECTIONS.agentMemory, agentId);
  const memorySnap = await getDoc(memoryRef);
  const currentEntries = memorySnap.exists() ? memorySnap.data().memoryEntries || [] : [];
  await setDoc(memoryRef, createAgentMemoryDoc({
    agentId,
    memoryEntries: [entry, ...currentEntries].slice(0, 30)
  }));
}

async function loadSingleDoc(db, collectionName, documentId) {
  const snapshot = await getDoc(doc(db, collectionName, documentId));
  return snapshot.exists() ? snapshot.data() : null;
}

async function loadCollectionDocs(db, collectionName, size) {
  const snapshot = await getDocs(query(
    collection(db, collectionName),
    orderBy("createdAt", "desc"),
    limit(size)
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function buildQuestionDiagnostics(submissions, questions) {
  return questions.map((question) => {
    const responses = submissions
      .flatMap((submission) => submission.questionResponses || [])
      .filter((response) => response.questionId === question.questionId);

    const coverageRate = responses.length
      ? round((responses.filter((response) => response.completeness === "answered").length / responses.length) * 100)
      : 0;
    const nonAnswerRate = responses.length
      ? round((responses.filter((response) => response.completeness === "non-answer").length / responses.length) * 100)
      : 0;
    const discriminationScore = responses.length
      ? round(variance(responses.map((response) => response.score?.overall || 0)))
      : 0;

    return {
      questionId: question.questionId,
      primaryAxis: question.primaryAxis,
      secondaryAxes: question.secondaryAxes,
      mutable: question.mutable,
      coverageRate,
      nonAnswerRate,
      discriminationScore,
      suggestedQuestionText: coverageRate < 70
        ? `${question.questionText}\n단, 핵심 이유를 2문장 이내로 설명하시오.`
        : `${question.questionText}\n단, 근거 또는 제약 인식을 한 문장 추가하시오.`,
      reason: nonAnswerRate > 20
        ? "High non-answer rate suggests the wording is too weak or ambiguous."
        : "Low discrimination suggests the question needs a sharper behavioral signal."
    };
  });
}

function buildScoringDiagnostics(submissions) {
  const responses = submissions.flatMap((submission) => submission.questionResponses || []);
  const nonAnswers = responses.filter((response) => response.completeness === "non-answer");
  const diagnostics = [];

  if (nonAnswers.length) {
    const averageOverall = round(average(nonAnswers.map((response) => response.score?.overall || 0)));
    diagnostics.push({
      targetRule: "non_answer_detection",
      severity: averageOverall >= 10 ? 0.95 : 0.45,
      reason: `Non-answer responses still average ${averageOverall} overall score.`,
      proposedChange: {
        rule: "punctuation-only, skip/pass, and ultra-short filler responses should remain under strict floor scores"
      }
    });
  }

  const weakResponses = responses.filter((response) => response.answerQuality === "weak");
  if (weakResponses.length) {
    diagnostics.push({
      targetRule: "minimum_validity_threshold",
      severity: 0.72,
      reason: `${weakResponses.length} weak answers were detected that may still receive unstable partial credit.`,
      proposedChange: {
        rule: "apply question-type minimum validity before awarding substantive descriptive scores"
      }
    });
  }

  return diagnostics;
}

function buildProviderBreakdown(submissions) {
  return submissions.reduce((accumulator, submission) => {
    const provider = submission.providerName || "Unknown";
    accumulator[provider] = (accumulator[provider] || 0) + 1;
    return accumulator;
  }, {});
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function variance(values) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
}

function round(value) {
  return Math.round(value);
}

export { runAutonomyCycle, loadAutonomySnapshot };
