function calculateAxisVector(questionResponses, axes) {
  return axes.reduce((accumulator, axis) => {
    let weightedTotal = 0;
    let totalWeight = 0;

    questionResponses.forEach((response) => {
      if (response.primaryAxis === axis) {
        weightedTotal += response.featureScores[axis];
        totalWeight += 1;
      }

      if (response.secondaryAxes.includes(axis)) {
        weightedTotal += response.featureScores[axis] * 0.5;
        totalWeight += 0.5;
      }

      if (response.completeness === "missing" && (response.primaryAxis === axis || response.secondaryAxes.includes(axis))) {
        weightedTotal -= 8;
      }
    });

    accumulator[axis] = totalWeight ? clamp(weightedTotal / totalWeight) : 0;
    return accumulator;
  }, {});
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export { calculateAxisVector };
