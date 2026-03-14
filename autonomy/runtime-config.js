import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { COLLECTIONS } from "../data/autonomy-schemas.js";

async function loadActiveRuntimeConfig({
  db,
  fallbackSurveyVersion,
  fallbackScoringVersion,
  hasSurveyDefinition
}) {
  const fallbackConfig = {
    requestedSurveyVersion: fallbackSurveyVersion,
    activeSurveyVersion: fallbackSurveyVersion,
    activeScoringVersion: fallbackScoringVersion,
    previousSurveyVersion: null,
    previousScoringVersion: null,
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

    return {
      requestedSurveyVersion,
      activeSurveyVersion: surveyAvailable ? requestedSurveyVersion : fallbackSurveyVersion,
      activeScoringVersion: data.activeScoringVersion || fallbackScoringVersion,
      previousSurveyVersion: data.previousSurveyVersion || null,
      previousScoringVersion: data.previousScoringVersion || null,
      source: surveyAvailable ? "firestore" : "fallback-missing-survey"
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
