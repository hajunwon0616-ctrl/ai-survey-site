function renderAutonomySnapshot(elements, snapshot) {
  if (!snapshot) {
    return;
  }

  elements.autonomyActiveConfig.innerHTML = "";
  renderKeyValue(elements.autonomyActiveConfig, "Active Survey", snapshot.activeConfig?.activeSurveyVersion || "not set");
  renderKeyValue(elements.autonomyActiveConfig, "Active Scoring", snapshot.activeConfig?.activeScoringVersion || "not set");
  renderKeyValue(elements.autonomyActiveConfig, "Previous Survey", snapshot.activeConfig?.previousSurveyVersion || "none");
  renderKeyValue(elements.autonomyActiveConfig, "Previous Scoring", snapshot.activeConfig?.previousScoringVersion || "none");

  renderSimpleList(
    elements.autonomyEvaluations,
    snapshot.recentEvaluations.map((item) => `${item.runId}: ${item.decision} (${item.metrics?.coverageRate ?? 0}% coverage)`)
  );
  renderSimpleList(
    elements.autonomyQuestionProposals,
    snapshot.recentQuestionProposals.map((item) => `${item.proposalType}: ${item.targetQuestionId || item.primaryAxis || "new"} - ${item.reason}`)
  );
  renderSimpleList(
    elements.autonomyScoringProposals,
    snapshot.recentScoringProposals.map((item) => `${item.targetRule}: ${item.reason}`)
  );
  renderSimpleList(
    elements.autonomyLogs,
    snapshot.recentLogs.map((item) => `${item.agent}: ${item.action} - ${item.summary}`)
  );
  renderSimpleList(
    elements.autonomyTrends,
    snapshot.recentTrendReports.map((item) => `${item.reportId}: coverage ${item.metrics?.coverageRate ?? 0}, non-answer ${item.metrics?.nonAnswerRate ?? 0}`)
  );
}

function renderAutonomyStatus(element, message, isError = false) {
  element.textContent = message;
  element.dataset.state = isError ? "error" : "normal";
}

function renderKeyValue(container, label, value) {
  const row = document.createElement("div");
  row.className = "autonomy-kv-row";
  row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
  container.appendChild(row);
}

function renderSimpleList(container, items) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("li");
    empty.textContent = "No entries yet.";
    container.appendChild(empty);
    return;
  }

  items.forEach((itemText) => {
    const item = document.createElement("li");
    item.textContent = itemText;
    container.appendChild(item);
  });
}

export { renderAutonomySnapshot, renderAutonomyStatus };
