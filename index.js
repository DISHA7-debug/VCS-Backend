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

/* -------------------- SERVER -------------------- */

function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3002;

  // Middleware
  app.use(bodyParser.json());
  app.use(express.json());

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    })
  );

  // Routes
  app.use("/", mainRouter);

  // MongoDB
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch((err) => {
      console.error("MongoDB connection failed:", err);
      process.exit(1);
    });

  mongoose.connection.once("open", () => {
    console.log("CRUD operations called");
  });

  // Socket.io
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("joinRoom", (userID) => {
      socket.join(userID);
      console.log(`User joined room: ${userID}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
  });
}
