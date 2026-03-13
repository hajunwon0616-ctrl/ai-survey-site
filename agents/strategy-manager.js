import { createStrategyExperimentDoc } from "../data/autonomy-schemas.js";

function runStrategyManagerAgent({ experimentId, agentId, baselineProfile, recentMetaEvaluation }) {
  const strategyDescription = recentMetaEvaluation.findings.successRate >= 0.5
    ? "maintain balanced strategy with slightly higher exploration"
    : "shift to conservative strategy with stronger rollback avoidance";

  return createStrategyExperimentDoc({
    experimentId,
    agentId,
    strategyDescription,
    baseline: baselineProfile,
    result: {
      recommendedExplorationRate: recentMetaEvaluation.findings.successRate >= 0.5 ? 0.24 : 0.12,
      recommendedRiskTolerance: recentMetaEvaluation.findings.rolledBack > 0 ? 0.18 : 0.3
    }
  });
}

export { runStrategyManagerAgent };
