# Neon Auth Vite React App

This app is preconfigured with Neon Auth and React Router.

## Setup

```bash
cd neon-auth-app
pnpm install
pnpm dev
```

## Environment

Add your Neon Auth URL in `.env`:

```dotenv
VITE_NEON_AUTH_URL=https://ep-withered-sun-axmlzlaa.neonauth.c-4.us-east-2.aws.neon.tech/neondb/auth
```

## Pages

- `/` - Home page
- `/auth` - Sign in / Sign up page
- `/account` - Account management page

## Notes

- `NeonAuthUIProvider` supplies auth context to components.
- `NeonAuthSignin`, `NeonAuthSignup`, and `NeonAuthAccount` are Neon UI components.
