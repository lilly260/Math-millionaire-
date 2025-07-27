const socket = io();
const notifications = document.getElementById("notifications");
const screensDiv = document.getElementById("participantScreens");
const roundsContainer = document.getElementById("roundsContainer");
const lbBody = document.getElementById("leaderboardBody");
const sortBy = document.getElementById("sortBy");
let quizId, leaderboard = [];

document.getElementById("addRoundBtn").onclick = () => {
  const idx = roundsContainer.children.length;
  const div = document.createElement("div");
  div.className = "round";
  div.innerHTML = `
    <h4>Round ${idx+1}</h4>
    <textarea class="roundQuestions" placeholder='Paste JSON questions array'></textarea>
  `;
  roundsContainer.appendChild(div);
};

document.getElementById("startQuizBtn").onclick = async () => {
  const title = document.getElementById("quizTitle").value.trim();
  if (!title) return alert("Enter quiz title");
  const rnds = [];
  Array.from(document.querySelectorAll(".roundQuestions")).forEach((ta,i) => {
    rnds.push({ title: `Round ${i+1}`, questions: JSON.parse(ta.value) });
  });
  const payload = {
    title,
    rounds: JSON.stringify(rnds),
    use5050: JSON.stringify(document.getElementById("use5050").checked),
    useDouble: JSON.stringify(document.getElementById("useDouble").checked),
    multiplayer: JSON.stringify(document.getElementById("multiplayerToggle").checked)
  };
  const res = await fetch("/create-quiz", { method: "POST", body: new FormData(document.createElement("form")).append.bind(null, Object.entries(payload)) });
  const data = await res.json();
  quizId = data.quizId;
  socket.emit("hostStart", { quizId, multiplayer: payload.multiplayer=== "true" });
  alert(`Quiz created with code: ${quizId}`);
};

socket.on("participantJoined", d => {
  const n = document.createElement("div");
  n.className = "notification";
  n.innerText = `${d.name} joined`;
  notifications.appendChild(n);
  setTimeout(()=>n.remove(),4000);
});

socket.on("screenUpdate", d => {
  let div = document.getElementById(`screen-${d.participantId}`);
  if (!div) {
    div = document.createElement("div");
    div.id = `screen-${d.participantId}`;
    screensDiv.appendChild(div);
  }
  div.innerHTML = `<strong>${d.name}</strong><br>R${d.roundIndex+1} Q${d.questionIndex+1}<br>Choice: ${d.option}`;
});

socket.on("leaderboardUpdate", data => {
  leaderboard = data; sortLeaderboard(sortBy.value);
});
sortBy.onchange = () => sortLeaderboard(sortBy.value);
function sortLeaderboard(c) {
  leaderboard.sort((a,b)=>{
    if (c==="points") return b.points - a.points;
    if (c==="accuracy") return b.accuracy - a.accuracy;
    if (c==="timeTaken") return a.timeTaken - b.timeTaken;
    return a.lifelinesUsed.length - b.lifelinesUsed.length;
  });
  render();
}
function render() {
  lbBody.innerHTML = "";
  leaderboard.forEach((p,i)=>{
    const tr = document.createElement("tr");
    if (i===0) tr.style.background = "#ffd700";
    else if (i===1) tr.style.background = "#c0c0c0";
    else if (i===2) tr.style.background = "#cd7f32";
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${p.name}</td>
      <td>${p.schoolCode}</td>
      <td>${p.points}</td>
      <td>${p.accuracy}%</td>
      <td>${p.timeTaken}s</td>
      <td>${p.lifelinesUsed.join(", ")}</td>
    `;
    lbBody.appendChild(tr);
  });
}
function downloadLeaderboardPDF() {
  html2pdf().from(document.getElementById("leaderboardWrapper")).save("leaderboard.pdf");
}
