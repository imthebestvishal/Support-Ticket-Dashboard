import { google } from "googleapis";

// Prefix used in the calendar event title for each AI-detected event type.
const EVENT_TYPE_LABELS = {
  Deadline: "Support Deadline",
  Meeting: "Support Meeting",
  Appointment: "Support Appointment",
  "Follow-up": "Support Follow-up",
  Reminder: "Support Reminder",
  Callback: "Support Callback",
};

const EVENT_TYPE_DEFAULT_DESCRIPTIONS = {
  Deadline: "AI detected customer deadline",
  Meeting: "AI detected meeting from customer email",
  Appointment: "AI detected appointment from customer email",
  "Follow-up": "AI detected promised follow-up from customer email",
  Reminder: "AI detected reminder from customer email",
  Callback: "AI detected promised callback from customer email",
};

function googleErrorStatus(error) {
  return (
    error?.code ||
    error?.response?.status ||
    error?.response?.statusCode ||
    500
  );
}

function isGoogleCalendarPermissionError(error) {
  const text = [
    error?.message,
    error?.response?.data?.error,
    error?.response?.data?.error_description,
    error?.response?.data?.message,
    JSON.stringify(error?.errors || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("insufficient") ||
    text.includes("permission") ||
    text.includes("forbidden") ||
    text.includes("scope") ||
    text.includes("invalid_grant") ||
    text.includes("invalid credentials") ||
    text.includes("login required") ||
    text.includes("unauthorized") ||
    text.includes("insufficient authentication")
  );
}

function calendarPermissionFailure(error, type = "Deadline") {
  return {
    success: false,
    status: "Failed",
    type,
    error:
      "Calendar permission missing. Reconnect Google and approve Calendar access.",
    needsReconnect: true,
    provider: "google-calendar",
    statusCode: googleErrorStatus(error),
  };
}

/*
 * Creates a Google Calendar event for ANY AI-detected ticket event -
 * deadline, meeting, appointment, follow-up, reminder, or promised
 * callback. This is the single source of truth for calendar event
 * creation; every caller (Gmail sync, manual assistant actions, etc.)
 * should go through this function instead of calling the Google
 * Calendar API directly.
 *
 * This never throws: any Google API failure (expired token, missing
 * scope, network error, etc.) is caught and returned as a structured
 * failure result instead of bubbling up. Callers persist calendar
 * event details onto the Message document, and a Calendar hiccup
 * should never prevent a ticket from being saved/analyzed.
 *
 * Returns:
 *   { success: true, id, htmlLink, status: "Scheduled", type, raw }
 *   { success: false, error: string, status: "Failed", type }
 *   { success: false, error: "No date/time provided", status: "None", type }
 */
export async function createCalendarEvent({
  accessToken,
  refreshToken,
  subject,
  dateTime,
  reason,
  type = "Deadline",
}) {

  const eventType = EVENT_TYPE_LABELS[type] ? type : "Deadline";

  console.log("Calendar event request:", {
    type: eventType,
    subject,
    dateTime,
    reason,
  });

  if (!dateTime) {
    console.log("No date/time provided for calendar event");
    return {
      success: false,
      status: "None",
      type: eventType,
      error: "No date/time provided",
    };
  }

  if (!accessToken && !refreshToken) {
    console.log("Cannot create calendar event: no Google tokens available");
    return {
      success: false,
      status: "Failed",
      type: eventType,
      error: "Gmail account is not connected",
      needsReconnect: true,
      provider: "google-calendar",
    };
  }

  try {
    const oauth2Client =
      new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });


    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });


    const start = new Date(dateTime);

    const end =
      new Date(
        start.getTime() + 60 * 60 * 1000
      );


    const event =
      await calendar.events.insert({

        calendarId: "primary",

        requestBody: {

          summary:
            `${EVENT_TYPE_LABELS[eventType]}: ${subject}`,

          description:
            reason ||
            EVENT_TYPE_DEFAULT_DESCRIPTIONS[eventType],

          start:{
            dateTime:
              start.toISOString(),
          },

          end:{
            dateTime:
              end.toISOString(),
          },

          reminders:{
            useDefault:false,
            overrides:[
              {
                method:"popup",
                minutes:30
              }
            ]
          }
        }
      });


    console.log("Google Calendar event created:", event.data.id);

    return {
      success: true,
      status: "Scheduled",
      type: eventType,
      id: event.data.id,
      htmlLink: event.data.htmlLink || null,
      raw: event.data,
    };
  } catch (error) {
    console.error("Google Calendar event creation failed:", error.message);

    if (isGoogleCalendarPermissionError(error)) {
      return calendarPermissionFailure(error, eventType);
    }

    return {
      success: false,
      status: "Failed",
      type: eventType,
      error: error.message || "Failed to create calendar event",
      provider: "google-calendar",
      statusCode: googleErrorStatus(error),
    };
  }
}

export async function checkCalendarAccess({
  accessToken,
  refreshToken,
}) {
  if (!accessToken && !refreshToken) {
    return {
      connected: false,
      calendarPermission: false,
      needsReconnect: true,
      provider: "google-calendar",
      error: "Google account is not authenticated.",
    };
  }

  const oauth2Client =
    new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client,
  });

  try {
    await calendar.events.list({
      calendarId: "primary",
      maxResults: 1,
      singleEvents: true,
      timeMin: new Date().toISOString(),
    });

    return {
      connected: true,
      calendarPermission: true,
      needsReconnect: false,
      provider: "google-calendar",
    };
  } catch (error) {
    if (isGoogleCalendarPermissionError(error)) {
      return {
        connected: true,
        calendarPermission: false,
        needsReconnect: true,
        provider: "google-calendar",
        statusCode: googleErrorStatus(error),
        error:
          "Calendar permission missing. Reconnect Google and approve Calendar access.",
      };
    }

    return {
      connected: true,
      calendarPermission: false,
      needsReconnect: false,
      provider: "google-calendar",
      statusCode: googleErrorStatus(error),
      error: error.message || "Failed to check Calendar access.",
    };
  }
}

/*
 * Backward-compatible deadline-only wrapper around createCalendarEvent,
 * kept for callers that only ever create deadline events (e.g. the
 * manual "create deadline" assistant action). Delegates to the same
 * single source of calendar creation above.
 *
 * Returns the same shape as before: { success, status, id, htmlLink, error, raw }
 */
export async function createCalendarDeadline({
  accessToken,
  refreshToken,
  subject,
  deadline,
  reason,
}) {
  const result = await createCalendarEvent({
    accessToken,
    refreshToken,
    subject,
    dateTime: deadline,
    reason,
    type: "Deadline",
  });

  // Preserve the original error message wording for "no deadline provided"
  if (result.status === "None") {
    return { ...result, error: "No deadline provided" };
  }

  return result;
}

