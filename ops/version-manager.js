import {
  VERSION_STATUS,
  createActiveConfigDoc,
  createQuestionVersionDoc,
  createScoringVersionDoc
} from "../data/autonomy-schemas.js";

function buildCandidateQuestionVersion({ versionId, basedOn, questions, createdBy }) {
  return createQuestionVersionDoc({
    versionId,
    basedOn,
    questions,
    createdBy,
    status: VERSION_STATUS.candidate
  });
}

function buildCandidateScoringVersion({ versionId, basedOn, rules, createdBy }) {
  return createScoringVersionDoc({
    versionId,
    basedOn,
    rules,
    createdBy,
    status: VERSION_STATUS.candidate
  });
}

function promoteVersionPair({ activeSurveyVersion, activeScoringVersion, previousSurveyVersion, previousScoringVersion }) {
  return createActiveConfigDoc({
    activeSurveyVersion,
    activeScoringVersion,
    previousSurveyVersion,
    previousScoringVersion
  });
}

function rejectCandidate(versionId) {
  return {
    versionId,
    status: VERSION_STATUS.rejected,
    updatedAt: new Date().toISOString()
  };
}

export {
  buildCandidateQuestionVersion,
  buildCandidateScoringVersion,
  promoteVersionPair,
  rejectCandidate
};
