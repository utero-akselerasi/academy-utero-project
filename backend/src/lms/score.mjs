function answerKey(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  if (typeof question?.correct_answer === "string" && question.correct_answer.trim()) return question.correct_answer.trim();
  const raw = question?.correct_answer ?? question?.answer;
  const index = typeof raw === "string" && raw.trim() ? Number(raw) : raw;
  return Number.isInteger(index) && index >= 0 && index < options.length && typeof options[index] === "string"
    ? options[index].trim()
    : null;
}

export function scoreQuiz(questions, submittedAnswers) {
  const list = Array.isArray(questions) ? questions.filter((item) => item && typeof item === "object") : [];
  const answers = submittedAnswers && typeof submittedAnswers === "object" ? submittedAnswers : {};
  let correct = 0;
  let scored = 0;
  const normalized = list.map((question, index) => {
    const questionId = String(question.id ?? index);
    const selectedOption = typeof answers[questionId] === "string" ? answers[questionId].trim() : "";
    const key = answerKey(question);
    if (key !== null) {
      scored += 1;
      if (selectedOption && selectedOption === key) correct += 1;
    }
    return { question_id: questionId, selected_option: selectedOption };
  });
  return { answers: normalized, score: scored ? Math.round((correct / scored) * 100) : 0 };
}
