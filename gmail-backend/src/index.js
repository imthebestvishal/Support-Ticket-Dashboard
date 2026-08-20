import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";

import { authRouter } from "./routes/auth.js";
import { apiRouter } from "./routes/api.js";
import { getAgentRouterStatus } from "./services/agentRouterService.js";

dotenv.config();
mongoose.set("bufferCommands", false);

for (const key of [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
]) {
  if (process.env[key]?.includes("127.0.0.1:9")) {
    delete process.env[key];
  }
}

const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const mongoUri = process.env.MONGO_URI || "";
const hasMongoUri =
  mongoUri.startsWith("mongodb://") ||
  mongoUri.startsWith("mongodb+srv://");

let sessionStore;

if (isProduction && hasMongoUri) {
  try {
    sessionStore = MongoStore.create({
      mongoUrl: mongoUri,
    });
  } catch (error) {
    console.warn(
      "Mongo session store unavailable; using in-memory sessions.",
      error.message
    );
  }
} else if (isProduction) {
  console.warn(
    "MONGO_URI is missing or invalid; using in-memory sessions."
  );
}
const agentRouterStatus = getAgentRouterStatus();

console.log(
  "AgentRouter config:",
  {
    configured: agentRouterStatus.configured,
    model: agentRouterStatus.model,
    baseUrl: agentRouterStatus.baseUrl,
    tokenPresent: agentRouterStatus.tokenPresent,
    tokenLength: agentRouterStatus.tokenLength,
  }
);

app.set("trust proxy", 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:8501",
  "http://127.0.0.1:8501",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(morgan("dev"));

/*
 * Express session
 *
 * The frontend runs on localhost:5173
 * The backend runs on localhost:5000
 *
 * In production the frontend and backend run on different domains
 * (Vercel + Render), so cookies must be allowed in cross-site requests.
 */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    name: "gmail.sid",
    ...(sessionStore ? { store: sessionStore } : {}),

    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

if (hasMongoUri) {
  mongoose
    .connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
    })
    .then(() => {
      console.log("MongoDB connected");
    })
    .catch((error) => {
      console.warn(
        "MongoDB unavailable; using in-memory storage for this session.",
        error.message
      );
    });
} else {
  console.warn(
    "MongoDB disabled because MONGO_URI is missing or invalid; using in-memory storage."
  );
}

app.use("/auth", authRouter);
app.use("/api", apiRouter);

app.get("/", (req, res) => {
  res.send({
    status: "ok",
    message: "Gmail API backend is running.",
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});



