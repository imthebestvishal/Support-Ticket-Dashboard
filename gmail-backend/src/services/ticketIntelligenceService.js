import { GoogleGenerativeAI } from "@google/generative-ai";

const ALLOWED_CATEGORIES = [
  "Technical",
  "Billing",
  "Account",
  "General",
  "Other",
];

const ALLOWED_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

const ALLOWED_SENTIMENTS = [
  "Positive",
  "Neutral",
  "Negative",
];


export function analyzeTicket(message = "") {

  const text = message.toLowerCase();

  let category = "General";
  let priority = "Medium";
  let sentiment = "Neutral";


  if (
    text.includes("payment") ||
    text.includes("bill") ||
    text.includes("invoice") ||
    text.includes("refund")
  ) {
    category = "Billing";
  }


  if (
    text.includes("login") ||
    text.includes("password") ||
    text.includes("account")
  ) {
    category = "Account";
  }


  if (
    text.includes("error") ||
    text.includes("bug") ||
    text.includes("not working")
  ) {
    category = "Technical";
  }


  if (
    text.includes("angry") ||
    text.includes("complaint") ||
    text.includes("urgent")
  ) {
    priority = "High";
    sentiment = "Negative";
  }


  if (
    text.includes("critical") ||
    text.includes("down")
  ) {
    priority = "Urgent";
  }


  let escalationRisk = "Low";
  let escalationRecommendation = "Handle normally";

  if (
    priority === "Urgent" ||
    sentiment === "Negative" ||
    text.includes("lawsuit") ||
    text.includes("manager") ||
    text.includes("complaint")
  ) {
    escalationRisk = "High";
    escalationRecommendation =
      "Escalate to senior support team immediately";
  }
  else if (
    priority === "High" ||
    text.includes("delay") ||
    text.includes("issue")
  ) {
    escalationRisk = "Medium";
    escalationRecommendation =
      "Monitor closely and respond quickly";
  }


  return {
    category,
    priority,
    sentiment,
    summary: message.substring(0,120),
    escalationRisk,
    escalationRecommendation,
  };
}



export async function extractDeadline(message = "") {

  try {

    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
    });


    const result = await model.generateContent(`
You are a support ticket deadline detector.

Analyze this customer email:

${message}

Return ONLY valid JSON.

Format:

{
 "hasDeadline": true or false,
 "deadline": "ISO date string or null",
 "reason": "why this deadline exists"
}

Rules:
- Detect dates mentioned by customer.
- Detect phrases like:
  "before Friday"
  "by tomorrow"
  "within 2 days"
  "ASAP"
  "urgent"
- If no deadline exists return:
{
 "hasDeadline": false,
 "deadline": null,
 "reason": ""
}
`);

    const text = result.response.text();

    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();


    const ai = JSON.parse(clean);


    return {
      deadline: ai.deadline
        ? new Date(ai.deadline)
        : null,

      deadlineReason:
        ai.reason || "",

      deadlineStatus:
        ai.deadline
          ? "Upcoming"
          : "None"
    };


  } catch(error) {

    console.error(
      "Deadline AI error:",
      error
    );

    return {
      deadline:null,
      deadlineReason:"",
      deadlineStatus:"None"
    };

  }
}

export {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_SENTIMENTS
};




