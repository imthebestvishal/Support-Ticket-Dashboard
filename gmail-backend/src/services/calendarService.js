import { google } from "googleapis";

/*
 * Creates a Google Calendar event for an AI-detected ticket deadline.
 *
 * This never throws: any Google API failure (expired token, missing
 * scope, network error, etc.) is caught and returned as a structured
 * failure result instead of bubbling up. Callers persist calendar
 * event details onto the Message document, and a Calendar hiccup
 * should never prevent a ticket from being saved/analyzed.
 *
 * Returns:
 *   { success: true, id, htmlLink, status: "Scheduled", raw }
 *   { success: false, error: string, status: "Failed" }
 *   { success: false, error: "No deadline provided", status: "None" }
 */
export async function createCalendarDeadline({
  accessToken,
  refreshToken,
  subject,
  deadline,
  reason,
}) {

  console.log("Calendar deadline request:", {
    subject,
    deadline,
    reason
  });

  if (!deadline) {
    console.log("No deadline provided");
    return {
      success: false,
      status: "None",
      error: "No deadline provided",
    };
  }

  if (!accessToken && !refreshToken) {
    console.log("Cannot create calendar event: no Google tokens available");
    return {
      success: false,
      status: "Failed",
      error: "Gmail account is not connected",
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


    const start = new Date(deadline);

    const end =
      new Date(
        start.getTime() + 60 * 60 * 1000
      );


    const event =
      await calendar.events.insert({

        calendarId: "primary",

        requestBody: {

          summary:
            `Support Deadline: ${subject}`,

          description:
            reason ||
            "AI detected customer deadline",

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
      id: event.data.id,
      htmlLink: event.data.htmlLink || null,
      raw: event.data,
    };
  } catch (error) {
    console.error("Google Calendar event creation failed:", error.message);

    return {
      success: false,
      status: "Failed",
      error: error.message || "Failed to create calendar event",
    };
  }
}

