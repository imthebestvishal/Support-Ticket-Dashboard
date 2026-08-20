import { createAuthClient } from "@neondatabase/neon-js/auth";

const defaultAuthUrl =
  "https://ep-withered-sun-axmlzlaa.neonauth.c-4.us-east-2.aws.neon.tech/neondb/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL || defaultAuthUrl;

export const authClient = createAuthClient(authUrl);
