import express from "express";
import crypto from "crypto";
import { User } from "../models/user.js";
import mongoose from "mongoose";
import { Message } from "../models/message.js";
import { fetchAndAnalyzeMessages } from "../services/gmailService.js";
import { askAssistant } from "../services/assistantService.js";
import {
  getMemoryUser,
  listMemoryMessages,
  listMemoryTrash,
  permanentlyDeleteMemoryMessage,
  restoreMemoryMessage,
  softDeleteAllMemoryMessages,
  softDeleteMemoryMessage,
} from "../services/memoryStore.js";

const router = express.Router();

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
function getBearerUserId(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";

  if (!token) {
    return "";
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return "";
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  if (signature.length !== expectedSignature.length) {
    return "";
  }

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  ) {
    return "";
  }

  const data = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  );

  if (!data.userId || data.exp < Date.now()) {
    return "";
  }

  return data.userId;
}

function messageQuery(userId, id) {
  const filters = [
    {
      gmailMessageId: id,
      userId,
    },
  ];

  if (mongoose.Types.ObjectId.isValid(id)) {
    filters.push({
      _id: id,
      userId,
    });
  }

  return {
    $or: filters,
  };
}

const requireAuth = async (req, res, next) => {
  try {
    const userId = req.session?.userId || getBearerUserId(req);

    if (!userId) {
      return res.status(401).send({
        error: "Not authenticated",
      });
    }

    const user =
      mongoose.connection.readyState === 1
        ? await User.findById(userId)
        : getMemoryUser(userId);

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
      picture: user.picture || "",
      name: user.name || "",
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
    const messages =
      mongoose.connection.readyState === 1
        ? await Message.find({
            userId: req.user._id,
            deletedAt: null,
          }).sort({
            receivedAt: -1,
          })
        : listMemoryMessages(req.user._id.toString());

    res.send(messages);
  } catch (error) {
    console.error("Failed to get messages:", error);

    res.status(500).send({
      error: "Failed to get messages",
    });
  }
});

router.get("/messages/trash", requireAuth, async (req, res) => {
  try {
    const messages =
      mongoose.connection.readyState === 1
        ? await Message.find({
            userId: req.user._id,
            deletedAt: {
              $ne: null,
            },
          }).sort({
            deletedAt: -1,
          })
        : listMemoryTrash(req.user._id.toString());

    res.send(messages);
  } catch (error) {
    console.error("Failed to get deleted messages:", error);

    res.status(500).send({
      error: "Failed to get recycle bin",
    });
  }
});

router.delete("/messages", requireAuth, async (req, res) => {
  try {
    const deletedAt = new Date();
    const expiresAt = new Date(
      deletedAt.getTime() + THIRTY_DAYS_MS
    );

    if (mongoose.connection.readyState === 1) {
      const result = await Message.updateMany(
        {
          userId: req.user._id,
          deletedAt: null,
        },
        {
          $set: {
            deletedAt,
            expiresAt,
          },
        }
      );

      return res.send({
        count: result.modifiedCount,
      });
    }

    const deleted = softDeleteAllMemoryMessages(
      req.user._id.toString()
    );

    res.send({
      count: deleted.length,
    });
  } catch (error) {
    console.error("Failed to clear messages:", error);

    res.status(500).send({
      error: "Failed to clear messages",
    });
  }
});

router.delete("/messages/:id", requireAuth, async (req, res) => {
  try {
    const deletedAt = new Date();
    const expiresAt = new Date(
      deletedAt.getTime() + THIRTY_DAYS_MS
    );

    const message =
      mongoose.connection.readyState === 1
        ? await Message.findOneAndUpdate(
            messageQuery(req.user._id, req.params.id),
            {
              $set: {
                deletedAt,
                expiresAt,
              },
            },
            {
              new: true,
            }
          )
        : softDeleteMemoryMessage(
            req.user._id.toString(),
            req.params.id
          );

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    res.send(message);
  } catch (error) {
    console.error("Failed to delete message:", error);

    res.status(500).send({
      error: "Failed to move message to recycle bin",
    });
  }
});

router.post("/messages/:id/restore", requireAuth, async (req, res) => {
  try {
    const message =
      mongoose.connection.readyState === 1
        ? await Message.findOneAndUpdate(
            messageQuery(req.user._id, req.params.id),
            {
              $set: {
                deletedAt: null,
                expiresAt: null,
              },
            },
            {
              new: true,
            }
          )
        : restoreMemoryMessage(
            req.user._id.toString(),
            req.params.id
          );

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    res.send(message);
  } catch (error) {
    console.error("Failed to restore message:", error);

    res.status(500).send({
      error: "Failed to restore message",
    });
  }
});

router.delete(
  "/messages/:id/permanent",
  requireAuth,
  async (req, res) => {
    try {
      const message =
        mongoose.connection.readyState === 1
          ? await Message.findOneAndDelete(
              messageQuery(req.user._id, req.params.id)
            )
          : permanentlyDeleteMemoryMessage(
              req.user._id.toString(),
              req.params.id
            );

      if (!message) {
        return res.status(404).send({
          error: "Message not found",
        });
      }

      res.send({
        deleted: true,
      });
    } catch (error) {
      console.error(
        "Failed to permanently delete message:",
        error
      );

      res.status(500).send({
        error: "Failed to permanently delete message",
      });
    }
  }
);

// Fetch Gmail messages and analyze them with AgentRouter
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



