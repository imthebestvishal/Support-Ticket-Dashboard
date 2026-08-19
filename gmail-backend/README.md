# Gmail API Backend

This is a Node.js + Express backend to connect Gmail, store messages in MongoDB, and analyze them with AgentRouter.

## Setup

1. Copy `.env.example` to `.env` and fill in your values.
   For AI analysis, set `AGENT_ROUTER_TOKEN` to your AgentRouter token. The default model is `gpt-5` and the default base URL is `https://agentrouter.org/v1`.
2. Install dependencies:
   ```bash
   cd gmail-backend
   pnpm install
   ```
3. Start MongoDB locally or use Docker.
4. Run the app:
   ```bash
   pnpm dev
   ```

## Google Cloud setup

1. Go to Google Cloud Console and create a project.
2. Enable the Gmail API.
3. Create OAuth 2.0 credentials for a Web application.
4. Set the authorized redirect URI to:
   ```text
   http://localhost:5000/auth/google/callback
   ```
5. Add the `gmail.readonly` scope to your OAuth consent screen.

## API Endpoints

- `GET /auth/google` — redirect to Google OAuth consent
- `GET /auth/google/callback` — handle OAuth callback and save Gmail account
- `GET /api/gmail/status` — check connection status
- `GET /api/messages` — list stored Gmail messages
- `POST /api/messages/fetch` — fetch new Gmail messages and save them

## Docker

Use Docker Compose to run the backend and MongoDB together:

```bash
cd gmail-backend
docker compose up --build
```
