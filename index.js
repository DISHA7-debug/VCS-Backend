function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3002;

  // ✅ Middleware
  app.use(bodyParser.json());
  app.use(express.json());

  // ✅ FORCE CORS HEADERS (WILL ALWAYS WORK)
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // ✅ Preflight request
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  // ✅ Routes
  app.use("/", mainRouter);

  // ✅ MongoDB
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

  // ✅ Socket.io
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
