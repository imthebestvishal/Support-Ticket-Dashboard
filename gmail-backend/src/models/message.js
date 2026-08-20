import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    gmailMessageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    gmailThreadId: {
      type: String,
      default: "",
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
      enum: [
        "Technical",
        "Account",
        "Billing",
        "Finance",
        "Personal",
        "Promotions",
        "Social",
        "Education",
        "Job/Career",
        "Security",
        "General",
        "Other",
      ],
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

    classificationReason: {
      type: String,
      default: "",
    },

    emailType: {
      type: String,
      default: "",
    },

    emailTypeReason: {
      type: String,
      default: "",
    },

    replyDraft: {
      type: String,
      default: "",
    },

    replyDraftProvider: {
      type: String,
      default: "",
    },

    eventTitle: {
      type: String,
      default: "",
    },

    eventDateTime: {
      type: Date,
      default: null,
    },

    eventVenue: {
      type: String,
      default: "",
    },

    eventConfidence: {
      type: Number,
      default: 0,
    },

    eventNotes: {
      type: String,
      default: "",
    },

    calendarEventId: {
      type: String,
      default: "",
    },

    calendarEventLink: {
      type: String,
      default: "",
    },

    sentReply: {
      type: String,
      default: "",
    },

    replySentAt: {
      type: Date,
      default: null,
    },

    isTicket: {
      type: Boolean,
      default: true,
    },

    isActionable: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved"],
      default: "Open",
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Message = mongoose.model("Message", messageSchema);
