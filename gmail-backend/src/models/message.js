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



