import { createAgentLogDoc } from "../data/autonomy-schemas.js";
import { shouldRollback } from "../ops/rollback-policy.js";

function runDeployerAgent({ evaluationRun, healthSnapshot, createdBy = "deployer-ai" }) {
  if (evaluationRun.decision !== "promote") {
    return createAgentLogDoc({
      agent: createdBy,
      action: "reject",
      target: `${evaluationRun.surveyCandidate} + ${evaluationRun.scoringCandidate}`,
      summary: "candidate rejected by simulator"
    });
  }

  const rollbackDecision = shouldRollback(healthSnapshot);
  if (rollbackDecision.rollback) {
    return createAgentLogDoc({
      agent: createdBy,
      action: "rollback",
      target: `${evaluationRun.surveyCandidate} + ${evaluationRun.scoringCandidate}`,
      summary: rollbackDecision.reasons.join("; "),
      details: rollbackDecision
    });
  }

  return createAgentLogDoc({
    agent: createdBy,
    action: "promote",
    target: `${evaluationRun.surveyCandidate} + ${evaluationRun.scoringCandidate}`,
    summary: "candidate promoted to active configuration"
  });
}

export { runDeployerAgent };
