function calculateCoverageRate(submissions) {
  if (!submissions.length) return 0;
  return round(average(submissions.map((item) => item.parserSummary?.coverageRate || 0)));
}

function calculateMissingRate(submissions) {
  if (!submissions.length) return 0;
  return round(average(submissions.map((item) => {
    const total = item.analysisMeta?.totalQuestions || 60;
    return ((item.parserSummary?.missingCount || 0) / total) * 100;
  })));
}

function calculateNonAnswerRate(submissions) {
  const responses = submissions.flatMap((item) => item.questionResponses || []);
  if (!responses.length) return 0;
  const nonAnswers = responses.filter((response) => response.completeness === "non-answer").length;
  return round((nonAnswers / responses.length) * 100);
}

function calculateAxisVariance(submissions) {
  const axisKeys = Object.keys(submissions[0]?.axisScores || {});
  if (!axisKeys.length) return 0;
  const variances = axisKeys.map((axis) => variance(submissions.map((item) => item.axisScores?.[axis] || 0)));
  return round(average(variances));
}

function calculateQuestionDiscrimination(submissions) {
  const buckets = new Map();
  submissions.forEach((submission) => {
    (submission.questionResponses || []).forEach((response) => {
      const key = response.questionId;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(response.score?.overall || 0);
    });
  });
  if (!buckets.size) return 0;
  return round(average([...buckets.values()].map((values) => variance(values))));
}

function calculateAnchorQuestionStability(submissions, anchorQuestionIds = []) {
  if (!anchorQuestionIds.length) return 100;
  const anchorScores = anchorQuestionIds.map((questionId) => {
    const values = submissions
      .flatMap((submission) => submission.questionResponses || [])
      .filter((response) => response.questionId === questionId)
      .map((response) => response.score?.overall || 0);
    return values.length ? Math.max(0, 100 - variance(values)) : 100;
  });
  return round(average(anchorScores));
}

function buildEvaluationMetrics({ baselineSubmissions, candidateSubmissions, anchorQuestionIds = [] }) {
  return {
    coverageRate: calculateCoverageRate(candidateSubmissions),
    missingRate: calculateMissingRate(candidateSubmissions),
    nonAnswerRate: calculateNonAnswerRate(candidateSubmissions),
    axisVariance: calculateAxisVariance(candidateSubmissions),
    questionDiscrimination: calculateQuestionDiscrimination(candidateSubmissions),
    anchorQuestionStability: calculateAnchorQuestionStability(candidateSubmissions, anchorQuestionIds),
    baselineCoverageRate: calculateCoverageRate(baselineSubmissions),
    baselineMissingRate: calculateMissingRate(baselineSubmissions),
    baselineAxisVariance: calculateAxisVariance(baselineSubmissions),
    baselineQuestionDiscrimination: calculateQuestionDiscrimination(baselineSubmissions)
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function variance(values) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
}

function round(value) {
  return Math.round(value);
}

export {
  buildEvaluationMetrics,
  calculateCoverageRate,
  calculateMissingRate,
  calculateNonAnswerRate,
  calculateAxisVariance,
  calculateQuestionDiscrimination,
  calculateAnchorQuestionStability
};
