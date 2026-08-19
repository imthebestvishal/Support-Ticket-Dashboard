import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";
import mongoose from "mongoose";
import { User } from "../models/user.js";
import { saveMemoryUser } from "../services/memoryStore.js";

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
  const frontend =
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

  if (
    redirectUrl &&
    (redirectUrl.startsWith(frontend) ||
      redirectUrl.startsWith("http://localhost"))
  ) {
    req.session.redirectAfterAuth = redirectUrl;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",

    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.profile"
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

    const oauth2 =
      google.oauth2({
        version: "v2",
        auth: oauth2Client
      });

    const userInfo =
      await oauth2.userinfo.get();

    // ===============================
    // SAVE USER
    // ===============================
    const updateData = {
      googleId: email,
      email: email,
      picture: userInfo.data.picture || "",
      name: userInfo.data.name || "",
      accessToken: tokens.access_token,
      tokenExpiry: tokens.expiry_date
    };

    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }

    const user =
      mongoose.connection.readyState === 1
        ? await User.findOneAndUpdate(
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
          )
        : saveMemoryUser(updateData);

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

      const baseRedirectUrl =
        req.session.redirectAfterAuth ||
        `${frontend}/#/dashboard`;

      req.session.redirectAfterAuth = undefined;

      const redirectUrl = new URL(baseRedirectUrl);
      redirectUrl.searchParams.set("gmail_connected", "true");
      redirectUrl.searchParams.set("email", email);

      console.log(
        "Redirecting to:",
        redirectUrl.toString()
      );

      res.redirect(redirectUrl.toString());
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

