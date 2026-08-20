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


  return {
    category,
    priority,
    sentiment,
    summary: message.substring(0,120),
  };
}


export {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_SENTIMENTS
};
