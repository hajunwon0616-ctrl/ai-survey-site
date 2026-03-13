function buildHealthSnapshot({ baselineMetrics, liveMetrics }) {
  return {
    coverageRateDrop: Math.max(0, (baselineMetrics.coverageRate || 0) - (liveMetrics.coverageRate || 0)),
    missingRateIncrease: Math.max(0, (liveMetrics.missingRate || 0) - (baselineMetrics.missingRate || 0)),
    anchorQuestionStability: liveMetrics.anchorQuestionStability || 0,
    scoringAnomalyRate: liveMetrics.scoringAnomalyRate || 0,
    generatedAt: new Date().toISOString()
  };
}

export { buildHealthSnapshot };
