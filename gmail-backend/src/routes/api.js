import express from "express";
import { User } from "../models/user.js";
import { Message } from "../models/message.js";
import { fetchAndAnalyzeMessages } from "../services/gmailService.js";
import { askAssistant } from "../services/assistantService.js";

const router = express.Router();

const requireAuth = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).send({
        error: "Not authenticated",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(401).send({
        error: "Not authenticated",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error);

    return res.status(500).send({
      error: "Authentication error",
    });
  }
};

// Gmail connection status
router.get("/gmail/status", requireAuth, async (req, res) => {
  try {
    const user = req.user;

    res.send({
      connected: !!(user.accessToken || user.refreshToken),
      email: user.email,
    });
  } catch (error) {
    console.error("Failed to get Gmail status:", error);

    res.status(500).send({
      error: "Failed to get Gmail status",
    });
  }
});

// Get stored analyzed messages/tickets
router.get("/messages", requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      userId: req.user._id,
    }).sort({
      receivedAt: -1,
    });

    res.send(messages);
  } catch (error) {
    console.error("Failed to get messages:", error);

    res.status(500).send({
      error: "Failed to get messages",
    });
  }
});

// Fetch Gmail messages and analyze them with Gemini
router.post("/messages/fetch", requireAuth, async (req, res) => {
  try {
    const result = await fetchAndAnalyzeMessages(req.user._id);

    res.send({
      count: result.length,
      messages: result,
    });
  } catch (error) {
    console.error("Failed to fetch Gmail messages:", error);

    res.status(500).send({
      error: error.message || "Failed to fetch Gmail messages",
    });
  }
});

// AI Support Assistant
router.post("/assistant", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).send({
        error: "Question is required",
      });
    }

    const result = await askAssistant(
      req.user._id,
      question.trim()
    );

    res.send(result);
  } catch (error) {
    console.error("AI Assistant error:", error);

    res.status(500).send({
      error: error.message || "AI Assistant failed",
    });
  }
});

export { router as apiRouter };
