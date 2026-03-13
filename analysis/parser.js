function parseSurveyResponse(rawResponse, surveyDefinition) {
  if (!rawResponse) {
    throw new Error("AI의 전체 답변 텍스트를 입력해 주세요.");
  }

  const normalized = rawResponse.replace(/\r/g, "");
  const endIndex = normalized.indexOf("[END OF SURVEY]");
  const truncated = endIndex >= 0 ? normalized.slice(0, endIndex) : normalized;
  const headerPattern = /^Q\d+(?:-\d+)?:/gm;
  const matches = [...truncated.matchAll(headerPattern)];

  if (!matches.length) {
    throw new Error("`Q1:` 형식의 질문 헤더를 찾지 못했습니다.");
  }

  const answers = [];
  const answersByQuestion = {};
  const duplicateQuestionIds = [];
  const emptyAnswerQuestionIds = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const currentHeader = match[0];
    const questionId = currentHeader.slice(0, -1);
    const answerStart = match.index + currentHeader.length;
    const answerEnd = index + 1 < matches.length ? matches[index + 1].index : truncated.length;
    const answerText = truncated.slice(answerStart, answerEnd).trim();

    if (!answerText) {
      emptyAnswerQuestionIds.push(questionId);
    }

    if (Object.prototype.hasOwnProperty.call(answersByQuestion, questionId)) {
      duplicateQuestionIds.push(questionId);
    }

    answersByQuestion[questionId] = answerText;
    answers.push({
      questionId,
      questionNumber: questionId,
      answerText
    });
  }

  const expectedIds = surveyDefinition.questions.map((question) => question.questionId);
  const parsedIds = answers.map((answer) => answer.questionId);
  const missingQuestionIds = expectedIds.filter((id) => !parsedIds.includes(id));
  const unansweredQuestionIds = [...new Set([
    ...missingQuestionIds,
    ...emptyAnswerQuestionIds
  ])];
  const unexpectedQuestionIds = parsedIds.filter((id) => !expectedIds.includes(id));
  const formatIssues = [];

  if (!normalized.includes("Q1:")) {
    formatIssues.push("Q1 헤더가 없습니다.");
  }

  if (endIndex < 0) {
    formatIssues.push("[END OF SURVEY] 마커가 없습니다.");
  }

  if (duplicateQuestionIds.length) {
    formatIssues.push(`중복 질문: ${[...new Set(duplicateQuestionIds)].join(", ")}`);
  }

  if (emptyAnswerQuestionIds.length) {
    formatIssues.push(`빈 답변 질문: ${[...new Set(emptyAnswerQuestionIds)].join(", ")}`);
  }

  if (unexpectedQuestionIds.length) {
    formatIssues.push(`예상 외 질문 ID: ${unexpectedQuestionIds.join(", ")}`);
  }

  const answeredCount = answers.filter((answer) => answer.answerText).length;

  return {
    answers,
    answersByQuestion,
    rawLength: rawResponse.length,
    headerCount: answers.length,
    parsedCount: answeredCount,
    missingCount: unansweredQuestionIds.length,
    coverageRate: round((answeredCount / expectedIds.length) * 100),
    detectedEndMarker: endIndex >= 0,
    missingQuestionIds,
    emptyAnswerQuestionIds: [...new Set(emptyAnswerQuestionIds)],
    unansweredQuestionIds,
    duplicateQuestionIds: [...new Set(duplicateQuestionIds)],
    unexpectedQuestionIds,
    formatIssues
  };
}

function round(value) {
  return Math.round(value);
}

export { parseSurveyResponse };
