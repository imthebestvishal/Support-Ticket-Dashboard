import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoose from "mongoose";
import session from "express-session";

import { authRouter } from "./routes/auth.js";
import { apiRouter } from "./routes/api.js";
import { knowledgeRouter } from "./routes/knowledge.js";
import { startGmailAutoSync } from "./services/gmailSyncService.js";


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
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(
            "CORS policy does not allow access from the specified Origin.",
          ),
        );
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
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

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.use("/auth", authRouter);
app.use("/api", apiRouter);
app.use("/api/knowledge", knowledgeRouter);

app.get("/", (req, res) => {
  res.send({
    status: "ok",
    message: "Gmail API backend is running.",
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  startGmailAutoSync();
});


