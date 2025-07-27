const socket = io();
const params = new URLSearchParams(location.search);
const quizId = params.get("id");
const participantId = sessionStorage.getItem("participantId") || crypto.randomUUID();
const name = prompt("Enter your name:");
const schoolCode = prompt("Enter your school code:");
sessionStorage.setItem("participantId", participantId);

let quiz, round = 0, qIdx = 0, used5050 = false, usedDouble = false, timer;

async function loadQuiz() {
  const res = await fetch(`/quiz/${quizId}`);
  quiz = await res.json();
  document.getElementById("quiz-title").innerText = quiz.title;
  socket.emit("participantJoin", { quizId, name, schoolCode, participantId });
  showQuestion();
}

function showQuestion() {
  const q = quiz.rounds[round].questions[qIdx];
  document.getElementById("question-text").innerHTML = q.text;
  MathJax.typeset();
  const img = document.getElementById("question-image");
  if (q.image) {
    img.src = q.image; img.style.display = "block";
  } else {
    img.style.display = "none";
  }
  const optsDiv = document.getElementById("options");
  optsDiv.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerText = opt.text || opt;
    btn.onclick = () => submitAnswer(i, null);
    optsDiv.appendChild(btn);
  });
  startTimer(q.timer || 30);
}

function startTimer(sec) {
  let s = sec;
  document.getElementById("time-remaining").innerText = s;
  clearInterval(timer);
  timer = setInterval(() => {
    s--;
    document.getElementById("time-remaining").innerText = s;
    if (s <= 0) {
      clearInterval(timer);
      endQuiz("⏰ Time's up!");
    }
  }, 1000);
}

function submitAnswer(answer, secondAnswer) {
  clearInterval(timer);
  const payload = {
    participantId, name, schoolCode,
    roundIndex: round,
    questionIndex: qIdx,
    answer, lifeline: usedDouble ? "double" : used5050 ? "5050" : null,
    secondAnswer: secondAnswer || null,
    timeUsed: (quiz.rounds[round].questions[qIdx].timer || 30) - parseInt(document.getElementById("time-remaining").innerText)
  };
  fetch(`/submit/${quizId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(res => {
    if (!res.correct) endQuiz("❌ Incorrect Answer!");
    else nextQuestion();
  });
}

function nextQuestion() {
  qIdx++;
  if (qIdx >= quiz.rounds[round].questions.length) {
    round++; qIdx = 0;
  }
  if (round >= quiz.rounds.length) {
    window.location.href = `/results.html?pid=${participantId}&qid=${quizId}`;
  } else {
    showQuestion();
  }
}

document.getElementById("btn5050").onclick = () => {
  if (!quiz.use5050 || used5050) return;
  used5050 = true;
  const correct = quiz.rounds[round].questions[qIdx].correct;
  const wrongIndices = quiz.rounds[round].questions[qIdx].options.map((_,i)=>i).filter(i=>i!==correct);
  const toHide = wrongIndices.sort(()=>0.5-Math.random()).slice(0,2);
  Array.from(document.getElementById("options").children).forEach((btn,i)=>{
    if (toHide.includes(i)) btn.style.visibility = "hidden";
  });
};

document.getElementById("btndouble").onclick = () => {
  if (!quiz.useDouble || usedDouble) return;
  usedDouble = true;
  alert("Double Dip activated: you may answer twice.");
};

setInterval(() => {
  socket.emit("screenUpdate", { quizId, participantId, name, roundIndex: round, questionIndex: qIdx, option: null });
}, 3000);

function endQuiz(msg) {
  alert(msg);
  window.location.href = `/results.html?pid=${participantId}&qid=${quizId}`;
}

loadQuiz();
