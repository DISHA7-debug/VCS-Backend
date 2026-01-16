const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const mainRouter = require("./routes/main.router");

// CLI controllers
const { initRepo } = require("./controllers/init");
const { addRepo } = require("./controllers/add");
const { commitRepo } = require("./controllers/commit");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");

dotenv.config();

/* -------------------- YARGS COMMANDS -------------------- */

yargs(hideBin(process.argv))
  .command("start", "Starts the server", {}, startServer)
  .command("init", "Initialise a new repository", {}, initRepo)
  .command("add <file>", "Add a file to the repository", (yargs) => {
    yargs.positional("file", {
      describe: "File to add",
      type: "string",
    });
  }, (argv) => addRepo(argv.file))
  .command("commit <message>", "Commit staged files", (yargs) => {
    yargs.positional("message", {
      describe: "Commit message",
      type: "string",
    });
  }, (argv) => commitRepo(argv.message))
  .command("push", "Push commits to S3", {}, pushRepo)
  .command("pull", "Pull commits from S3", {}, pullRepo)
  .command("revert <commitID>", "Revert to a commit", (yargs) => {
    yargs.positional("commitID", {
      describe: "Commit ID",
      type: "string",
    });
  }, (argv) => revertRepo(argv.commitID))
  .demandCommand(1)
  .help().argv;

/* -------------------- SERVER -------------------- */

let serverStarted = false; // ✅ prevent double start

function startServer() {
  if (serverStarted) {
    console.log("⚠️ Server already started, skipping duplicate start...");
    return;
  }
  serverStarted = true;

  const app = express();
  const PORT = process.env.PORT || 3002;

  // ✅ Middleware
  app.use(bodyParser.json());
  app.use(express.json());

  // ✅ CORS (Amplify + Render safe)
  app.use(cors({ origin: "*" }));

  // ✅ Health check (Render hits this)
  app.get("/", (req, res) => {
    res.status(200).send("Backend is running ✅");
  });

  // ✅ Routes
  app.use("/", mainRouter);

  // ✅ Create HTTP server
  const httpServer = http.createServer(app);

  // ✅ Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    socket.on("joinRoom", (userID) => {
      socket.join(userID);
      console.log(`User joined room: ${userID}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  // ✅ MongoDB (DON'T EXIT ON FAIL)
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
      // ✅ don't crash server on Render
    });

  mongoose.connection.once("open", () => {
    console.log("CRUD operations called");
  });

  // ✅ Start listening
  httpServer.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
  });
}
