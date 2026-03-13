import { createQuestionProposalDoc } from "../data/autonomy-schemas.js";

function runCuratorAgent({ questionDiagnostics, createdBy = "curator-ai" }) {
  return questionDiagnostics
    .filter((diagnostic) => diagnostic.discriminationScore < 45 && diagnostic.mutable !== false)
    .map((diagnostic, index) => createQuestionProposalDoc({
      proposalId: `qp-${Date.now()}-${index}`,
      targetQuestionId: diagnostic.questionId,
      proposalType: diagnostic.coverageRate < 75 ? "revise_question" : "new_question",
      proposedQuestionText: diagnostic.suggestedQuestionText,
      primaryAxis: diagnostic.primaryAxis,
      secondaryAxes: diagnostic.secondaryAxes,
      reason: diagnostic.reason,
      createdBy
    }));
}

export { runCuratorAgent };
