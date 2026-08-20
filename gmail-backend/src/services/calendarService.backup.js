import { google } from "googleapis";

export async function createCalendarEvent({
  accessToken,
  title,
  deadline,
  reason,
}) {
  const auth = new google.auth.OAuth2();

  auth.setCredentials({
    access_token: accessToken,
  });

  const calendar = google.calendar({
    version: "v3",
    auth,
  });

  const event = {
    summary: title,
    description: reason,

    start: {
      dateTime: new Date(deadline).toISOString(),
    },

    end: {
      dateTime: new Date(
        new Date(deadline).getTime() + 30 * 60 * 1000
      ).toISOString(),
    },

    reminders: {
      useDefault: false,
      overrides: [
        {
          method: "popup",
          minutes: 60,
        },
        {
          method: "email",
          minutes: 1440,
        },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  return response.data;
}