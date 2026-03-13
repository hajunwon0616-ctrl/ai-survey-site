const PROMOTION_THRESHOLDS = {
  minCoverageRate: 80,
  maxMissingRate: 20,
  maxNonAnswerRate: 18,
  minAnchorQuestionStability: 78,
  minQuestionDiscriminationDelta: 0,
  maxCoverageRateDrop: 4
};

function evaluatePromotion(metrics) {
  const reasons = [];

  if (metrics.coverageRate < PROMOTION_THRESHOLDS.minCoverageRate) {
    reasons.push("coverage rate below minimum threshold");
  }
  if (metrics.missingRate > PROMOTION_THRESHOLDS.maxMissingRate) {
    reasons.push("missing rate too high");
  }
  if (metrics.nonAnswerRate > PROMOTION_THRESHOLDS.maxNonAnswerRate) {
    reasons.push("non-answer rate too high");
  }
  if (metrics.anchorQuestionStability < PROMOTION_THRESHOLDS.minAnchorQuestionStability) {
    reasons.push("anchor question stability degraded");
  }
  if ((metrics.coverageRate - metrics.baselineCoverageRate) < -PROMOTION_THRESHOLDS.maxCoverageRateDrop) {
    reasons.push("coverage rate dropped too much from baseline");
  }
  if ((metrics.questionDiscrimination - metrics.baselineQuestionDiscrimination) < PROMOTION_THRESHOLDS.minQuestionDiscriminationDelta) {
    reasons.push("question discrimination did not improve");
  }

  return {
    decision: reasons.length ? "reject" : "promote",
    reasons
  };
}

export { PROMOTION_THRESHOLDS, evaluatePromotion };
