import { google } from "googleapis";

export async function createCalendarDeadline({
  accessToken,
  refreshToken,
  subject,
  deadline,
  reason,
}) {

  if (!deadline) {
    return null;
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


  return event.data;
}
