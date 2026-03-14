function renderAutonomySnapshot(elements, snapshot) {
  if (!snapshot) {
    return;
  }

  renderActiveConfig(elements.autonomyActiveConfig, snapshot.activeConfig);
  renderSurveyDetails(elements.autonomySurveyDetails, snapshot.activeSurveyDetails);
  renderAgentBoard(elements.autonomyAgentBoard, snapshot.agentProfiles, snapshot.agentMemories);
  renderTimeline(elements.autonomyTimeline, snapshot.recentLogs);

  renderSimpleList(
    elements.autonomyEvaluations,
    snapshot.recentEvaluations.map((item) => `${item.runId}: ${item.decision} (${item.metrics?.coverageRate ?? 0}% coverage)`),
    "No evaluations yet."
  );
  renderSimpleList(
    elements.autonomyQuestionProposals,
    snapshot.recentQuestionProposals.map((item) => `${item.proposalType}: ${item.targetQuestionId || item.primaryAxis || "new"} - ${item.reason}`),
    "No question proposals yet."
  );
  renderSimpleList(
    elements.autonomyScoringProposals,
    snapshot.recentScoringProposals.map((item) => `${item.targetRule}: ${item.reason}`),
    "No scoring proposals yet."
  );
  renderSimpleList(
    elements.autonomyLogs,
    snapshot.recentLogs.map((item) => `${item.agent}: ${item.action} - ${item.summary}`),
    "No agent logs yet."
  );
  renderSimpleList(
    elements.autonomyTrends,
    snapshot.recentTrendReports.map((item) => `${item.reportId}: coverage ${item.metrics?.coverageRate ?? 0}, non-answer ${item.metrics?.nonAnswerRate ?? 0}`),
    "No trend reports yet."
  );
}

function renderAutonomyStatus(element, message, isError = false) {
  element.textContent = message;
  element.dataset.state = isError ? "error" : "normal";
}

function renderActiveConfig(container, activeConfig) {
  container.innerHTML = "";
  renderKeyValue(container, "Active Survey", activeConfig?.activeSurveyVersion || "not set");
  renderKeyValue(container, "Active Scoring", activeConfig?.activeScoringVersion || "not set");
  renderKeyValue(container, "Previous Survey", activeConfig?.previousSurveyVersion || "none");
  renderKeyValue(container, "Previous Scoring", activeConfig?.previousScoringVersion || "none");
}

function renderSurveyDetails(container, surveyDetails) {
  container.innerHTML = "";
  if (!surveyDetails) {
    const empty = document.createElement("li");
    empty.textContent = "Active survey details are not loaded yet.";
    container.appendChild(empty);
    return;
  }

  const mutableCount = (surveyDetails.questions || []).filter((question) => question.mutable !== false).length;
  const rows = [
    `Version: ${surveyDetails.versionId || surveyDetails.version || "unknown"}`,
    `Questions: ${surveyDetails.questionCount || surveyDetails.questions?.length || 0}`,
    `Anchor Questions: ${surveyDetails.anchorCount || 0}`,
    `Mutable Questions: ${mutableCount}`,
    `Created By: ${surveyDetails.createdBy || "unknown"}`,
    `Status: ${surveyDetails.status || "unknown"}`
  ];
  rows.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    container.appendChild(item);
  });
}

function renderAgentBoard(container, profiles = [], memories = []) {
  container.innerHTML = "";
  if (!profiles.length) {
    const empty = document.createElement("p");
    empty.className = "autonomy-empty";
    empty.textContent = "AI worker profiles will appear after the first autonomy cycle.";
    container.appendChild(empty);
    return;
  }

  profiles.forEach((profile) => {
    const memory = memories.find((item) => item.agentId === profile.agentId);
    const latestMemory = memory?.memoryEntries?.[0];
    const card = document.createElement("article");
    card.className = "agent-card";
    card.innerHTML = `
      <div class="agent-card-head">
        <strong>${profile.agentId}</strong>
        <span class="agent-chip">${profile.strategyType}</span>
      </div>
      <p class="agent-objectives">${(profile.currentObjectives || []).join(" / ") || "No objectives yet."}</p>
      <div class="agent-stats">
        <span>Exploration ${profile.explorationRate ?? "-"}</span>
        <span>Risk ${profile.riskTolerance ?? "-"}</span>
      </div>
      <p class="agent-memory-label">Latest memory</p>
      <p class="agent-memory-text">${formatMemoryEntry(latestMemory)}</p>
    `;
    container.appendChild(card);
  });
}

function renderTimeline(container, logs = []) {
  container.innerHTML = "";
  if (!logs.length) {
    const item = document.createElement("li");
    item.className = "timeline-item";
    item.textContent = "No activity yet.";
    container.appendChild(item);
    return;
  }

  logs.forEach((log) => {
    const item = document.createElement("li");
    item.className = "timeline-item";
    item.innerHTML = `
      <div class="timeline-meta">
        <strong>${log.agent}</strong>
        <span>${log.action}</span>
      </div>
      <p class="timeline-summary">${log.summary}</p>
      <span class="timeline-detail">${formatDate(log.createdAt)}</span>
    `;
    container.appendChild(item);
  });
}

function renderKeyValue(container, label, value) {
  const row = document.createElement("div");
  row.className = "autonomy-kv-row";
  row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
  container.appendChild(row);
}

function renderSimpleList(container, items, emptyText = "No entries yet.") {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("li");
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((itemText) => {
    const item = document.createElement("li");
    item.textContent = itemText;
    container.appendChild(item);
  });
}

function formatMemoryEntry(entry) {
  if (!entry) {
    return "No memory recorded yet.";
  }
  if (entry.type === "cycle-summary") {
    return `${entry.proposalCount || 0} proposal(s), decision ${entry.decision}, deployment ${entry.deploymentStatus}.`;
  }
  if (entry.type === "scoring-audit") {
    return `${entry.proposalCount || 0} scoring proposal(s): ${(entry.targetRules || []).join(", ") || "none"}.`;
  }
  if (entry.type === "evaluation") {
    return `Coverage ${entry.metrics?.coverageRate ?? 0}, discrimination ${entry.metrics?.questionDiscrimination ?? 0}.`;
  }
  return JSON.stringify(entry);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export { renderAutonomySnapshot, renderAutonomyStatus };
