import express from "express";
import crypto from "crypto";
import { User } from "../models/user.js";
import mongoose from "mongoose";
import { Message } from "../models/message.js";
import {
  createCalendarEvent,
  fetchAndAnalyzeMessages,
  generateReplyDraft,
  sendReplyEmail,
} from "../services/gmailService.js";
import { askAssistant } from "../services/assistantService.js";
import {
  getAgentRouterStatus,
  probeAgentRouter,
} from "../services/agentRouterService.js";
import {
  getMemoryUser,
  listMemoryMessages,
  listMemoryTrash,
  permanentlyDeleteMemoryMessage,
  restoreMemoryMessage,
  updateMemoryMessage,
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

router.post("/messages/:id/draft-reply", requireAuth, async (req, res) => {
  try {
    const message =
      mongoose.connection.readyState === 1
        ? await Message.findOne(messageQuery(req.user._id, req.params.id))
        : updateMemoryMessage(req.user._id.toString(), req.params.id, {});

    if (!message || message.deletedAt) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    if (!message.gmailMessageId) {
      return res.status(400).send({
        error: "Reply drafts are only available for Gmail-backed tickets.",
      });
    }

    const draftResult = await generateReplyDraft(message);
    const draft = draftResult.draft;

    const updatedMessage =
      mongoose.connection.readyState === 1
        ? await Message.findOneAndUpdate(
            messageQuery(req.user._id, req.params.id),
            {
              $set: {
                replyDraft: draft,
                replyDraftProvider: draftResult.source,
              },
            },
            {
              new: true,
            }
          )
        : updateMemoryMessage(req.user._id.toString(), req.params.id, {
            replyDraft: draft,
            replyDraftProvider: draftResult.source,
          });

    res.send({
      draft,
      source: draftResult.source,
      model: draftResult.model || "",
      providerError: draftResult.providerError || "",
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Failed to generate reply draft:", error);

    res.status(500).send({
      error: error.message || "Failed to generate reply draft",
    });
  }
});

router.patch("/messages/:id/reply-draft", requireAuth, async (req, res) => {
  try {
    const replyDraft = String(req.body?.replyDraft || "").trim();

    if (!replyDraft) {
      return res.status(400).send({
        error: "Reply draft is required",
      });
    }

    const updates = {
      replyDraft,
      replyDraftProvider: req.body?.source || "manual",
    };
    const updatedMessage =
      mongoose.connection.readyState === 1
        ? await Message.findOneAndUpdate(
            messageQuery(req.user._id, req.params.id),
            {
              $set: updates,
            },
            {
              new: true,
            }
          )
        : updateMemoryMessage(
            req.user._id.toString(),
            req.params.id,
            updates
          );

    if (!updatedMessage || updatedMessage.deletedAt) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    res.send({
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Failed to save reply draft:", error);

    res.status(500).send({
      error: error.message || "Failed to save reply draft",
    });
  }
});

router.post("/messages/:id/send-reply", requireAuth, async (req, res) => {
  try {
    const replyBody = String(req.body?.replyBody || "").trim();

    if (!replyBody) {
      return res.status(400).send({
        error: "Reply body is required",
      });
    }

    const message =
      mongoose.connection.readyState === 1
        ? await Message.findOne(messageQuery(req.user._id, req.params.id))
        : updateMemoryMessage(req.user._id.toString(), req.params.id, {});

    if (!message || message.deletedAt) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    if (!message.gmailMessageId) {
      return res.status(400).send({
        error: "Replies can only be sent for Gmail-backed tickets.",
      });
    }

    const sentMessage = await sendReplyEmail({
      user: req.user,
      message,
      replyBody,
    });

    const updates = {
      replyDraft: replyBody,
      sentReply: replyBody,
      replySentAt: new Date(),
      status: "Resolved",
    };

    const updatedMessage =
      mongoose.connection.readyState === 1
        ? await Message.findOneAndUpdate(
            messageQuery(req.user._id, req.params.id),
            {
              $set: updates,
            },
            {
              new: true,
            }
          )
        : updateMemoryMessage(
            req.user._id.toString(),
            req.params.id,
            updates
          );

    res.send({
      sent: true,
      gmailMessageId: sentMessage.id,
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Failed to send reply:", error);

    res.status(500).send({
      error: error.message || "Failed to send reply",
    });
  }
});

router.post("/messages/:id/calendar-event", requireAuth, async (req, res) => {
  try {
    const message =
      mongoose.connection.readyState === 1
        ? await Message.findOne(messageQuery(req.user._id, req.params.id))
        : updateMemoryMessage(req.user._id.toString(), req.params.id, {});

    if (!message || message.deletedAt) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    if (message.calendarEventId) {
      return res.status(409).send({
        error: "Calendar event already exists for this ticket.",
        calendarEventId: message.calendarEventId,
        calendarEventLink: message.calendarEventLink || "",
      });
    }

    const event = await createCalendarEvent({
      user: req.user,
      message,
    });
    const updates = {
      calendarEventId: event.id || "",
      calendarEventLink: event.htmlLink || "",
    };
    const updatedMessage =
      mongoose.connection.readyState === 1
        ? await Message.findOneAndUpdate(
            messageQuery(req.user._id, req.params.id),
            {
              $set: updates,
            },
            {
              new: true,
            }
          )
        : updateMemoryMessage(
            req.user._id.toString(),
            req.params.id,
            updates
          );

    res.send({
      calendarEvent: event,
      message: updatedMessage,
    });
  } catch (error) {
    console.error("Failed to create calendar event:", error);

    res.status(500).send({
      error:
        error.message ||
        "Failed to create calendar event. Reconnect Gmail and approve Calendar access, then try again.",
    });
  }
});

// AI Support Assistant
router.get("/assistant/status", requireAuth, async (req, res) => {
  const status = getAgentRouterStatus();

  if (req.query.probe !== "true") {
    return res.send(status);
  }

  const probe = await probeAgentRouter();

  res.send({
    ...status,
    probe,
  });
});

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



