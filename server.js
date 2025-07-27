const express = require("express"),
      http = require("http"),
      cors = require("cors"),
      session = require("express-session"),
      mongoose = require("mongoose"),
      multer = require("multer"),
      { v4: uuidv4 } = require("uuid");
const app = express(), server = http.createServer(app),
      io = require("socket.io")(server, { cors: { origin: "*", methods: ["GET","POST"] } });
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

app.use(cors());
app.use(express.json());
app.use(session({ secret: "quiz_secret", resave: false, saveUninitialized: true }));
app.use(express.static("public"));
const upload = multer();
const HOST_EMAILS = [
  "12391@jaipuria.com","9782@jaipuria.com","16510@jaipuria.com",
  "suyashawasthi@jaipuria.com","pratikshamishrashukla@jaipuria.com"
];

// Mongoose schemas
const optionSchema = new mongoose.Schema({ text: String, image: String, index: Number });
const questionSchema = new mongoose.Schema({
  text: String, image: String, correct: Number,
  points: Number, timer: Number, options: [optionSchema]
});
const roundSchema = new mongoose.Schema({ title: String, questions: [questionSchema] });
const recordSchema = new mongoose.Schema({
  participantId: String, name: String, schoolCode: String,
  points: Number, timeTaken: Number, accuracy: Number, lifelinesUsed: [String]
});
const quizSchema = new mongoose.Schema({
  quizId: { type: String, unique: true },
  title: String, hostEmail: String, rounds: [roundSchema],
  use5050: Boolean, useDouble: Boolean, multiplayer: Boolean, leaderboard: [recordSchema]
});
const participantSchema = new mongoose.Schema({
  participantId: { type: String, unique: true }, name: String, schoolCode: String
});
const Quiz = mongoose.model("Quiz", quizSchema);
const Participant = mongoose.model("Participant", participantSchema);

// Middleware
function requireHost(req, res, next) {
  if (req.session.isHost) return next();
  res.status(403).send("Forbidden");
}

app.post("/login", (req, res) => {
  const email = (req.body.email || "").toLowerCase();
  req.session.email = email;
  req.session.isHost = HOST_EMAILS.includes(email);
  res.json({ redirect: req.session.isHost ? "/host.html" : "/participant.html" });
});

app.post("/create-quiz", requireHost, upload.none(), async (req, res) => {
  const quizId = uuidv4().slice(0,6);
  const { title, rounds, use5050, useDouble, multiplayer } = req.body;
  const quiz = new Quiz({
    quizId,
    hostEmail: req.session.email,
    title,
    rounds: JSON.parse(rounds),
    use5050: JSON.parse(use5050),
    useDouble: JSON.parse(useDouble),
    multiplayer: JSON.parse(multiplayer),
    leaderboard: []
  });
  await quiz.save();
  res.json({ quizId });
});

app.get("/quiz/:id", async (req, res) => {
  const quiz = await Quiz.findOne({ quizId: req.params.id }).lean();
  if (!quiz) return res.status(404).send("Quiz not found");
  res.json(quiz);
});

app.post("/submit/:quizId", async (req, res) => {
  const {
    participantId, name, schoolCode,
    roundIndex, questionIndex, answer,
    lifeline, secondAnswer, timeUsed
  } = req.body;
  const quiz = await Quiz.findOne({ quizId: req.params.quizId });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  let user = await Participant.findOne({ participantId });
  if (!user) {
    user = new Participant({ participantId, name, schoolCode });
    await user.save();
  }

  const round = quiz.rounds[roundIndex];
  const question = round.questions[questionIndex];
  const existing = quiz.leaderboard.find(r => r.participantId === participantId);
  if (lifeline && existing?.lifelinesUsed.includes(lifeline)) {
    return res.json({ error: "Lifeline already used" });
  }

  const correct =
    question.correct === answer ||
    (lifeline === "double" && secondAnswer === question.correct);
  if (!correct) return res.json({ correct: false });

  const record = existing || {
    participantId, name, schoolCode,
    points: 0, timeTaken: 0, accuracy: 0, lifelinesUsed: []
  };
  record.points += question.points || 10;
  record.timeTaken += timeUsed || 0;
  if (lifeline && !record.lifelinesUsed.includes(lifeline))
    record.lifelinesUsed.push(lifeline);

  const totalQ = quiz.rounds.reduce((sum, r) => sum + r.questions.length, 0);
  record.accuracy = parseFloat(((quiz.leaderboard.filter(r=>r.participantId===participantId).length + 1) / totalQ * 100).toFixed(1));
  quiz.leaderboard = quiz.leaderboard.filter(r => r.participantId !== participantId);
  quiz.leaderboard.push(record);
  await quiz.save();
  io.to(req.params.quizId).emit("leaderboardUpdate", quiz.leaderboard);
  res.json({ correct: true });
});

io.on("connection", socket => {
  socket.on("hostStart", ({ quizId, multiplayer }) => {
    socket.join(quizId);
    Quiz.updateOne({ quizId }, { multiplayer }).exec();
  });
  socket.on("participantJoin", data => {
    socket.join(data.quizId);
    io.to(data.quizId).emit("participantJoined", data);
  });
  socket.on("screenUpdate", data => {
    io.to(data.quizId).emit("screenUpdate", data);
  });
});

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
