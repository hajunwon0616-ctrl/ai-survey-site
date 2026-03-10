const startBtn = document.getElementById("startBtn");
const surveySection = document.getElementById("surveySection");
const surveyForm = document.getElementById("surveyForm");
const statusMessage = document.getElementById("statusMessage");

startBtn.addEventListener("click", () => {
  surveySection.scrollIntoView({ behavior: "smooth" });
});

surveyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(surveyForm);
  const data = Object.fromEntries(formData.entries());

  console.log("제출된 설문 데이터:", data);

  statusMessage.textContent = "설문이 제출되었습니다. 지금은 테스트 버전입니다.";

  surveyForm.reset();
});