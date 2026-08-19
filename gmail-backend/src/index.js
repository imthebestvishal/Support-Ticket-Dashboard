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
 * sameSite: "lax" allows the session cookie to survive
 * the Google OAuth redirect back to our application.
 */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    name: "gmail.sid",
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),

    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 3000,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.warn(
      "MongoDB unavailable; using in-memory storage for this local session.",
      error.message
    );
  });

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



