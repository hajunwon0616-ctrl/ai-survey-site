const AXIS_DESCRIPTIONS = {
  "Cognitive Structure": {
    ko: {
      short: "논리 구조 능력",
      detail: "답변이 얼마나 단계적으로 구성되고 구조적으로 전개되는지"
    },
    en: {
      short: "Logical structure",
      detail: "How clearly the answer is organized into steps, premises, and conclusions"
    }
  },
  "Constraint Discipline": {
    ko: {
      short: "형식 제약 준수 능력",
      detail: "bullet point, 글자 수 제한, 금지어 등 요구사항을 지키는지"
    },
    en: {
      short: "Constraint compliance",
      detail: "How well the answer follows requested formats such as bullets, length limits, and forbidden words"
    }
  },
  "Information Boundary": {
    ko: {
      short: "정보 경계 인식",
      detail: "알 수 없는 정보에 대해 추측하지 않고 경계를 인식하는지"
    },
    en: {
      short: "Information boundary awareness",
      detail: "How well the model recognizes unknowns and avoids pretending to know them"
    }
  },
  "Hallucination Control": {
    ko: {
      short: "환각 억제 능력",
      detail: "근거 없는 내용을 사실처럼 말하는 경향을 얼마나 억제하는지"
    },
    en: {
      short: "Hallucination control",
      detail: "How strongly the model avoids presenting unsupported claims as facts"
    }
  },
  "Explanation Strategy": {
    ko: {
      short: "설명 전략",
      detail: "질문 목적과 대상에 맞게 설명 방식을 조정하는지"
    },
    en: {
      short: "Explanation strategy",
      detail: "How well the model adapts its explanation style to the task and audience"
    }
  },
  "Self Correction": {
    ko: {
      short: "자기 오류 수정 능력",
      detail: "답변의 오류를 스스로 바로잡고 수정하는지"
    },
    en: {
      short: "Self-correction",
      detail: "How willing and able the model is to identify and repair its own mistakes"
    }
  },
  "Response Density": {
    ko: {
      short: "답변 길이 조절 능력",
      detail: "질문 조건에 맞게 답변 길이와 밀도를 조절하는지"
    },
    en: {
      short: "Response density control",
      detail: "How well the model adjusts answer length and density to fit the prompt requirements"
    }
  },
  "Creativity–Accuracy": {
    ko: {
      short: "창의성과 정확성 균형",
      detail: "창의적 확장과 사실 기반 설명 사이에서 균형을 잡는지"
    },
    en: {
      short: "Creativity-accuracy balance",
      detail: "How well the model balances imaginative expansion with factual reliability"
    }
  },
  "Safety Alignment": {
    ko: {
      short: "안전 정책 대응",
      detail: "위험하거나 민감한 요청에 대해 안전하게 반응하는지"
    },
    en: {
      short: "Safety alignment",
      detail: "How safely the model responds to risky, sensitive, or policy-relevant prompts"
    }
  }
};

const UI_TEXT = {
  ko: {
    surveyVersion: "Survey Version",
    analyzing: "분석 중...",
    submit: "분석 후 저장하기",
    reportType: "Report Type",
    provider: "Provider",
    testLabel: "Test Label",
    generatedTime: "Generated Time",
    responseLength: "Response Length",
    model: "Model",
    noWeakness: "뚜렷한 취약 축이 감지되지 않았습니다.",
    parsedCount: "파싱된 질문 수",
    headerCount: "인식된 질문 헤더 수",
    missingCount: "누락된 질문 수",
    coverageRate: "응답 커버리지",
    duplicateCount: "중복 질문 수",
    formatIssues: "형식 이슈",
    none: "없음",
    metadataVersion: "질문 세트 버전",
    axisCount: "행동 축 수",
    storageCollection: "저장 컬렉션",
    futureTargets: "향후 분리 대상",
    curatorReady: "Question Curator 준비",
    yes: "예",
    no: "아니오",
    primary: "Primary",
    secondary: "Secondary",
    overall: "Overall",
    noAnswer: "응답 없음",
    noAnswerNote: "이 질문에 대한 응답이 제출되지 않았습니다.",
    answerQuality: "응답 품질",
    strongest: "Strongest",
    weakest: "Weakest",
    strength: "강점",
    weakness: "약점",
    neutral: "보통",
    expandAll: "전체 펼치기",
    collapseAll: "접기",
    fullAnswer: "전체 답변",
    copyDone: "리포트 요약을 복사했습니다.",
    downloadDone: "리포트 파일을 다운로드했습니다.",
    parsedSuffix: "문항 분석 완료"
  },
  en: {
    surveyVersion: "Survey Version",
    analyzing: "Analyzing...",
    submit: "Analyze and Save",
    reportType: "Report Type",
    provider: "Provider",
    testLabel: "Test Label",
    generatedTime: "Generated Time",
    responseLength: "Response Length",
    model: "Model",
    noWeakness: "No major weakness axes were detected.",
    parsedCount: "Parsed Questions",
    headerCount: "Detected Headers",
    missingCount: "Missing Questions",
    coverageRate: "Coverage",
    duplicateCount: "Duplicate Questions",
    formatIssues: "Format Issues",
    none: "None",
    metadataVersion: "Survey Version",
    axisCount: "Behavior Axes",
    storageCollection: "Storage Collection",
    futureTargets: "Future Split Targets",
    curatorReady: "Question Curator Ready",
    yes: "Yes",
    no: "No",
    primary: "Primary",
    secondary: "Secondary",
    overall: "Overall",
    noAnswer: "No answer",
    noAnswerNote: "No response was submitted for this question.",
    answerQuality: "Answer quality",
    strongest: "Strongest",
    weakest: "Weakest",
    strength: "Strength",
    weakness: "Weakness",
    neutral: "Neutral",
    expandAll: "Expand all",
    collapseAll: "Collapse",
    fullAnswer: "Full answer",
    copyDone: "Copied the report summary.",
    downloadDone: "Downloaded the report file.",
    parsedSuffix: "questions analyzed"
  }
};

function initializePage(elements, surveyVersion, locale = "ko") {
  elements.surveyVersionLabel.textContent = `${UI_TEXT[locale].surveyVersion} ${surveyVersion}`;
  elements.surveyVersionInput.value = surveyVersion;
}

function bindResultActions(elements, handlers) {
  elements.insightSort?.addEventListener("change", (event) => {
    handlers.onSortChange?.(event.target.value);
  });
  elements.insightExpandBtn?.addEventListener("click", () => {
    handlers.onToggleInsightExpansion?.();
  });
  elements.copyReportBtn?.addEventListener("click", async () => {
    await handlers.onCopyReport?.();
  });
  elements.downloadReportBtn?.addEventListener("click", () => {
    handlers.onDownloadReport?.();
  });
  elements.exportPdfBtn?.addEventListener("click", () => {
    handlers.onExportPdf?.();
  });
  elements.closeReportBtn?.addEventListener("click", () => {
    handlers.onCloseReport?.();
  });
  elements.reportBackdrop?.addEventListener("click", () => {
    handlers.onCloseReport?.();
  });
}

function setLoadingState(elements, isLoading, message = "", locale = "ko") {
  elements.submitButton.disabled = isLoading;
  elements.submitButton.textContent = isLoading ? UI_TEXT[locale].analyzing : UI_TEXT[locale].submit;
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
    showAllInsights: true,
    locale: overrides.locale ?? payload.uiState?.locale ?? "ko",
    insightsExpanded: overrides.insightsExpanded ?? payload.uiState?.insightsExpanded ?? false
  };
  payload.uiState = uiState;
  const text = UI_TEXT[uiState.locale];

  elements.resultsSection.hidden = false;
  document.body.classList.add("modal-open");
  elements.completenessLabel.textContent = `${payload.parserSummary.parsedCount}/${payload.analysisMeta.totalQuestions} ${text.parsedSuffix}`;
  elements.summaryText.textContent = payload.summary;
  elements.diagnosticNotes.textContent = payload.report.diagnosticSummary;
  renderAxisSummary(elements.strongAxes, payload.report.strongestAxes, uiState.locale);
  renderAxisSummary(elements.weakAxes, payload.report.weakestAxes, uiState.locale);

  renderReportMeta(elements.reportMeta, payload);
  renderRadarChart(document.getElementById("radarChart"), payload.axisScores, uiState.locale);
  renderAxisCards(elements.axisScores, payload.axisScores, uiState.locale);
  renderAxisTable(elements.axisTableBody, payload.axisScores, uiState.locale);
  renderList(elements.recommendedUsage, payload.report.recommendedUsage);
  renderList(
    elements.behavioralWarnings,
    payload.report.behavioralWarnings.length
      ? payload.report.behavioralWarnings
      : [text.noWeakness]
  );
  renderList(elements.parseSummary, [
    `${text.headerCount}: ${payload.parserSummary.headerCount ?? payload.parserSummary.parsedCount}`,
    `${text.parsedCount}: ${payload.parserSummary.parsedCount}`,
    `${text.missingCount}: ${payload.parserSummary.missingCount}`,
    `${text.coverageRate}: ${payload.parserSummary.coverageRate}%`,
    `${text.duplicateCount}: ${payload.parserSummary.duplicateQuestionIds.length}`,
    `${text.formatIssues}: ${payload.parserSummary.formatIssues.length ? payload.parserSummary.formatIssues.join(" / ") : text.none}`
  ]);
  renderList(elements.metadataSummary, [
    `${text.metadataVersion}: ${payload.surveyVersion}`,
    `${text.axisCount}: ${payload.analysisMeta.totalAxes}`,
    `${text.storageCollection}: surveyResponses`,
    `${text.futureTargets}: ${payload.storageTargets.future.join(", ")}`,
    `${text.curatorReady}: ${payload.analysisMeta.readyForQuestionCurator ? text.yes : text.no}`
  ]);
  renderQuestionInsights(elements, payload.questionResponses, uiState);
  if (elements.insightExpandBtn) {
    elements.insightExpandBtn.textContent = uiState.insightsExpanded ? text.collapseAll : text.expandAll;
  }

  elements.resultsSection.scrollTo?.({ top: 0, behavior: "smooth" });
}

function renderReportMeta(container, payload) {
  const text = UI_TEXT[payload.uiState?.locale || "ko"];
  const metaItems = [
    [text.reportType, payload.report.reportHeader.reportType],
    [text.surveyVersion, payload.surveyVersion],
    ["Analysis ID", payload.report.reportHeader.analysisId],
    [text.provider, payload.providerName || text.none],
    [text.generatedTime, payload.report.reportHeader.generatedAt],
    [text.responseLength, `${payload.report.responseLength} chars`],
    [text.model, payload.modelName || text.none],
    [text.testLabel, payload.testLabel || text.none]
  ];

  container.innerHTML = "";
  metaItems.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "prescription-meta-item";
    item.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    container.appendChild(item);
  });
}

function renderAxisCards(container, axisScores, locale = "ko") {
  container.innerHTML = "";
  Object.entries(axisScores).forEach(([axis, score]) => {
    const description = AXIS_DESCRIPTIONS[axis][locale] || AXIS_DESCRIPTIONS[axis].ko;
    const card = document.createElement("article");
    card.className = "vector-card";
    card.style.setProperty("--score", score);
    card.innerHTML = `
      <div class="axis-label-row">
        <div class="axis-label">${axis}</div>
        <button class="axis-tooltip" type="button" aria-label="${axis} 설명">
          i
          <span class="axis-tooltip-panel">
            <strong>${description.short}</strong>
            <span>${description.detail}</span>
          </span>
        </button>
      </div>
      <div class="axis-score">${score}</div>
      <p class="axis-description">${description.short}</p>
      <span class="score-badge ${getStatusClass(score)}">${getStatusLabel(score, locale)}</span>
      <div class="axis-bar"><span style="width:${score}%"></span></div>
    `;
    container.appendChild(card);
  });

  window.requestAnimationFrame(() => {
    adjustTooltipAlignment(container);
  });
}

function renderAxisTable(container, axisScores, locale = "ko") {
  container.innerHTML = "";
  Object.entries(axisScores).forEach(([axis, score]) => {
    const description = AXIS_DESCRIPTIONS[axis][locale] || AXIS_DESCRIPTIONS[axis].ko;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${axis}</td>
      <td>${score}</td>
      <td>${description.detail}</td>
      <td><span class="score-badge ${getStatusClass(score)}">${getStatusLabel(score, locale)}</span></td>
    `;
    container.appendChild(row);
  });
}

function renderQuestionInsights(elements, questionResponses, uiState) {
  const sorted = [...questionResponses]
    .sort((left, right) => {
      if (uiState.sortMode === "highest-score") {
        return right.score.overall - left.score.overall;
      }
      if (uiState.sortMode === "lowest-score") {
        return left.score.overall - right.score.overall;
      }
      return compareQuestionNumbers(left.questionNumber, right.questionNumber);
    });

  const visibleItems = sorted;
  const text = UI_TEXT[uiState.locale];
  elements.questionAnalysisList.innerHTML = "";
  visibleItems.forEach((response) => {
    const answerPreview = response.answerText
      ? `${response.answerText.slice(0, 220)}${response.answerText.length > 220 ? "..." : ""}`
      : text.noAnswer;
    const fullAnswerBlock = response.answerText
      ? `<details class="question-answer-details"${uiState.insightsExpanded ? " open" : ""}>
          <summary>${text.fullAnswer}</summary>
          <pre>${escapeHtml(response.answerText)}</pre>
        </details>`
      : "";
    const item = document.createElement("article");
    item.className = "question-analysis-item";
    item.innerHTML = `
      <div class="question-analysis-header">
        <h4>${response.questionNumber}</h4>
        <span class="pill">${response.strategyType}</span>
      </div>
      <p>${answerPreview}</p>
      <p class="analysis-note">${response.answerText ? response.notes : text.noAnswerNote}</p>
      <div class="analysis-meta">
        <span class="pill">${text.primary} ${response.primaryAxis}: ${response.score.primary}</span>
        <span class="pill">${text.secondary}: ${response.score.secondary}</span>
        <span class="pill">${text.overall}: ${response.score.overall}</span>
        <span class="pill">${text.answerQuality}: ${response.answerQuality}</span>
      </div>
      <div class="analysis-tags">
        ${response.analysisTags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
      </div>
      ${fullAnswerBlock}
    `;
    elements.questionAnalysisList.appendChild(item);
  });

  if (elements.insightSort) {
    elements.insightSort.value = uiState.sortMode;
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

function renderAxisSummary(container, axisEntries, locale = "ko") {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  axisEntries.forEach(([axis, score]) => {
    const description = AXIS_DESCRIPTIONS[axis][locale] || AXIS_DESCRIPTIONS[axis].ko;
    const item = document.createElement("article");
    item.className = "axis-summary-item";
    item.innerHTML = `
      <strong>${axis}</strong>
      <p>${description.short}</p>
      <span class="pill">${score}</span>
    `;
    container.appendChild(item);
  });
}

function getStatusLabel(score, locale = "ko") {
  const text = UI_TEXT[locale];
  if (score >= 80) return text.strength;
  if (score < 68) return text.weakness;
  return text.neutral;
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

function adjustTooltipAlignment(container) {
  const tooltips = container.querySelectorAll(".axis-tooltip");
  tooltips.forEach((tooltip) => {
    tooltip.classList.remove("tooltip-align-left", "tooltip-align-right");
    const panel = tooltip.querySelector(".axis-tooltip-panel");
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    if (panelRect.left < 16) {
      tooltip.classList.add("tooltip-align-left");
    } else if (panelRect.right > window.innerWidth - 16) {
      tooltip.classList.add("tooltip-align-right");
    }
  });
}

function renderRadarChart(canvas, axisScores, locale = "ko") {
  if (!canvas || typeof canvas.getContext !== "function") {
    return;
  }

  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const chartPadding = 86;
  const radius = Math.min(width, height) * 0.5 - chartPadding;
  const axes = Object.keys(axisScores);
  const values = Object.values(axisScores);
  context.clearRect(0, 0, width, height);

  for (let level = 1; level <= 5; level += 1) {
    const ringRadius = radius * (level / 5);
    drawPolygon(context, axes.length, centerX, centerY, ringRadius, {
      strokeStyle: "rgba(40, 75, 99, 0.12)",
      lineWidth: 1
    });
  }

  axes.forEach((axis, index) => {
    const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(x, y);
    context.strokeStyle = "rgba(40, 75, 99, 0.14)";
    context.lineWidth = 1;
    context.stroke();

    const label = AXIS_DESCRIPTIONS[axis][locale] || AXIS_DESCRIPTIONS[axis].ko;
    context.fillStyle = "#284b63";
    context.font = "600 12px Segoe UI";
    context.textAlign = x >= centerX ? "left" : "right";
    context.textBaseline = "middle";
    context.fillText(label.short, x + (x >= centerX ? 14 : -14), y);
  });

  context.beginPath();
  values.forEach((value, index) => {
    const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
    const pointRadius = radius * (value / 100);
    const x = centerX + Math.cos(angle) * pointRadius;
    const y = centerY + Math.sin(angle) * pointRadius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
  context.fillStyle = "rgba(201, 111, 59, 0.18)";
  context.strokeStyle = "#c96f3b";
  context.lineWidth = 2;
  context.fill();
  context.stroke();
}

function drawPolygon(context, sides, centerX, centerY, radius, styles) {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = ((Math.PI * 2) / sides) * index - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.strokeStyle = styles.strokeStyle;
  context.lineWidth = styles.lineWidth;
  context.stroke();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export {
  initializePage,
  bindResultActions,
  setLoadingState,
  showStatusMessage,
  renderResults
};
