import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { COLLECTIONS } from "../data/autonomy-schemas.js";
import { createSurveyDefinitionFromQuestions } from "../survey-metadata.js";

async function loadActiveRuntimeConfig({
  db,
  fallbackSurveyVersion,
  fallbackScoringVersion,
  fallbackSurveyDefinition,
  hasSurveyDefinition
}) {
  const fallbackConfig = {
    requestedSurveyVersion: fallbackSurveyVersion,
    activeSurveyVersion: fallbackSurveyVersion,
    activeScoringVersion: fallbackScoringVersion,
    previousSurveyVersion: null,
    previousScoringVersion: null,
    runtimeSurveyDefinition: fallbackSurveyDefinition,
    source: "fallback"
  };

  try {
    const snapshot = await getDoc(doc(db, COLLECTIONS.activeConfig, "current"));
    if (!snapshot.exists()) {
      return fallbackConfig;
    }

    const data = snapshot.data();
    const requestedSurveyVersion = data.activeSurveyVersion || fallbackSurveyVersion;
    const surveyAvailable = hasSurveyDefinition(requestedSurveyVersion);
    const questionVersionSnapshot = await getDoc(doc(db, COLLECTIONS.questionVersions, requestedSurveyVersion));
    const runtimeSurveyDefinition = questionVersionSnapshot.exists() && Array.isArray(questionVersionSnapshot.data().questions)
      ? createSurveyDefinitionFromQuestions({
          version: requestedSurveyVersion,
          title: questionVersionSnapshot.data().title || fallbackSurveyDefinition?.title,
          axes: questionVersionSnapshot.data().axes || fallbackSurveyDefinition?.axes,
          questions: questionVersionSnapshot.data().questions
        })
      : fallbackSurveyDefinition;

    return {
      requestedSurveyVersion,
      activeSurveyVersion: questionVersionSnapshot.exists() || surveyAvailable ? requestedSurveyVersion : fallbackSurveyVersion,
      activeScoringVersion: data.activeScoringVersion || fallbackScoringVersion,
      previousSurveyVersion: data.previousSurveyVersion || null,
      previousScoringVersion: data.previousScoringVersion || null,
      runtimeSurveyDefinition,
      source: questionVersionSnapshot.exists()
        ? "firestore-version"
        : surveyAvailable
          ? "firestore-config"
          : "fallback-missing-survey"
    };
  } catch (error) {
    console.error("Runtime config load error:", error);
    return {
      ...fallbackConfig,
      source: "fallback-error",
      errorMessage: error.message
    };
  }
}

export { loadActiveRuntimeConfig };
