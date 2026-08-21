import express from "express";
import { KnowledgeArticle } from "../models/knowledgeArticle.js";

const router = express.Router();

const sampleArticles = [
  {
    title: "Standard Refund Policy & Processing Timeline",
    content:
      "Customers are eligible for a full refund within 30 calendar days of item delivery. Once approved, refunds are credited back to the original payment method within 3-5 business days. For opened or used software/licenses, partial refunds or credits may apply based on tier review.",
    category: "Billing",
    tags: ["refund", "billing", "return", "payment", "timeline"],
  },
  {
    title: "Account Password Reset & Multi-Factor Troubleshooting",
    content:
      "Users can initiate a self-service password reset by visiting the /auth page and selecting 'Forgot Password'. If MFA codes fail to deliver via SMS, advise checking carrier spam filters or using the one-time backup codes generated during initial security setup. Support agents may issue a temporary 1-hour bypass link after verifying identity.",
    category: "Account",
    tags: ["password", "mfa", "login", "security", "access"],
  },
  {
    title: "Resolving Webhook Delivery Failures & 504 Gateway Timeouts",
    content:
      "Webhook delivery drops are often caused by client endpoints exceeding the 5000ms response threshold. Check that receiver servers return an immediate HTTP 200/202 before delegating processing to background workers. Review the webhook retry exponential backoff queue in the developer settings panel.",
    category: "Technical",
    tags: ["webhook", "timeout", "api", "504", "error", "integration"],
  },
  {
    title: "Order Tracking & Delayed Carrier Status Inquiries",
    content:
      "Tracking numbers are dispatched automatically via email upon carrier handoff. If tracking has not updated for 48 hours, check carrier logistics advisories or submit a tracer request. Expedited replacement packages can be initiated if no transit scan appears after 5 business days.",
    category: "General",
    tags: ["shipping", "tracking", "delivery", "carrier", "order"],
  },
  {
    title: "Subscription Tier Upgrades, Invoicing & VAT Exemption",
    content:
      "Subscription plan changes take effect immediately on a prorated basis. For corporate VAT exemptions or custom invoicing requirements, accounts must submit a valid tax identification certificate under Billing Settings. Enterprise annual plans receive dedicated account manager assignment.",
    category: "Billing",
    tags: ["subscription", "tier", "invoice", "vat", "tax", "pricing"],
  },
  {
    title: "Service Outage Escalation & Priority SLA Levels",
    content:
      "Critical Severity 1 outages affecting >10% of workspace traffic require a 15-minute response SLA. Use the 'Escalate Issue' button in SentiMail to alert the on-call engineer and post a status banner to the customer notification portal.",
    category: "Technical",
    tags: ["sla", "outage", "escalation", "incident", "downtime"],
  },
];

// Seed knowledge base if empty (safe: never overwrites existing articles)
router.post("/seed", async (req, res) => {
  try {
    const count = await KnowledgeArticle.countDocuments();
    if (count > 0) {
      return res.send({
        message: `Knowledge base already has ${count} article(s).`,
        count,
      });
    }

    const inserted = await KnowledgeArticle.insertMany(sampleArticles);
    res.status(201).send({
      message: `Seeded ${inserted.length} knowledge articles.`,
      count: inserted.length,
      articles: inserted,
    });
  } catch (error) {
    console.error("Failed to seed articles:", error);
    res.status(500).send({
      error: error.message || "Failed to seed knowledge articles",
    });
  }
});

// Search knowledge base articles (case-insensitive search on title, content, category, tags)
router.get("/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      const articles = await KnowledgeArticle.find()
        .sort({ updatedAt: -1 })
        .limit(20);
      return res.send(articles);
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    const articles = await KnowledgeArticle.find({
      $or: [
        { title: regex },
        { content: regex },
        { category: regex },
        { tags: regex },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(20);

    res.send(articles);
  } catch (error) {
    console.error("Failed to search articles:", error);
    res.status(500).send({
      error: error.message || "Failed to search knowledge articles",
    });
  }
});

// List all knowledge base articles
router.get("/articles", async (req, res) => {
  try {
    const category = req.query.category;
    const filter =
      category && typeof category === "string" ? { category } : {};

    const articles = await KnowledgeArticle.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50);

    res.send(articles);
  } catch (error) {
    console.error("Failed to list articles:", error);
    res.status(500).send({
      error: error.message || "Failed to list knowledge articles",
    });
  }
});

export { router as knowledgeRouter };
