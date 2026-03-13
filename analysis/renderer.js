const AXIS_DESCRIPTIONS = {
  "Cognitive Structure": {
    short: "논리 구조 능력",
    detail: "답변이 얼마나 단계적으로 구성되고 구조적으로 전개되는지"
  },
  "Constraint Discipline": {
    short: "형식 제약 준수 능력",
    detail: "bullet point, 글자 수 제한, 금지어 등 요구사항을 지키는지"
  },
  "Information Boundary": {
    short: "정보 경계 인식",
    detail: "알 수 없는 정보에 대해 추측하지 않고 경계를 인식하는지"
  },
  "Hallucination Control": {
    short: "환각 억제 능력",
    detail: "근거 없는 내용을 사실처럼 말하는 경향을 얼마나 억제하는지"
  },
  "Explanation Strategy": {
    short: "설명 전략",
    detail: "질문 목적과 대상에 맞게 설명 방식을 조정하는지"
  },
  "Self Correction": {
    short: "자기 오류 수정 능력",
    detail: "답변의 오류를 스스로 바로잡고 수정하는지"
  },
  "Response Density": {
    short: "답변 길이 조절 능력",
    detail: "질문 조건에 맞게 답변 길이와 밀도를 조절하는지"
  },
  "Creativity–Accuracy": {
    short: "창의성과 정확성 균형",
    detail: "창의적 확장과 사실 기반 설명 사이에서 균형을 잡는지"
  },
  "Safety Alignment": {
    short: "안전 정책 대응",
    detail: "위험하거나 민감한 요청에 대해 안전하게 반응하는지"
  }
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
  elements.downloadReportBtn?.addEventListener("click", () => {
    handlers.onDownloadReport?.();
  });
  elements.closeReportBtn?.addEventListener("click", () => {
    handlers.onCloseReport?.();
  });
  elements.reportBackdrop?.addEventListener("click", () => {
    handlers.onCloseReport?.();
  });
}

function setLoadingState(elements, isLoading, message = "") {
  elements.submitButton.disabled = isLoading;
  elements.submitButton.textContent = isLoading ? "분석 중..." : "분석 후 저장하기";
  if (elements.loadingOverlay) {
    elements.loadingOverlay.hidden = !isLoading;
  }
  if (elements.loadingMessage && message) {
    elements.loadingMessage.textContent = message;
  }
  document.body.classList.toggle("modal-open", isLoading || !elements.resultsSection.hidden);
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
  document.body.classList.add("modal-open");
  elements.completenessLabel.textContent = `${payload.parserSummary.parsedCount}/${payload.analysisMeta.totalQuestions} parsed`;
  elements.summaryText.textContent = payload.summary;
  elements.diagnosticNotes.textContent = payload.report.diagnosticSummary;
  renderAxisSummary(elements.strongAxes, payload.report.strongestAxes);
  renderAxisSummary(elements.weakAxes, payload.report.weakestAxes);

  renderReportMeta(elements.reportMeta, payload);
  renderAxisCards(elements.axisScores, payload.axisScores);
  renderAxisTable(elements.axisTableBody, payload.axisScores);
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

  elements.resultsSection.scrollTo?.({ top: 0, behavior: "smooth" });
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
        <button class="axis-tooltip" type="button" aria-label="${axis} 설명">
          i
          <span class="axis-tooltip-panel">
            <strong>${AXIS_DESCRIPTIONS[axis].short}</strong>
            <span>${AXIS_DESCRIPTIONS[axis].detail}</span>
          </span>
        </button>
      </div>
      <div class="axis-score">${score}</div>
      <p class="axis-description">${AXIS_DESCRIPTIONS[axis].short}</p>
      <span class="score-badge ${getStatusClass(score)}">${getStatusLabel(score)}</span>
      <div class="axis-bar"><span style="width:${score}%"></span></div>
    `;
    container.appendChild(card);
  });
}

function renderAxisTable(container, axisScores) {
  container.innerHTML = "";
  Object.entries(axisScores).forEach(([axis, score]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${axis}</td>
      <td>${score}</td>
      <td>${AXIS_DESCRIPTIONS[axis].detail}</td>
      <td><span class="score-badge ${getStatusClass(score)}">${getStatusLabel(score)}</span></td>
    `;
    container.appendChild(row);
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

function renderAxisSummary(container, axisEntries) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  axisEntries.forEach(([axis, score]) => {
    const chip = document.createElement("span");
    chip.className = "pill";
    chip.textContent = `${axis}: ${score}`;
    container.appendChild(chip);
  });
}

function getStatusLabel(score) {
  if (score >= 80) return "Strength";
  if (score < 68) return "Weakness";
  return "Neutral";
}

function getStatusClass(score) {
  if (score >= 80) return "is-strong";
  if (score < 68) return "is-weak";
  return "is-neutral";
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
