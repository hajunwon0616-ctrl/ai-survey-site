function shouldRollback(healthSnapshot) {
  const reasons = [];

  if (healthSnapshot.coverageRateDrop >= 5) {
    reasons.push("coverage rate dropped by 5 or more points");
  }
  if (healthSnapshot.missingRateIncrease >= 5) {
    reasons.push("missing rate increased sharply");
  }
  if (healthSnapshot.anchorQuestionStability < 70) {
    reasons.push("anchor question stability fell below safe threshold");
  }
  if (healthSnapshot.scoringAnomalyRate > 10) {
    reasons.push("scoring anomaly rate exceeded threshold");
  }

  return {
    rollback: reasons.length > 0,
    reasons
  };
}

export { shouldRollback };
