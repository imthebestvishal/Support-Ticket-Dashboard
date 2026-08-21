import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    gmailMessageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sender: {
      type: String,
      default: "",
    },

    subject: {
      type: String,
      default: "",
    },

    body: {
      type: String,
      default: "",
    },

    receivedAt: {
      type: Date,
      default: Date.now,
    },

    category: {
      type: String,
      default: "Other",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    summary: {
      type: String,
      default: "",
    },

    sentiment: {
      type: String,
      enum: ["Positive", "Neutral", "Negative"],
      default: "Neutral",
    },

    suggestedResponse: {
      type: String,
      default: "",
    },

    editedReply: {
      type: String,
      default: "",
    },

    sentAt: {
      type: Date,
      default: null,
    },

    isEscalated: {
      type: Boolean,
      default: false,
    },

    escalatedAt: {
      type: Date,
      default: null,
    },

    escalationReason: {
      type: String,
      default: "",
    },

    escalationRisk: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },

    escalationRecommendation: {
      type: String,
      default: "",
    },

    deadline: {
      type: Date,
      default: null,
    },

    deadlineReason: {
      type: String,
      default: "",
    },

    deadlineStatus: {
      type: String,
      enum: [
        "None",
        "Upcoming",
        "Due Soon",
        "Overdue",
        "Completed"
      ],
      default: "None",
    },

    // Primary/most relevant AI-created calendar event for this ticket
    // (Deadline events take priority when several event types are
    // detected on the same ticket; see gmailService.js).
    calendarEventId: {
      type: String,
      default: null,
    },

    calendarEventLink: {
      type: String,
      default: null,
    },

    calendarEventStatus: {
      type: String,
      enum: ["None", "Scheduled", "Failed"],
      default: "None",
    },

    calendarEventType: {
      type: String,
      enum: [
        "None",
        "Deadline",
        "Meeting",
        "Appointment",
        "Follow-up",
        "Reminder",
        "Callback",
      ],
      default: "None",
    },

    calendarEventError: {
      type: String,
      default: "",
    },

    calendarEventNeedsReconnect: {
      type: Boolean,
      default: false,
    },

    calendarEventCreatedAt: {
      type: Date,
      default: null,
    },

    // Every AI-detected calendar event created for this ticket (a single
    // email can surface more than one: e.g. a meeting AND a follow-up).
    calendarEvents: {
      type: [
        {
          type: {
            type: String,
            enum: [
              "Deadline",
              "Meeting",
              "Appointment",
              "Follow-up",
              "Reminder",
              "Callback",
            ],
          },
          title: { type: String, default: "" },
          dateTime: { type: Date, default: null },
          reason: { type: String, default: "" },
          calendarEventId: { type: String, default: null },
          calendarEventLink: { type: String, default: null },
          calendarEventStatus: {
            type: String,
            enum: ["Scheduled", "Failed"],
          },
          calendarEventError: { type: String, default: "" },
          calendarEventNeedsReconnect: { type: Boolean, default: false },
          calendarEventCreatedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },

    isTicket: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["Open", "Pending", "In Progress", "Resolved", "Escalated", "Deleted"],
      default: "Open",
    },
  },
  {
    timestamps: true,
  },
);

export const Message = mongoose.model("Message", messageSchema);



