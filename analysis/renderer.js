const AXIS_DESCRIPTIONS = {
  "Cognitive Structure": "답변의 논리 구조와 전개 일관성",
  "Constraint Discipline": "형식, 길이, 금지어 등 제약 준수 능력",
  "Information Boundary": "알 수 없는 정보를 구분하는 경계 인식",
  "Hallucination Control": "추측과 허구 정보 생성을 억제하는 경향",
  "Explanation Strategy": "대상과 목적에 맞춘 설명 방식",
  "Self Correction": "오류를 바로잡고 수정하는 태도",
  "Response Density": "길이를 상황에 맞게 조절하는 능력",
  "Creativity–Accuracy": "창의성과 정확성의 균형",
  "Safety Alignment": "안전, 윤리, 위험 요소에 대한 반응"
};

function initializePage(elements, surveyVersion) {
  elements.surveyVersionLabel.textContent = `Survey Version ${surveyVersion}`;
  elements.surveyVersionInput.value = surveyVersion;
}

function bindResultActions(elements, handlers) {
  elements.insightSort?.addEventListener("change", (event) => {
    handlers.onSortChange?.(event.target.value);
  });
  elements.insightToggle?.addEventListener("click", () => {
    handlers.onToggleInsights?.();
  });
  elements.copyReportBtn?.addEventListener("click", async () => {
    await handlers.onCopyReport?.();
  });
}

function setLoadingState(elements, isLoading, message = "") {
  elements.submitButton.disabled = isLoading;
  elements.submitButton.textContent = isLoading ? "분석 중..." : "분석 후 저장하기";
  if (message) {
    showStatusMessage(elements.statusMessage, message);
  }
}

function showStatusMessage(statusElement, message) {
  statusElement.textContent = message;
}

function renderResults(elements, payload, overrides = {}) {
  const uiState = {
    sortMode: overrides.sortMode ?? payload.uiState?.sortMode ?? "question-order",
    showAllInsights: overrides.showAllInsights ?? payload.uiState?.showAllInsights ?? false
  };
  payload.uiState = uiState;

  elements.resultsSection.hidden = false;
  elements.completenessLabel.textContent = `${payload.parserSummary.parsedCount}/${payload.analysisMeta.totalQuestions} parsed`;
  elements.summaryText.textContent = payload.summary;
  elements.diagnosticNotes.textContent = payload.report.diagnosticSummary;

  renderReportMeta(elements.reportMeta, payload);
  renderAxisCards(elements.axisScores, payload.axisScores);
  renderList(elements.recommendedUsage, payload.report.recommendedUsage);
  renderList(
    elements.behavioralWarnings,
    payload.report.behavioralWarnings.length
      ? payload.report.behavioralWarnings
      : ["뚜렷한 취약 축이 감지되지 않았습니다."]
  );
  renderList(elements.parseSummary, [
    `파싱된 질문 수: ${payload.parserSummary.parsedCount}`,
    `누락된 질문 수: ${payload.parserSummary.missingCount}`,
    `응답 커버리지: ${payload.parserSummary.coverageRate}%`,
    `중복 질문 수: ${payload.parserSummary.duplicateQuestionIds.length}`,
    `형식 이슈: ${payload.parserSummary.formatIssues.length ? payload.parserSummary.formatIssues.join(" / ") : "없음"}`
  ]);
  renderList(elements.metadataSummary, [
    `질문 세트 버전: ${payload.surveyVersion}`,
    `행동 축 수: ${payload.analysisMeta.totalAxes}`,
    `저장 컬렉션: surveyResponses`,
    `향후 분리 대상: ${payload.storageTargets.future.join(", ")}`,
    `Question Curator 준비: ${payload.analysisMeta.readyForQuestionCurator ? "예" : "아니오"}`
  ]);
  renderQuestionInsights(elements, payload.questionResponses, uiState);

  elements.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReportMeta(container, payload) {
  const metaItems = [
    ["Report Type", payload.report.reportHeader.reportType],
    ["Survey Version", payload.surveyVersion],
    ["Analysis ID", payload.report.reportHeader.analysisId],
    ["Generated Time", payload.report.reportHeader.generatedAt],
    ["Response Length", `${payload.report.responseLength} chars`],
    ["Model", payload.modelName || "미입력"]
  ];

  container.innerHTML = "";
  metaItems.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "prescription-meta-item";
    item.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    container.appendChild(item);
  });
}

function renderAxisCards(container, axisScores) {
  container.innerHTML = "";
  Object.entries(axisScores).forEach(([axis, score]) => {
    const card = document.createElement("article");
    card.className = "vector-card";
    card.style.setProperty("--score", score);
    card.innerHTML = `
      <div class="axis-label-row">
        <div class="axis-label">${axis}</div>
        <div class="axis-tooltip" title="${AXIS_DESCRIPTIONS[axis]}">i</div>
      </div>
      <div class="axis-score">${score}</div>
      <p class="axis-description">${AXIS_DESCRIPTIONS[axis]}</p>
      <div class="axis-bar"><span style="width:${score}%"></span></div>
    `;
    container.appendChild(card);
  });
}

function renderQuestionInsights(elements, questionResponses, uiState) {
  const sorted = [...questionResponses]
    .filter((response) => response.answerText)
    .sort((left, right) => {
      if (uiState.sortMode === "highest-score") {
        return right.score.overall - left.score.overall;
      }
      if (uiState.sortMode === "lowest-score") {
        return left.score.overall - right.score.overall;
      }
      return compareQuestionNumbers(left.questionNumber, right.questionNumber);
    });

  const visibleItems = uiState.showAllInsights ? sorted : sorted.slice(0, 12);
  elements.questionAnalysisList.innerHTML = "";
  visibleItems.forEach((response) => {
    const item = document.createElement("article");
    item.className = "question-analysis-item";
    item.innerHTML = `
      <div class="question-analysis-header">
        <h4>${response.questionNumber}</h4>
        <span class="pill">${response.strategyType}</span>
      </div>
      <p>${response.answerText.slice(0, 220)}${response.answerText.length > 220 ? "..." : ""}</p>
      <p class="analysis-note">${response.notes}</p>
      <div class="analysis-meta">
        <span class="pill">Primary ${response.primaryAxis}: ${response.score.primary}</span>
        <span class="pill">Secondary: ${response.score.secondary}</span>
        <span class="pill">Overall: ${response.score.overall}</span>
      </div>
      <div class="analysis-tags">
        ${response.analysisTags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
      </div>
    `;
    elements.questionAnalysisList.appendChild(item);
  });

  if (elements.insightSort) {
    elements.insightSort.value = uiState.sortMode;
  }
  if (elements.insightToggle) {
    elements.insightToggle.textContent = uiState.showAllInsights ? "12개만 보기" : "전체 보기";
  }
}

function renderList(listElement, items) {
  listElement.innerHTML = "";
  items.forEach((itemText) => {
    const item = document.createElement("li");
    item.textContent = itemText;
    listElement.appendChild(item);
  });
}

function compareQuestionNumbers(left, right) {
  const [leftMain, leftSub = "0"] = left.replace("Q", "").split("-");
  const [rightMain, rightSub = "0"] = right.replace("Q", "").split("-");
  const mainGap = Number(leftMain) - Number(rightMain);
  return mainGap !== 0 ? mainGap : Number(leftSub) - Number(rightSub);
}

export {
  initializePage,
  bindResultActions,
  setLoadingState,
  showStatusMessage,
  renderResults
};
