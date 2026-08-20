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



export function extractDeadline(message = "") {

  const text = message.toLowerCase();

  let deadline = null;
  let deadlineReason = "";

  if (
    text.includes("today") ||
    text.includes("urgent") ||
    text.includes("asap")
  ) {
    deadline = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    deadlineReason =
      "Customer requested urgent resolution";
  }

  if (text.includes("tomorrow")) {

    deadline = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    );

    deadlineReason =
      "Customer requested completion tomorrow";
  }

  return {
    deadline,
    deadlineReason,
    deadlineStatus:
      deadline ? "Upcoming" : "None"
  };
}
export {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_SENTIMENTS
};


