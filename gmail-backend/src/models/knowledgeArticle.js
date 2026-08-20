import mongoose from "mongoose";

const knowledgeArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "General",
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

knowledgeArticleSchema.index({
  title: "text",
  content: "text",
  category: "text",
  tags: "text",
});

export const KnowledgeArticle = mongoose.model(
  "KnowledgeArticle",
  knowledgeArticleSchema
);
