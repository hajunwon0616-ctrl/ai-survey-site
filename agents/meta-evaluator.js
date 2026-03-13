import { createMetaEvaluationDoc } from "../data/autonomy-schemas.js";

function runMetaEvaluatorAgent({ evaluationId, targetAgent, proposalOutcomes, createdBy = "meta-evaluator-ai" }) {
  const promoted = proposalOutcomes.filter((item) => item.result === "promoted").length;
  const rolledBack = proposalOutcomes.filter((item) => item.result === "rolled_back").length;
  const rejected = proposalOutcomes.filter((item) => item.result === "rejected").length;

  return createMetaEvaluationDoc({
    evaluationId,
    targetAgent,
    findings: {
      promoted,
      rolledBack,
      rejected,
      successRate: proposalOutcomes.length ? promoted / proposalOutcomes.length : 0,
      createdBy
    },
    proposedAdjustments: buildAgentAdjustments({ promoted, rolledBack, rejected })
  });
}

function buildAgentAdjustments({ promoted, rolledBack, rejected }) {
  if (rolledBack > 0) {
    return ["lower risk tolerance", "reduce aggressive candidate promotion", "increase anchor stability weighting"];
  }
  if (promoted > rejected) {
    return ["slightly increase exploration rate", "keep current strategy family"];
  }
  return ["tighten proposal screening", "increase simulation threshold sensitivity"];
}

export { runMetaEvaluatorAgent };
