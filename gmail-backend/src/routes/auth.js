import express from "express";
import crypto from "crypto";
import { google } from "googleapis";
import { User } from "../models/user.js";

const router = express.Router();

function createAuthToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173")
    .replace(/\/+$/, "");
}

function dashboardRedirectUrl(baseUrl = frontendUrl()) {
  const cleanBase = String(baseUrl || frontendUrl()).replace(/\/+$/, "");

  return `${cleanBase}/#/dashboard`;
}

function isAllowedRedirect(value) {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    const redirect = new URL(value);
    const configuredFrontend = new URL(frontendUrl());

    return (
      redirect.origin === configuredFrontend.origin ||
      redirect.origin === "http://localhost:5173" ||
      redirect.origin === "http://127.0.0.1:5173"
    );
  } catch {
    return false;
  }
}

function appendHashQuery(url, params) {
  const [beforeHash, hash = ""] = url.split("#");
  const hashPath = hash || "/dashboard";
  const separator = hashPath.includes("?") ? "&" : "?";

  return `${beforeHash}#${hashPath}${separator}${params.toString()}`;
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

router.get("/google", (req, res) => {
  const redirectUrl = req.query.redirect;

  if (isAllowedRedirect(redirectUrl)) {
    req.session.redirectAfterAuth = redirectUrl;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",

    redirect_uri: process.env.GOOGLE_REDIRECT_URI,

    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ],

    prompt: "consent",
  });

  res.redirect(authUrl);
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send({
      error: "Missing code query parameter",
    });
  }

  try {
    console.log("Google authorization code received");

    const { tokens } = await oauth2Client.getToken(code);

    console.log("Google tokens received");

    oauth2Client.setCredentials(tokens);

    /*
     * Get Gmail profile
     */
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const profile = await gmail.users.getProfile({
      userId: "me",
    });

    const email = profile.data.emailAddress;

    if (!email) {
      throw new Error(
        "Google did not return Gmail email address",
      );
    }

    console.log(
      "Gmail profile received:",
      email,
    );

    /*
     * Save/update user
     */
    const user = await User.findOneAndUpdate(
      { googleId: email },
      {
        googleId: email,
        email: email,
        accessToken: tokens.access_token,

        /*
         * Google may not return a refresh token
         * on every login.
         *
         * Keep the existing refresh token if one
         * already exists.
         */
        ...(tokens.refresh_token
          ? {
              refreshToken: tokens.refresh_token,
            }
          : {}),

        tokenExpiry: tokens.expiry_date,
      },
      {
        upsert: true,
        new: true,
      },
    );

    /*
     * Determine where to send the user after login.
     */
    const redirectTarget =
      req.session.redirectAfterAuth ||
      dashboardRedirectUrl();

    /*
     * Store authenticated user in session.
     */
    req.session.userId = user._id.toString();

    req.session.redirectAfterAuth = undefined;

    console.log(
      "Google OAuth completed successfully",
    );

    console.log(
      "Session userId:",
      req.session.userId,
    );

    /*
     * IMPORTANT:
     * Explicitly save the session before redirecting.
     */
    req.session.save((err) => {
      if (err) {
        console.error(
          "Session save error:",
          err,
        );

        return res.status(500).send({
          error: "Failed to save login session",
        });
      }

      console.log(
        "Session saved successfully",
      );

      const params = new URLSearchParams({
        gmail_connected: "true",
        email,
        auth_token: createAuthToken(user._id.toString()),
      });

      res.redirect(appendHashQuery(redirectTarget, params));
    });
  } catch (error) {
    console.error(
      "Google OAuth error:",
      error,
    );

    res.status(500).send({
      error: "Failed to complete Google OAuth",
    });
  }
});

export { router as authRouter };

