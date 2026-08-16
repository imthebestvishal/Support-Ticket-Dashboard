import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import { User } from "../models/user.js";

dotenv.config();

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ===============================
// START GOOGLE LOGIN
// ===============================
router.get("/google", (req, res) => {
  const redirectUrl = req.query.redirect;

  if (
    redirectUrl &&
    redirectUrl.startsWith("http://localhost")
  ) {
    req.session.redirectAfterAuth = redirectUrl;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",

    scope: [
      "https://www.googleapis.com/auth/gmail.readonly"
    ],

    prompt: "select_account consent"
  });

  console.log("Starting Google OAuth");
  console.log(
    "Google Client ID loaded:",
    Boolean(process.env.GOOGLE_CLIENT_ID)
  );
  console.log(
    "Google Redirect URI:",
    process.env.GOOGLE_REDIRECT_URI
  );

  res.redirect(authUrl);
});

// ===============================
// GOOGLE CALLBACK
// ===============================
router.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send({
      error: "Missing Google authorization code"
    });
  }

  try {
    console.log("Google authorization code received");

    const { tokens } =
      await oauth2Client.getToken(code);

    console.log("Google tokens received");

    oauth2Client.setCredentials(tokens);

    // ===============================
    // GET GMAIL PROFILE
    // ===============================
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client
    });

    const profile =
      await gmail.users.getProfile({
        userId: "me"
      });

    const email =
      profile.data.emailAddress;

    if (!email) {
      throw new Error(
        "Google did not return Gmail email address"
      );
    }

    console.log(
      "Gmail profile received:",
      email
    );

    // ===============================
    // SAVE USER
    // ===============================
    const updateData = {
      googleId: email,
      email: email,
      accessToken: tokens.access_token,
      tokenExpiry: tokens.expiry_date
    };

    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }

    const user =
      await User.findOneAndUpdate(
        {
          $or: [
            { googleId: email },
            { email: email }
          ]
        },
        {
          $set: updateData
        },
        {
          upsert: true,
          new: true
        }
      );

    // ===============================
    // SAVE SESSION
    // ===============================
    req.session.userId =
      user._id.toString();

    req.session.gmailEmail = email;

    console.log(
      "Google OAuth completed successfully"
    );

    // ===============================
    // SAVE SESSION THEN REDIRECT
    // ===============================
    req.session.save((sessionError) => {
      if (sessionError) {
        console.error(
          "Session save error:",
          sessionError
        );

        return res.status(500).send({
          error:
            "Failed to save login session"
        });
      }

      console.log(
        "Session saved successfully"
      );

      // ===============================
      // REDIRECT TO FRONTEND
      // ===============================
      const frontend =
        process.env.FRONTEND_URL ||
        "http://localhost:5173";

      const redirectUrl =
        `${frontend}/?gmail_connected=true&email=${encodeURIComponent(
          email
        )}`;

      console.log(
        "Redirecting to:",
        redirectUrl
      );

      res.redirect(redirectUrl);
    });

  } catch (error) {
    console.error(
      "Google OAuth error:",
      error
    );

    res.status(500).send({
      error:
        "Failed to complete Google OAuth",
      details:
        error.message
    });
  }
});

export { router as authRouter };

