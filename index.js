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

// ✅ IMPORTANT: put this on TOP before yargs runs
let serverStarted = false;

// CLI controllers
const { initRepo } = require("./controllers/init");
const { addRepo } = require("./controllers/add");
const { commitRepo } = require("./controllers/commit");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");

dotenv.config();

/* -------------------- SERVER -------------------- */

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

  // ✅ CORS FIX (works with Amplify)
  app.use(cors({ origin: "*" }));

  // ✅ Health check for Render
  app.get("/", (req, res) => {
    res.status(200).send("Backend is running ✅");
  });

  // ✅ Routes
  app.use("/", mainRouter);

  // ✅ Create server
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

  // ✅ MongoDB (don't crash server)
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
    });

  mongoose.connection.once("open", () => {
    console.log("CRUD operations called");
  });

  // ✅ Listen
  httpServer.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
  });
}

/* -------------------- YARGS COMMANDS -------------------- */

yargs(hideBin(process.argv))
  .command("start", "Starts the server", {}, startServer)
  .command("init", "Initialise a new repository", {}, initRepo)
  .command(
    "add <file>",
    "Add a file to the repository",
    (yargs) => {
      yargs.positional("file", {
        describe: "File to add",
        type: "string",
      });
    },
    (argv) => addRepo(argv.file)
  )
  .command(
    "commit <message>",
    "Commit staged files",
    (yargs) => {
      yargs.positional("message", {
        describe: "Commit message",
        type: "string",
      });
    },
    (argv) => commitRepo(argv.message)
  )
  .command("push", "Push commits to S3", {}, pushRepo)
  .command("pull", "Pull commits from S3", {}, pullRepo)
  .command(
    "revert <commitID>",
    "Revert to a commit",
    (yargs) => {
      yargs.positional("commitID", {
        describe: "Commit ID",
        type: "string",
      });
    },
    (argv) => revertRepo(argv.commitID)
  )
  .demandCommand(1)
  .help().argv;
