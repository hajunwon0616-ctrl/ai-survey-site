const COLLECTIONS = {
  questionVersions: "questionVersions",
  scoringVersions: "scoringVersions",
  evaluationRuns: "evaluationRuns",
  agentLogs: "agentLogs",
  questionProposals: "questionProposals",
  scoringProposals: "scoringProposals",
  activeConfig: "activeConfig",
  trendReports: "trendReports",
  agentMemory: "agentMemory",
  agentProfiles: "agentProfiles",
  strategyExperiments: "strategyExperiments",
  metaEvaluations: "metaEvaluations"
};

const VERSION_STATUS = {
  active: "active",
  candidate: "candidate",
  simulated: "simulated",
  promoted: "promoted",
  rejected: "rejected",
  archived: "archived",
  rolledBack: "rolled_back"
};

function createQuestionVersionDoc({ versionId, basedOn, questions, createdBy, status = VERSION_STATUS.candidate }) {
  return {
    versionId,
    basedOn,
    questions,
    status,
    createdBy,
    createdAt: new Date().toISOString()
  };
}

function createScoringVersionDoc({ versionId, basedOn, rules, createdBy, status = VERSION_STATUS.candidate }) {
  return {
    versionId,
    basedOn,
    rules,
    status,
    createdBy,
    createdAt: new Date().toISOString()
  };
}

function createEvaluationRunDoc({
  runId,
  surveyCandidate,
  scoringCandidate,
  baselineSurvey,
  baselineScoring,
  metrics,
  decision,
  createdBy
}) {
  return {
    runId,
    surveyCandidate,
    scoringCandidate,
    baselineSurvey,
    baselineScoring,
    metrics,
    decision,
    createdBy,
    createdAt: new Date().toISOString()
  };
}

function createQuestionProposalDoc(payload) {
  return {
    proposalId: payload.proposalId,
    targetQuestionId: payload.targetQuestionId || null,
    proposalType: payload.proposalType,
    proposedQuestionText: payload.proposedQuestionText,
    primaryAxis: payload.primaryAxis || null,
    secondaryAxes: payload.secondaryAxes || [],
    reason: payload.reason,
    status: payload.status || VERSION_STATUS.candidate,
    createdBy: payload.createdBy,
    createdAt: new Date().toISOString()
  };
}

function createScoringProposalDoc(payload) {
  return {
    proposalId: payload.proposalId,
    proposalType: payload.proposalType,
    targetRule: payload.targetRule,
    proposedChange: payload.proposedChange,
    reason: payload.reason,
    status: payload.status || VERSION_STATUS.candidate,
    createdBy: payload.createdBy,
    createdAt: new Date().toISOString()
  };
}

function createAgentLogDoc({ agent, action, target, summary, details = {} }) {
  return {
    agent,
    action,
    target,
    summary,
    details,
    createdAt: new Date().toISOString()
  };
}

function createActiveConfigDoc({ activeSurveyVersion, activeScoringVersion, previousSurveyVersion, previousScoringVersion }) {
  return {
    activeSurveyVersion,
    activeScoringVersion,
    previousSurveyVersion,
    previousScoringVersion,
    updatedAt: new Date().toISOString()
  };
}

function createTrendReportDoc({ reportId, summary, metrics }) {
  return {
    reportId,
    summary,
    metrics,
    createdAt: new Date().toISOString()
  };
}

function createAgentMemoryDoc({ agentId, memoryEntries }) {
  return {
    agentId,
    memoryEntries,
    updatedAt: new Date().toISOString()
  };
}

function createAgentProfileDoc({ agentId, strategyType, strengths, weaknesses, currentObjectives, explorationRate = 0.2, riskTolerance = 0.3 }) {
  return {
    agentId,
    strategyType,
    strengths,
    weaknesses,
    currentObjectives,
    explorationRate,
    riskTolerance,
    updatedAt: new Date().toISOString()
  };
}

function createStrategyExperimentDoc({ experimentId, agentId, strategyDescription, baseline, result }) {
  return {
    experimentId,
    agentId,
    strategyDescription,
    baseline,
    result,
    createdAt: new Date().toISOString()
  };
}

function createMetaEvaluationDoc({ evaluationId, targetAgent, findings, proposedAdjustments }) {
  return {
    evaluationId,
    targetAgent,
    findings,
    proposedAdjustments,
    createdAt: new Date().toISOString()
  };
}

export {
  COLLECTIONS,
  VERSION_STATUS,
  createQuestionVersionDoc,
  createScoringVersionDoc,
  createEvaluationRunDoc,
  createQuestionProposalDoc,
  createScoringProposalDoc,
  createAgentLogDoc,
  createActiveConfigDoc,
  createTrendReportDoc,
  createAgentMemoryDoc,
  createAgentProfileDoc,
  createStrategyExperimentDoc,
  createMetaEvaluationDoc
};
