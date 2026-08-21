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

const MONTH_NAMES =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

function inferCalendarEventType(text = "") {
  const lower = text.toLowerCase();

  if (/(deadline|due|closing|closes|expires|last date|submit by)/i.test(lower)) {
    return "Deadline";
  }

  if (/(meeting|webinar|session|conference|interview|call)/i.test(lower)) {
    return "Meeting";
  }

  if (/(appointment|visit)/i.test(lower)) {
    return "Appointment";
  }

  if (/(follow up|follow-up)/i.test(lower)) {
    return "Follow-up";
  }

  if (/(call back|callback)/i.test(lower)) {
    return "Callback";
  }

  return "Reminder";
}

function calendarTitleFromText(text = "") {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine || "Detected calendar event").slice(0, 120);
}

function normalizeDetectedDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function localCalendarEventFallback(message = "") {
  const text = String(message || "");

  if (!/(deadline|due|closing|closes|expires|last date|event|invitation|webinar|meeting|session|appointment|interview|challenge|conference|workshop|call)/i.test(text)) {
    return [];
  }

  const candidates = [];

  const relativePattern =
    /(?:deadline|due|closing|closes|expires|ends?|last date|submit|submission)?[^.\n]{0,80}?\bin\s+(\d{1,3})\s*(hour|hours|day|days)\b/i;
  const relativeMatch = text.match(relativePattern);

  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const ms =
      amount *
      (unit.startsWith("hour")
        ? 60 * 60 * 1000
        : 24 * 60 * 60 * 1000);

    candidates.push({
      dateTime: new Date(Date.now() + ms),
      reason: relativeMatch[0].trim(),
    });
  }

  const tomorrowMatch = text.match(/\btomorrow\b(?:[^.\n]{0,40}?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);

  if (tomorrowMatch) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);

    if (tomorrowMatch[1]) {
      let hour = Number(tomorrowMatch[1]);
      const minute = Number(tomorrowMatch[2] || 0);
      const meridiem = (tomorrowMatch[3] || "").toLowerCase();

      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;

      date.setHours(hour, minute, 0, 0);
    }

    candidates.push({
      dateTime: date,
      reason: tomorrowMatch[0].trim(),
    });
  }

  const monthDatePattern = new RegExp(
    `\\b(?:on|by|before|until|till|date:?|deadline:?|closing:?|closes:?)?\\s*((?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})|(?:${MONTH_NAMES})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:[,\\s]+\\d{4})?)(?:[^.\\n]{0,30}?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm))?`,
    "i"
  );
  const monthDateMatch = text.match(monthDatePattern);

  if (monthDateMatch) {
    const dateText = monthDateMatch[1].replace(/(\d)(st|nd|rd|th)/gi, "$1");
    const hasYear = /\b\d{4}\b/.test(dateText);
    const parsed = new Date(hasYear ? dateText : `${dateText} ${new Date().getFullYear()}`);

    if (!Number.isNaN(parsed.getTime())) {
      let hour = monthDateMatch[2] ? Number(monthDateMatch[2]) : 9;
      const minute = Number(monthDateMatch[3] || 0);
      const meridiem = (monthDateMatch[4] || "").toLowerCase();

      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;

      parsed.setHours(hour, minute, 0, 0);

      candidates.push({
        dateTime: parsed,
        reason: monthDateMatch[0].trim(),
      });
    }
  }

  const numericDateMatch = text.match(
    /\b(?:on|by|before|until|till|date:?|deadline:?|closing:?)?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[^.\n]{0,30}?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i
  );

  if (numericDateMatch) {
    const day = Number(numericDateMatch[1]);
    const month = Number(numericDateMatch[2]) - 1;
    const yearValue = Number(numericDateMatch[3]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    let hour = numericDateMatch[4] ? Number(numericDateMatch[4]) : 9;
    const minute = Number(numericDateMatch[5] || 0);
    const meridiem = (numericDateMatch[6] || "").toLowerCase();

    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    candidates.push({
      dateTime: new Date(year, month, day, hour, minute, 0, 0),
      reason: numericDateMatch[0].trim(),
    });
  }

  const firstUsable = candidates
    .map((candidate) => ({
      ...candidate,
      dateTime: normalizeDetectedDate(candidate.dateTime),
    }))
    .find((candidate) => candidate.dateTime);

  if (!firstUsable) {
    return [];
  }

  return [
    {
      type: inferCalendarEventType(text),
      title: calendarTitleFromText(text),
      dateTime: firstUsable.dateTime,
      reason: firstUsable.reason || "Detected by local calendar fallback",
    },
  ];
}

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

    return {
      events: events.length > 0 ? events : localCalendarEventFallback(message),
    };
  } catch (error) {
    console.error("Calendar event AI error:", error);

    return { events: localCalendarEventFallback(message) };
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




