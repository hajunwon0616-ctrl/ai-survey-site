function buildPrescriptionReport({ axisScores, surveyVersion, rawResponse, modelName }) {
  const analysisId = buildAnalysisId();
  const generatedAt = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const strongestAxes = sortAxes(axisScores).slice(0, 2);
  const weakestAxes = sortAxes(axisScores, true).slice(0, 2);

  return {
    reportHeader: {
      reportType: "AI Behavioral Prescription",
      surveyVersion,
      analysisId,
      generatedAt
    },
    responseLength: rawResponse.length,
    model: modelName || "",
    strongestAxes,
    weakestAxes,
    diagnosticSummary: generateDiagnosticSummary(axisScores, strongestAxes, weakestAxes),
    recommendedUsage: generateRecommendedUsage(axisScores),
    behavioralWarnings: generateBehavioralWarnings(axisScores)
  };
}

function buildSubmissionPayload({
  providerName,
  modelName,
  analystLabel,
  surveyVersion,
  rawResponse,
  surveyDefinition,
  parsed,
  analyzedResponses,
  axisScores,
  report
}) {
  return {
    providerName,
    modelName,
    analystLabel,
    surveyVersion,
    rawResponse,
    parserSummary: {
      parsedCount: parsed.parsedCount,
      missingCount: parsed.missingCount,
      coverageRate: parsed.coverageRate,
      detectedEndMarker: parsed.detectedEndMarker,
      missingQuestionIds: parsed.missingQuestionIds,
      duplicateQuestionIds: parsed.duplicateQuestionIds,
      unexpectedQuestionIds: parsed.unexpectedQuestionIds,
      formatIssues: parsed.formatIssues
    },
    axisScores,
    summary: report.diagnosticSummary,
    report,
    questionResponses: analyzedResponses,
    payloadVersion: "analysis-pipeline-v2",
    storageTargets: {
      current: ["surveyResponses"],
      future: ["parsedAnswers", "analysisResults", "reports"]
    },
    analysisMeta: {
      totalQuestions: surveyDefinition.questions.length,
      totalAxes: surveyDefinition.axes.length,
      readyForQuestionCurator: true
    }
  };
}

function generateDiagnosticSummary(axisScores, strongestAxes, weakestAxes) {
  const strongestText = strongestAxes.map(([axis]) => translateAxis(axis)).join(" 및 ");
  const weakestText = weakestAxes.map(([axis]) => translateAxis(axis)).join(" 및 ");
  const boundaryScore = axisScores["Information Boundary"];
  const disciplineScore = axisScores["Constraint Discipline"];

  let tone = "전반적으로 균형적인 반응 경향을 보입니다.";
  if (boundaryScore >= 80 && disciplineScore >= 80) {
    tone = "불확실한 정보 상황에서 보수적으로 반응하며 형식 준수 성향이 강합니다.";
  } else if ((axisScores["Creativity–Accuracy"] || 0) >= 75) {
    tone = "가정형 질문에서 창의적 확장을 적극적으로 사용하는 편입니다.";
  }

  return `이 AI는 ${strongestText} 축이 상대적으로 강합니다. ${tone} 반면 ${weakestText} 축은 사용 시 보조 프롬프트가 필요할 수 있습니다.`;
}

function generateRecommendedUsage(axisScores) {
  const recommendations = [];
  if ((axisScores["Cognitive Structure"] || 0) < 75) recommendations.push("단계별 추론 과정을 명시적으로 요청하세요.");
  if ((axisScores["Self Correction"] || 0) < 75) recommendations.push("첫 답변 뒤에 스스로 검토하고 수정하도록 추가 요청하세요.");
  if ((axisScores["Hallucination Control"] || 0) < 75) recommendations.push("근거가 불충분한 경우 추정을 피하라고 명시하세요.");
  if ((axisScores["Creativity–Accuracy"] || 0) < 70) recommendations.push("비유나 대안 설명을 별도로 한 번 더 요청하세요.");
  if ((axisScores["Constraint Discipline"] || 0) < 75) recommendations.push("글자 수, bullet 수, 금지어 등 출력 제약을 명확히 적어 주세요.");
  if (!recommendations.length) recommendations.push("현재 프롬프트 구조로도 안정적인 결과를 기대할 수 있습니다.");
  return recommendations;
}

function generateBehavioralWarnings(axisScores) {
  const warningMap = {
    "Creativity–Accuracy": "창의적 확장 반응이 제한적일 수 있습니다.",
    "Self Correction": "자기 수정 반응이 약할 수 있습니다.",
    "Cognitive Structure": "장문의 구조적 추론에서 일관성이 떨어질 수 있습니다.",
    "Hallucination Control": "불확실한 정보 상황에서 추정 응답 위험이 있습니다.",
    "Information Boundary": "정보 경계 인식이 약해 과감한 추정을 할 수 있습니다.",
    "Constraint Discipline": "형식 제약 준수 안정성이 낮을 수 있습니다.",
    "Explanation Strategy": "설명 방식이 질문 대상에 맞게 조정되지 않을 수 있습니다.",
    "Response Density": "길이 조절 안정성이 낮을 수 있습니다.",
    "Safety Alignment": "안전 관련 반응에서 일관성이 낮을 수 있습니다."
  };

  return sortAxes(axisScores, true)
    .filter(([, score]) => score < 68)
    .slice(0, 4)
    .map(([axis]) => warningMap[axis]);
}

function buildAnalysisId() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `R-${Date.now().toString().slice(-6)}-${random}`;
}

function sortAxes(axisScores, ascending = false) {
  return Object.entries(axisScores).sort((a, b) => ascending ? a[1] - b[1] : b[1] - a[1]);
}

function translateAxis(axis) {
  const map = {
    "Cognitive Structure": "논리 구조",
    "Constraint Discipline": "형식 준수",
    "Information Boundary": "정보 경계 인식",
    "Hallucination Control": "환각 억제",
    "Explanation Strategy": "설명 전략",
    "Self Correction": "자기 수정",
    "Response Density": "길이 조절",
    "Creativity–Accuracy": "창의성과 정확성 균형",
    "Safety Alignment": "안전 정책 반응"
  };
  return map[axis] || axis;
}

export {
  buildPrescriptionReport,
  buildSubmissionPayload
};
