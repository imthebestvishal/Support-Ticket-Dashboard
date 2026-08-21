import { extractDeadline } from "../services/ticketIntelligenceService.js";
import {
  checkCalendarAccess,
  createCalendarEvent,
  createCalendarDeadline,
  verifyCalendarEvent,
} from "../services/calendarService.js";
import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { User } from "../models/user.js";
import { Message } from "../models/message.js";
import {
  fetchAndAnalyzeMessages,
  sendGmailReply,
  refineSupportReply,
} from "../services/gmailService.js";
import { askAssistant } from "../services/assistantService.js";

const router = express.Router();

function getBearerUserId(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";

  if (!token || !process.env.SESSION_SECRET) {
    return "";
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return "";
  }

  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(payload)
    .digest("base64url");

  if (signature !== expected) {
    return "";
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (!parsed.userId || Number(parsed.exp || 0) < Date.now()) {
      return "";
    }

    return parsed.userId;
  } catch {
    return "";
  }
}

const requireAuth = async (req, res, next) => {
  try {
    const userId =
      req.session?.userId ||
      getBearerUserId(req);

    if (!userId) {
      return res.status(401).send({
        error: "Not authenticated",
      });
    }

    const user = await User.findById(userId);

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

const findUserMessage = async (idParam, userId) => {
  if (!idParam) return null;
  const cleanId = String(idParam).replace(/^TICKET-/, "").trim();

  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const byObjectId = await Message.findOne({ _id: cleanId, userId });
    if (byObjectId) return byObjectId;
  }

  return await Message.findOne({ gmailMessageId: cleanId, userId });
};

function primaryCalendarEvent(message) {
  const events = Array.isArray(message.calendarEvents)
    ? message.calendarEvents
    : [];

  return (
    events.find((event) => event.type === "Deadline") ||
    events[0] ||
    null
  );
}

function syncPrimaryCalendarFields(message) {
  const primary = primaryCalendarEvent(message);

  if (!primary) {
    message.calendarEventId = null;
    message.calendarEventLink = null;
    message.calendarEventStatus = "None";
    message.calendarEventType = "None";
    message.calendarEventError = "";
    message.calendarEventNeedsReconnect = false;
    message.calendarEventCreatedAt = null;
    return;
  }

  message.calendarEventId = primary.calendarEventId || null;
  message.calendarEventLink = primary.calendarEventLink || null;
  message.calendarEventStatus = primary.calendarEventStatus || "None";
  message.calendarEventType = primary.type || "Deadline";
  message.calendarEventError = primary.calendarEventError || "";
  message.calendarEventNeedsReconnect = Boolean(
    primary.calendarEventNeedsReconnect
  );
  message.calendarEventCreatedAt = primary.calendarEventCreatedAt || null;
}

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

// Get deleted messages / recycle bin

// Move message to trash
router.delete("/messages/:id", requireAuth, async (req, res) => {
  try {
    const message = await findUserMessage(
      req.params.id,
      req.user._id
    );

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    message.status = "Deleted";
    message.deletedAt = new Date();

    await message.save();

    res.send({
      message: "Moved to trash",
      ticket: message,
    });

  } catch (error) {
    console.error("Delete message error:", error);

    res.status(500).send({
      error: error.message || "Failed to delete message",
    });
  }
});
router.get("/messages/trash", requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({
      userId: req.user._id,
      status: "deleted",
    });

    res.json(messages);
  } catch (error) {
    console.error("Failed to get trash:", error);
    res.status(500).json({
      error: "Failed to get trash",
    });
  }
});
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
//
// NOTE: fetchAndAnalyzeMessages() (in gmailService.js) is the single
// source of truth for both AI ticket analysis and calendar event
// detection - it already analyzes every message with Gemini, detects
// every calendar-worthy event (deadlines, meetings, appointments,
// follow-ups, reminders, callbacks), and persists them to the Message
// document for reviewed Calendar creation from the UI.
// This route must not re-run analysis or re-create calendar events,
// or tickets would end up with duplicate calendar entries.
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

router.post(
  "/messages/:id/calendar-events/:eventIndex/sync",
  requireAuth,
  async (req, res) => {
    try {
      const message = await findUserMessage(req.params.id, req.user._id);

      if (!message) {
        return res.status(404).send({
          error: "Message not found",
        });
      }

      const events = Array.isArray(message.calendarEvents)
        ? message.calendarEvents
        : [];
      const eventIndex = Number.parseInt(req.params.eventIndex, 10);

      if (!Number.isInteger(eventIndex) || eventIndex < 0) {
        return res.status(400).send({
          error: "Invalid calendar event index.",
        });
      }

      let event = events[eventIndex];

      if (!event && eventIndex === 0 && message.deadline) {
        events[0] = {
          type: "Deadline",
          title: message.subject || "Support deadline",
          dateTime: message.deadline,
          reason: message.deadlineReason || "",
          calendarEventId: null,
          calendarEventLink: null,
          calendarEventStatus: "None",
          calendarEventError: "",
          calendarEventNeedsReconnect: false,
          calendarEventCreatedAt: null,
        };
        message.calendarEvents = events;
        event = events[0];
      }

      if (!event || !event.dateTime) {
        return res.status(400).send({
          error: "No event or deadline with a usable date/time was found.",
        });
      }

      const eventType = event.type || "Deadline";

      if (event.calendarEventId) {
        const verified = await verifyCalendarEvent({
          accessToken: req.user.accessToken,
          refreshToken: req.user.refreshToken,
          eventId: event.calendarEventId,
          type: eventType,
        });

        event.calendarEventStatus = verified.status || "Failed";
        event.calendarEventError = verified.success
          ? ""
          : verified.error || "Failed to verify calendar event";
        event.calendarEventNeedsReconnect = Boolean(verified.needsReconnect);

        if (verified.success) {
          event.calendarEventId = verified.id || event.calendarEventId;
          event.calendarEventLink =
            verified.htmlLink || event.calendarEventLink || null;
          event.calendarEventCreatedAt =
            event.calendarEventCreatedAt || new Date();
        }

        syncPrimaryCalendarFields(message);
        message.markModified("calendarEvents");
        await message.save();

        return res.status(verified.needsReconnect ? 403 : 200).send({
          success: verified.success,
          verified: verified.success,
          event,
          message,
          error: verified.success ? undefined : verified.error,
          needsReconnect: Boolean(verified.needsReconnect),
          provider: verified.provider || "google-calendar",
        });
      }

      const created = await createCalendarEvent({
        accessToken: req.user.accessToken,
        refreshToken: req.user.refreshToken,
        subject: event.title || message.subject || "Support calendar event",
        dateTime: event.dateTime,
        reason: event.reason || message.summary || "",
        type: eventType,
      });

      event.calendarEventStatus = created.status || "Failed";
      event.calendarEventError = created.success
        ? ""
        : created.error || "Failed to create calendar event";
      event.calendarEventNeedsReconnect = Boolean(created.needsReconnect);

      if (created.id) {
        event.calendarEventId = created.id;
        event.calendarEventLink = created.htmlLink || null;
      }

      if (created.success) {
        event.calendarEventCreatedAt = new Date();
      }

      syncPrimaryCalendarFields(message);
      message.markModified("calendarEvents");
      await message.save();

      return res.status(created.needsReconnect ? 403 : 200).send({
        success: created.success,
        verified: Boolean(created.verified),
        event,
        message,
        error: created.success ? undefined : created.error,
        needsReconnect: Boolean(created.needsReconnect),
        provider: created.provider || "google-calendar",
      });
    } catch (error) {
      console.error("Calendar event sync error:", error);

      return res.status(500).send({
        error: error.message || "Failed to sync calendar event",
      });
    }
  }
);

// Update ticket status
router.patch("/messages/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = [
      "Open",
      "Pending",
      "In Progress",
      "Resolved",
      "Escalated",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).send({
        error: `Invalid status. Allowed values are: ${allowedStatuses.join(", ")}`,
      });
    }

    const message = await findUserMessage(req.params.id, req.user._id);

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    message.status = status;
    await message.save();

    res.send(message);
  } catch (error) {
    console.error("Failed to update status:", error);

    res.status(500).send({
      error: error.message || "Failed to update status",
    });
  }
});

// Update ticket reply draft
router.put("/messages/:id/reply", requireAuth, async (req, res) => {
  try {
    const reply =
      req.body?.reply ??
      req.body?.editedReply ??
      req.body?.suggestedResponse;

    if (typeof reply !== "string") {
      return res.status(400).send({
        error: "Missing or invalid reply in request body",
      });
    }

    const message = await findUserMessage(req.params.id, req.user._id);

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    message.editedReply = reply;
    message.suggestedResponse = reply;
    await message.save();

    res.send(message);
  } catch (error) {
    console.error("Failed to update reply:", error);

    res.status(500).send({
      error: error.message || "Failed to update reply",
    });
  }
});

// Refine ticket reply draft with AI (Gemini)
router.post("/messages/:id/refine", requireAuth, async (req, res) => {
  try {
    const { tone, reply, kbSnippet } = req.body;
    const message = await findUserMessage(req.params.id, req.user._id);

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    const currentReply =
      reply || message.editedReply || message.suggestedResponse || "";

    const refinedText = await refineSupportReply({
      replyText: currentReply,
      tone: tone || "formal",
      subject: message.subject,
      customerMessage: message.body,
      kbSnippet,
    });

    res.send({
      refinedReply: refinedText,
    });
  } catch (error) {
    console.error("Failed to refine reply with AI:", error);

    res.status(500).send({
      error: error.message || "Failed to refine reply with AI",
    });
  }
});

// Escalate ticket
router.post("/messages/:id/escalate", requireAuth, async (req, res) => {
  try {
    const message = await findUserMessage(req.params.id, req.user._id);

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    message.isEscalated = true;
    message.escalatedAt = new Date();
    message.status = "Escalated";

    if (req.body?.reason && typeof req.body.reason === "string") {
      message.escalationReason = req.body.reason;
    }

    await message.save();

    res.send(message);
  } catch (error) {
    console.error("Failed to escalate ticket:", error);

    res.status(500).send({
      error: error.message || "Failed to escalate ticket",
    });
  }
});

// Send Gmail reply for ticket
router.post("/messages/:id/send", requireAuth, async (req, res) => {
  try {
    const reply =
      req.body?.reply ??
      req.body?.editedReply ??
      req.body?.suggestedResponse;

    if (!reply || typeof reply !== "string" || !reply.trim()) {
      return res.status(400).send({
        error: "Missing or empty reply text in request body",
      });
    }

    const message = await findUserMessage(req.params.id, req.user._id);

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    const trimmedReply = reply.trim();
    const sendResult = await sendGmailReply(
      req.user._id,
      message,
      trimmedReply,
    );

    message.sentAt = new Date();
    message.editedReply = trimmedReply;
    message.suggestedResponse = trimmedReply;
    message.status = "Resolved";
    await message.save();

    res.send({
      message: "Reply sent successfully via Gmail",
      ticket: message,
      sendResult: {
        id: sendResult?.id,
        threadId: sendResult?.threadId,
      },
    });
  } catch (error) {
    console.error("Failed to send Gmail reply:", error);

    const statusCode = error.statusCode || 500;
    res.status(statusCode).send({
      error: error.message || "Failed to send reply via Gmail",
    });
  }
});


// Generate AI reply draft
router.post("/messages/:id/draft-reply", requireAuth, async (req, res) => {
  try {
    const message = await findUserMessage(
      req.params.id,
      req.user._id
    );

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    const draft =
      message.suggestedResponse ||
      `Hello,

Thank you for contacting support. We have received your request and our team will review it shortly.

Regards,
Support Team`;

    message.suggestedResponse = draft;
    await message.save();

    res.send({
      message,
      draft,
      source: "fallback",
    });

  } catch (error) {
    console.error("Draft reply error:", error);

    res.status(500).send({
      error: "Failed to generate reply draft",
    });
  }
});


// Frontend send-reply compatibility route
router.post("/messages/:id/send-reply", requireAuth, async (req, res) => {
  try {
    const reply =
      req.body?.replyBody ||
      req.body?.reply ||
      req.body?.editedReply ||
      "";

    if (!reply.trim()) {
      return res.status(400).send({
        error: "Missing reply text",
      });
    }

    const message = await findUserMessage(
      req.params.id,
      req.user._id
    );

    if (!message) {
      return res.status(404).send({
        error: "Message not found",
      });
    }

    const sendResult = await sendGmailReply(
      req.user._id,
      message,
      reply.trim()
    );

    message.sentAt = new Date();
    message.editedReply = reply.trim();
    message.suggestedResponse = reply.trim();
    message.status = "Resolved";

    await message.save();

    res.send({
      message,
      sendResult,
    });

  } catch (error) {
    console.error("Send reply error:", error);

    res.status(500).send({
      error: error.message || "Failed to send reply",
    });
  }
});


// Generate AI reply draft

router.post("/assistant", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).send({
        error: "Question is required",
      });
    }

    const answer = await askAssistant(question);

    res.send({
      answer,
      source: "gemini",
    });

  } catch (error) {
    console.error("Assistant route error:", error);

    res.status(500).send({
      error: "AI Assistant failed",
    });
  }
});

router.post("/assistant/create-deadline", requireAuth, async (req,res)=>{
  try {

    const {
      subject,
      message
    } = req.body;


    const deadlineAI = await extractDeadline(
      message || ""
    );


    if(!deadlineAI.deadline){
      return res.status(400).send({
        error:"No deadline detected"
      });
    }


    const event = await createCalendarDeadline({

      accessToken:req.user.accessToken,

      refreshToken:req.user.refreshToken,

      subject:
        subject || "AI Support Deadline",

      deadline:
        deadlineAI.deadline,

      reason:
        deadlineAI.deadlineReason

    });

    if (!event.success && event.needsReconnect) {
      return res.status(403).send({
        success: false,
        error: event.error,
        needsReconnect: true,
        provider: event.provider || "google-calendar",
        statusCode: event.statusCode || 403,
        event,
      });
    }

    res.send({
      success: event.success,
      event
    });


  } catch(error){

    console.error(
      "Calendar AI error:",
      error
    );

    res.status(500).send({
      error:"Failed creating calendar event"
    });

  }
});

router.get("/calendar/status", requireAuth, async (req, res) => {
  const status = await checkCalendarAccess({
    accessToken: req.user.accessToken,
    refreshToken: req.user.refreshToken,
  });

  res.status(status.needsReconnect ? 403 : 200).send(status);
});

export { router as apiRouter };
























