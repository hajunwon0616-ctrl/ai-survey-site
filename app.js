import { db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const startBtn = document.getElementById("startBtn");
const surveySection = document.getElementById("surveySection");
const surveyForm = document.getElementById("surveyForm");
const statusMessage = document.getElementById("statusMessage");
const submitButton = document.getElementById("submitBtn");

startBtn.addEventListener("click", () => {
  surveySection.scrollIntoView({ behavior: "smooth" });
});

surveyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  statusMessage.textContent = "제출 중입니다...";

  const formData = new FormData(surveyForm);
  const payload = {
    q1: formData.get("q1"),
    q2: formData.get("q2"),
    opinion: formData.get("opinion") || "",
    createdAt: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, "surveyResponses"), payload);
    console.log("저장 성공 문서 ID:", docRef.id);
    statusMessage.textContent = "설문이 성공적으로 제출되었습니다.";
    surveyForm.reset();
  } catch (error) {
    console.error("Firestore 저장 오류:", error);
    statusMessage.textContent = `제출 중 오류 발생: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});
