import express from "express";
import { User } from "../models/user.js";
import { Message } from "../models/message.js";
import { fetchAndAnalyzeMessages } from "../services/gmailService.js";

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

// Fetch unread Gmail messages and analyze them with Gemini
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

export { router as apiRouter };