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



// Calendar-relevant event types an AI-analyzed email/ticket can surface.
// "Deadline" is kept first so it stays the default/primary event type
// whenever both a deadline and other event types are detected.
const ALLOWED_CALENDAR_EVENT_TYPES = [
  "Deadline",
  "Meeting",
  "Appointment",
  "Follow-up",
  "Reminder",
  "Callback",
];

/*
 * Analyzes a ticket's text for EVERY calendar-relevant event the AI can
 * find, not only deadlines: meetings, appointments, follow-ups, reminders,
 * and promised callbacks/customer commitments.
 *
 * Returns: { events: [{ type, title, dateTime, reason }] }
 * `dateTime` is a Date instance (or null if the model returned an
 * unparsable date, in which case the event is dropped since a calendar
 * event cannot be created without a valid date).
 */
export async function extractCalendarEvents(message = "") {
  try {
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(`
You are a support ticket calendar-event detector.

Analyze this customer email and find EVERY date/time-bound item worth
scheduling on a calendar - not only deadlines.

Email:
${message}

Return ONLY valid JSON in exactly this format:

{
  "events": [
    {
      "type": "Deadline",
      "title": "Short label for the event",
      "dateTime": "ISO date-time string",
      "reason": "Why this event exists / what happens"
    }
  ]
}

Rules:
- "type" must be exactly one of: Deadline, Meeting, Appointment, Follow-up, Reminder, Callback.
  - Deadline: a due date/time the customer or team must meet (e.g. "by Friday", "within 2 days", "ASAP", "urgent").
  - Meeting: a scheduled meeting or call between the customer and the team.
  - Appointment: a booked appointment or scheduled visit.
  - Follow-up: a promised follow-up on the ticket (e.g. "we'll check back in 3 days").
  - Reminder: something that needs a reminder but isn't a hard deadline.
  - Callback: a promised callback or customer commitment to reach out (e.g. "I'll call you back tomorrow at 3pm").
- Only include an event if a specific date/time (or a clearly resolvable relative date/time, e.g. "tomorrow at 3pm", "next Monday") is mentioned or implied.
- Resolve relative dates using the email's own context; if no year/date context is available, assume the near future.
- Do not invent events that are not supported by the email content.
- If there are no calendar-worthy events, return:
{
  "events": []
}
`);

    const text = result.response.text();

    const clean = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const ai = JSON.parse(clean);

    const rawEvents = Array.isArray(ai.events) ? ai.events : [];

    const events = rawEvents
      .map((event) => {
        const type = ALLOWED_CALENDAR_EVENT_TYPES.includes(event?.type)
          ? event.type
          : null;

        const dateTime = event?.dateTime ? new Date(event.dateTime) : null;

        if (!type || !dateTime || Number.isNaN(dateTime.getTime())) {
          return null;
        }

        return {
          type,
          title: event.title || "",
          dateTime,
          reason: event.reason || "",
        };
      })
      .filter(Boolean);

    return { events };
  } catch (error) {
    console.error("Calendar event AI error:", error);

    return { events: [] };
  }
}

/*
 * Backward-compatible deadline-only helper, kept for callers (like the
 * manual "create deadline" endpoint) that only care about a single
 * deadline. Internally reuses extractCalendarEvents so the underlying
 * detection logic has one implementation.
 */
export async function extractDeadline(message = "") {
  const { events } = await extractCalendarEvents(message);

  const deadlineEvent = events.find((event) => event.type === "Deadline");

  if (!deadlineEvent) {
    return {
      deadline: null,
      deadlineReason: "",
      deadlineStatus: "None",
    };
  }

  return {
    deadline: deadlineEvent.dateTime,
    deadlineReason: deadlineEvent.reason,
    deadlineStatus: "Upcoming",
  };
}

export {
  ALLOWED_CATEGORIES,
  ALLOWED_PRIORITIES,
  ALLOWED_SENTIMENTS,
  ALLOWED_CALENDAR_EVENT_TYPES,
};




