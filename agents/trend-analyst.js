import { createTrendReportDoc } from "../data/autonomy-schemas.js";
import { calculateAxisVariance, calculateCoverageRate, calculateMissingRate, calculateNonAnswerRate } from "../ops/metrics.js";

function runTrendAnalystAgent({ reportId, submissions, providerBreakdown = {}, createdBy = "trend-analyst-ai" }) {
  const metrics = {
    coverageRate: calculateCoverageRate(submissions),
    missingRate: calculateMissingRate(submissions),
    nonAnswerRate: calculateNonAnswerRate(submissions),
    axisVariance: calculateAxisVariance(submissions),
    providerBreakdown,
    createdBy
  };

  return createTrendReportDoc({
    reportId,
    summary: "Long-term submission trends and drift indicators were computed from recent analysis data.",
    metrics
  });
}

export { runTrendAnalystAgent };
