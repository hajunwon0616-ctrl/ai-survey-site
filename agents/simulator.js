import { createEvaluationRunDoc } from "../data/autonomy-schemas.js";
import { buildEvaluationMetrics } from "../ops/metrics.js";
import { evaluatePromotion } from "../ops/rollout-policy.js";

function runSimulatorAgent({
  runId,
  surveyCandidate,
  scoringCandidate,
  baselineSurvey,
  baselineScoring,
  baselineSubmissions,
  candidateSubmissions,
  anchorQuestionIds = [],
  createdBy = "simulator-ai"
}) {
  const metrics = buildEvaluationMetrics({
    baselineSubmissions,
    candidateSubmissions,
    anchorQuestionIds
  });
  const evaluation = evaluatePromotion(metrics);

  return createEvaluationRunDoc({
    runId,
    surveyCandidate,
    scoringCandidate,
    baselineSurvey,
    baselineScoring,
    metrics,
    decision: evaluation.decision,
    createdBy
  });
}

export { runSimulatorAgent };
