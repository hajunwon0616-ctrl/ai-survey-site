import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  normalizeRuntimeQuestion
} from "../survey-metadata.js";
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
  const [
    activeConfig,
    recentEvaluations,
    recentLogs,
    recentQuestionProposals,
    recentScoringProposals,
    recentTrendReports,
    agentProfiles,
    agentMemories,
    recentMetaEvaluations,
    recentStrategyExperiments
  ] = await Promise.all([
    loadSingleDoc(db, COLLECTIONS.activeConfig, "current"),
    loadCollectionDocs(db, COLLECTIONS.evaluationRuns, 5),
    loadCollectionDocs(db, COLLECTIONS.agentLogs, 14),
    loadCollectionDocs(db, COLLECTIONS.questionProposals, 6),
    loadCollectionDocs(db, COLLECTIONS.scoringProposals, 6),
    loadCollectionDocs(db, COLLECTIONS.trendReports, 4),
    loadCollectionDocs(db, COLLECTIONS.agentProfiles, 8, "updatedAt"),
    loadCollectionDocs(db, COLLECTIONS.agentMemory, 8, "updatedAt"),
    loadCollectionDocs(db, COLLECTIONS.metaEvaluations, 4),
    loadCollectionDocs(db, COLLECTIONS.strategyExperiments, 4)
  ]);

  const activeSurveyDetails = activeConfig?.activeSurveyVersion
    ? await loadSingleDoc(db, COLLECTIONS.questionVersions, activeConfig.activeSurveyVersion)
    : null;

  return {
    activeConfig,
    activeSurveyDetails,
    recentEvaluations,
    recentLogs,
    recentQuestionProposals,
    recentScoringProposals,
    recentTrendReports,
    recentMetaEvaluations,
    recentStrategyExperiments,
    agentProfiles,
    agentMemories
  };
}

async function runAutonomyCycle({ db, surveyDefinition, surveyVersion }) {
  await ensureBootstrap(db, surveyDefinition, surveyVersion);

  const cycleId = `cycle-${Date.now()}`;
  await saveAgentLog(db, createAgentLogDoc({
    agent: "system",
    action: "cycle_start",
    target: cycleId,
    summary: `Autonomy cycle started for ${surveyVersion}.`
  }));

  const submissions = await loadCollectionDocs(db, "surveyResponses", 120);
  if (!submissions.length) {
    await saveAgentLog(db, createAgentLogDoc({
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

  const activeConfig = await loadSingleDoc(db, COLLECTIONS.activeConfig, "current");
  const baselineSurvey = activeConfig?.activeSurveyVersion || surveyVersion;
  const baselineScoring = activeConfig?.activeScoringVersion || "scoring-v1";
  const anchorQuestionIds = surveyDefinition.questions
    .filter((question) => question.anchor)
    .map((question) => question.questionId);
  const candidateSurveyVersionId = `survey-auto-${Date.now()}`;
  const candidateScoringVersionId = `scoring-auto-${Date.now()}`;

  const questionDiagnostics = buildQuestionDiagnostics(submissions, surveyDefinition.questions);
  const scoringDiagnostics = buildScoringDiagnostics(submissions);

  const questionProposals = runCuratorAgent({ questionDiagnostics });
  const scoringProposals = runScoringAuditorAgent({ scoringDiagnostics });

  await Promise.all([
    ...questionProposals.map((proposal) => saveDocument(db, COLLECTIONS.questionProposals, proposal.proposalId, proposal)),
    ...scoringProposals.map((proposal) => saveDocument(db, COLLECTIONS.scoringProposals, proposal.proposalId, proposal))
  ]);

  await Promise.all([
    saveAgentLog(db, createAgentLogDoc({
      agent: "curator-ai",
      action: "proposal_batch",
      target: baselineSurvey,
      summary: `${questionProposals.length} question proposal(s) generated.`,
      details: {
        proposalIds: questionProposals.map((item) => item.proposalId),
        targetQuestions: questionProposals.map((item) => item.targetQuestionId || "new")
      }
    })),
    saveAgentLog(db, createAgentLogDoc({
      agent: "scoring-auditor-ai",
      action: "proposal_batch",
      target: baselineScoring,
      summary: `${scoringProposals.length} scoring proposal(s) generated.`,
      details: {
        proposalIds: scoringProposals.map((item) => item.proposalId),
        targetRules: scoringProposals.map((item) => item.targetRule)
      }
    }))
  ]);

  const candidateSurveyVersion = questionProposals.length
    ? createQuestionVersionDoc({
        versionId: candidateSurveyVersionId,
        basedOn: baselineSurvey,
        title: surveyDefinition.title,
        axes: surveyDefinition.axes,
        questions: buildCandidateQuestionSet({
          baseQuestions: surveyDefinition.questions,
          proposals: questionProposals,
          versionId: candidateSurveyVersionId
        }),
        createdBy: "curator-ai",
        status: VERSION_STATUS.candidate
      })
    : null;

  const candidateScoringVersion = scoringProposals.length
    ? createScoringVersionDoc({
        versionId: candidateScoringVersionId,
        basedOn: baselineScoring,
        rules: {
          derivedFromProposals: scoringProposals.map((proposal) => ({
            proposalId: proposal.proposalId,
            targetRule: proposal.targetRule,
            proposedChange: proposal.proposedChange
          }))
        },
        createdBy: "scoring-auditor-ai",
        status: VERSION_STATUS.candidate
      })
    : null;

  if (candidateSurveyVersion) {
    candidateSurveyVersion.questions = buildCandidateQuestionSet({
      baseQuestions: surveyDefinition.questions,
      proposals: questionProposals,
      versionId: candidateSurveyVersion.versionId
    });
    candidateSurveyVersion.questionCount = candidateSurveyVersion.questions.length;
    candidateSurveyVersion.anchorCount = candidateSurveyVersion.questions.filter((question) => question.anchor).length;
    await saveDocument(db, COLLECTIONS.questionVersions, candidateSurveyVersion.versionId, candidateSurveyVersion);
  }

  if (candidateScoringVersion) {
    await saveDocument(db, COLLECTIONS.scoringVersions, candidateScoringVersion.versionId, candidateScoringVersion);
  }

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

  await saveDocument(db, COLLECTIONS.evaluationRuns, evaluationRun.runId, evaluationRun);
  await saveAgentLog(db, createAgentLogDoc({
    agent: "simulator-ai",
    action: "evaluation_run",
    target: evaluationRun.runId,
    summary: `Decision: ${evaluationRun.decision}. Coverage ${evaluationRun.metrics.coverageRate}, discrimination ${evaluationRun.metrics.questionDiscrimination}.`,
    details: evaluationRun.metrics
  }));

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
  await saveAgentLog(db, deployerLog);

  const deploymentStatus = await applyDeploymentResult(db, {
    deployerLog,
    baselineSurvey,
    baselineScoring,
    candidateSurveyVersion,
    candidateScoringVersion,
    activeConfig,
    questionProposals,
    scoringProposals
  });

  const trendReport = runTrendAnalystAgent({
    reportId: `trend-${Date.now()}`,
    submissions,
    providerBreakdown: buildProviderBreakdown(submissions)
  });
  await saveDocument(db, COLLECTIONS.trendReports, trendReport.reportId, trendReport);
  await saveAgentLog(db, createAgentLogDoc({
    agent: "trend-analyst-ai",
    action: "trend_report",
    target: trendReport.reportId,
    summary: trendReport.summary,
    details: trendReport.metrics
  }));

  const metaEvaluation = runMetaEvaluatorAgent({
    evaluationId: `meta-${Date.now()}`,
    targetAgent: "curator-ai",
    proposalOutcomes: [
      ...questionProposals.map(() => ({ result: deploymentStatus.proposalOutcome })),
      ...scoringProposals.map(() => ({ result: deploymentStatus.proposalOutcome }))
    ]
  });
  await saveDocument(db, COLLECTIONS.metaEvaluations, metaEvaluation.evaluationId, metaEvaluation);
  await saveAgentLog(db, createAgentLogDoc({
    agent: "meta-evaluator-ai",
    action: "meta_evaluation",
    target: metaEvaluation.targetAgent,
    summary: `Success rate ${Math.round((metaEvaluation.findings.successRate || 0) * 100)}%.`,
    details: metaEvaluation
  }));

  const baselineProfile = await ensureAgentProfile(db, "curator-ai");
  const strategyExperiment = runStrategyManagerAgent({
    experimentId: `strategy-${Date.now()}`,
    agentId: "curator-ai",
    baselineProfile,
    recentMetaEvaluation: metaEvaluation
  });
  await saveDocument(db, COLLECTIONS.strategyExperiments, strategyExperiment.experimentId, strategyExperiment);
  await updateAgentProfileFromStrategy(db, baselineProfile, strategyExperiment);
  await saveAgentLog(db, createAgentLogDoc({
    agent: "strategy-manager-ai",
    action: "strategy_update",
    target: strategyExperiment.agentId,
    summary: strategyExperiment.strategyDescription,
    details: strategyExperiment.result
  }));

  await Promise.all([
    appendAgentMemory(db, "curator-ai", {
      type: "cycle-summary",
      evaluationRunId: evaluationRun.runId,
      proposalCount: questionProposals.length,
      decision: evaluationRun.decision,
      deploymentStatus: deploymentStatus.proposalOutcome,
      createdAt: new Date().toISOString()
    }),
    appendAgentMemory(db, "scoring-auditor-ai", {
      type: "scoring-audit",
      proposalCount: scoringProposals.length,
      targetRules: scoringProposals.map((proposal) => proposal.targetRule),
      createdAt: new Date().toISOString()
    }),
    appendAgentMemory(db, "simulator-ai", {
      type: "evaluation",
      evaluationRunId: evaluationRun.runId,
      metrics: evaluationRun.metrics,
      createdAt: new Date().toISOString()
    })
  ]);

  await saveAgentLog(db, createAgentLogDoc({
    agent: "system",
    action: "cycle_complete",
    target: cycleId,
    summary: `Autonomy cycle finished with ${deploymentStatus.proposalOutcome}.`,
    details: {
      evaluationRunId: evaluationRun.runId,
      activeSurveyVersion: deploymentStatus.activeSurveyVersion,
      activeScoringVersion: deploymentStatus.activeScoringVersion
    }
  }));

  return {
    ok: true,
    questionProposalCount: questionProposals.length,
    scoringProposalCount: scoringProposals.length,
    evaluationRun,
    trendReport,
    deploymentStatus,
    snapshot: await loadAutonomySnapshot({ db })
  };
}

async function ensureBootstrap(db, surveyDefinition, surveyVersion) {
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

  const surveyVersionRef = doc(db, COLLECTIONS.questionVersions, surveyVersion);
  const surveyVersionSnap = await getDoc(surveyVersionRef);
  if (!surveyVersionSnap.exists()) {
    await setDoc(surveyVersionRef, createQuestionVersionDoc({
      versionId: surveyVersion,
      basedOn: null,
      title: surveyDefinition.title,
      axes: surveyDefinition.axes,
      questions: surveyDefinition.questions,
      createdBy: "system",
      status: VERSION_STATUS.active
    }));
  }

  const scoringVersionRef = doc(db, COLLECTIONS.scoringVersions, "scoring-v1");
  const scoringVersionSnap = await getDoc(scoringVersionRef);
  if (!scoringVersionSnap.exists()) {
    await setDoc(scoringVersionRef, createScoringVersionDoc({
      versionId: "scoring-v1",
      basedOn: null,
      rules: {
        description: "Baseline local scoring rules"
      },
      createdBy: "system",
      status: VERSION_STATUS.active
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

async function updateAgentProfileFromStrategy(db, baselineProfile, strategyExperiment) {
  const profileRef = doc(db, COLLECTIONS.agentProfiles, strategyExperiment.agentId);
  await setDoc(profileRef, {
    ...baselineProfile,
    strategyType: strategyExperiment.strategyDescription,
    explorationRate: strategyExperiment.result.recommendedExplorationRate,
    riskTolerance: strategyExperiment.result.recommendedRiskTolerance,
    currentObjectives: [
      "improve proposal quality",
      "protect anchor comparability",
      "avoid unstable promotion"
    ],
    updatedAt: new Date().toISOString()
  });
}

async function applyDeploymentResult(db, payload) {
  const {
    deployerLog,
    baselineSurvey,
    baselineScoring,
    candidateSurveyVersion,
    candidateScoringVersion,
    activeConfig,
    questionProposals,
    scoringProposals
  } = payload;

  const activeSurveyVersion = activeConfig?.activeSurveyVersion || baselineSurvey;
  const activeScoringVersion = activeConfig?.activeScoringVersion || baselineScoring;

  if (deployerLog.action === "promote") {
    const nextSurveyVersion = candidateSurveyVersion?.versionId || activeSurveyVersion;
    const nextScoringVersion = candidateScoringVersion?.versionId || activeScoringVersion;

    await setDoc(doc(db, COLLECTIONS.activeConfig, "current"), createActiveConfigDoc({
      activeSurveyVersion: nextSurveyVersion,
      activeScoringVersion: nextScoringVersion,
      previousSurveyVersion: activeSurveyVersion,
      previousScoringVersion: activeScoringVersion
    }));

    if (candidateSurveyVersion) {
      await saveDocument(db, COLLECTIONS.questionVersions, candidateSurveyVersion.versionId, {
        ...candidateSurveyVersion,
        status: VERSION_STATUS.active,
        updatedAt: new Date().toISOString()
      });
    }
    if (candidateScoringVersion) {
      await saveDocument(db, COLLECTIONS.scoringVersions, candidateScoringVersion.versionId, {
        ...candidateScoringVersion,
        status: VERSION_STATUS.active,
        updatedAt: new Date().toISOString()
      });
    }

    await Promise.all([
      ...questionProposals.map((proposal) => saveDocument(db, COLLECTIONS.questionProposals, proposal.proposalId, {
        ...proposal,
        status: VERSION_STATUS.promoted
      })),
      ...scoringProposals.map((proposal) => saveDocument(db, COLLECTIONS.scoringProposals, proposal.proposalId, {
        ...proposal,
        status: VERSION_STATUS.promoted
      }))
    ]);

    return {
      proposalOutcome: VERSION_STATUS.promoted,
      activeSurveyVersion: nextSurveyVersion,
      activeScoringVersion: nextScoringVersion
    };
  }

  const rejectedStatus = deployerLog.action === "rollback" ? VERSION_STATUS.rolledBack : VERSION_STATUS.rejected;
  if (candidateSurveyVersion) {
    await saveDocument(db, COLLECTIONS.questionVersions, candidateSurveyVersion.versionId, {
      ...candidateSurveyVersion,
      status: rejectedStatus,
      updatedAt: new Date().toISOString()
    });
  }
  if (candidateScoringVersion) {
    await saveDocument(db, COLLECTIONS.scoringVersions, candidateScoringVersion.versionId, {
      ...candidateScoringVersion,
      status: rejectedStatus,
      updatedAt: new Date().toISOString()
    });
  }

  await Promise.all([
    ...questionProposals.map((proposal) => saveDocument(db, COLLECTIONS.questionProposals, proposal.proposalId, {
      ...proposal,
      status: rejectedStatus
    })),
    ...scoringProposals.map((proposal) => saveDocument(db, COLLECTIONS.scoringProposals, proposal.proposalId, {
      ...proposal,
      status: rejectedStatus
    }))
  ]);

  return {
    proposalOutcome: rejectedStatus,
    activeSurveyVersion,
    activeScoringVersion
  };
}

async function saveAgentLog(db, log) {
  const identifier = `${log.agent}-${log.action}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await saveDocument(db, COLLECTIONS.agentLogs, identifier, log);
}

async function saveDocument(db, collectionName, documentId, payload) {
  await setDoc(doc(db, collectionName, documentId), payload);
}

async function loadSingleDoc(db, collectionName, documentId) {
  const snapshot = await getDoc(doc(db, collectionName, documentId));
  return snapshot.exists() ? snapshot.data() : null;
}

async function loadCollectionDocs(db, collectionName, size, orderField = "createdAt") {
  const snapshot = await getDocs(query(
    collection(db, collectionName),
    orderBy(orderField, "desc"),
    limit(size)
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function buildCandidateQuestionSet({ baseQuestions, proposals, versionId }) {
  const questions = baseQuestions.map((question) => normalizeRuntimeQuestion({
    ...question,
    version: versionId
  }, versionId));

  let nextNumericId = getMaxQuestionIndex(questions) + 1;

  proposals.forEach((proposal) => {
    if (proposal.proposalType === "revise_question" && proposal.targetQuestionId) {
      const target = questions.find((question) => question.questionId === proposal.targetQuestionId);
      if (!target) {
        return;
      }

      target.questionText = proposal.proposedQuestionText;
      target.version = versionId;
      target.lastProposalId = proposal.proposalId;
      target.updatedBy = proposal.createdBy;
      return;
    }

    const nextId = `Q${nextNumericId}`;
    nextNumericId += 1;
    questions.push(normalizeRuntimeQuestion({
      questionId: nextId,
      questionNumber: nextId,
      questionText: proposal.proposedQuestionText,
      primaryAxis: proposal.primaryAxis || "Cognitive Structure",
      secondaryAxes: proposal.secondaryAxes || [],
      constraints: {},
      traits: {},
      version: versionId,
      active: true,
      anchor: false,
      mutable: true,
      generatedBy: proposal.createdBy,
      sourceProposalId: proposal.proposalId
    }, versionId));
  });

  return questions;
}

function getMaxQuestionIndex(questions) {
  return questions.reduce((maxValue, question) => {
    const match = /^Q(\d+)/.exec(question.questionId || "");
    const numeric = match ? Number(match[1]) : 0;
    return Math.max(maxValue, numeric);
  }, 0);
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
