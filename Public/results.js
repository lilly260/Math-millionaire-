const params = new URLSearchParams(location.search),
      pid = params.get("pid"),
      qid = params.get("qid");
async function loadResults() {
  const res = await fetch(`/quiz/${qid}`);
  const quiz = await res.json();
  const rec = quiz.leaderboard.find(r => r.participantId === pid);
  if (rec) {
    document.getElementById("name").innerText = rec.name;
    document.getElementById("score").innerText = rec.points;
    document.getElementById("accuracy").innerText = rec.accuracy;
    document.getElementById("time").innerText = rec.timeTaken;
    document.getElementById("lifelines").innerText = rec.lifelinesUsed.join(", ") || "None";
  }
}
loadResults();
