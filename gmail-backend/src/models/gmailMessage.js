import mongoose from "mongoose";

const GmailMessageSchema = new mongoose.Schema(
  {
    gmailMessageId: { type: String, required: true, unique: true },
    sender: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    receivedAt: { type: Date, required: true },
    analysis: {
      category: { type: String },
      sentiment: { type: String },
      priority: { type: String },
      summary: { type: String },
    },
  },
  { timestamps: true },
);

export const GmailMessage = mongoose.model("GmailMessage", GmailMessageSchema);
