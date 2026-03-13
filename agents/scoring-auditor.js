import { createScoringProposalDoc } from "../data/autonomy-schemas.js";

function runScoringAuditorAgent({ scoringDiagnostics, createdBy = "scoring-auditor-ai" }) {
  return scoringDiagnostics
    .filter((diagnostic) => diagnostic.severity >= 0.6)
    .map((diagnostic, index) => createScoringProposalDoc({
      proposalId: `sp-${Date.now()}-${index}`,
      proposalType: "scoring_change",
      targetRule: diagnostic.targetRule,
      proposedChange: diagnostic.proposedChange,
      reason: diagnostic.reason,
      createdBy
    }));
}

export { runScoringAuditorAgent };
