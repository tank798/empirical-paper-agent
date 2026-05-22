# 经管实证论文 AI Agent

Monorepo for the MVP web product described in `经管科研论文_agent_prd_与部署方案.md`.
GitHub `main` is the source of truth for the current Vercel frontend. Railway backend deployment automation is disabled.


## Packages

- `apps/web`: Next.js frontend
- `apps/api`: NestJS REST API
- `packages/shared`: shared types and schemas
- `packages/prompts`: prompt templates and manifest

## Development

1. Install dependencies: `corepack pnpm install`
2. Configure `apps/api/.env` with `DATABASE_URL` and `OPENAI_API_KEY`
3. Run Prisma migration / generate
4. Start API and web apps

## Backend Deployment

Railway backend deployment automation is currently disabled because the Railway project is not active. The GitHub Actions workflow that triggered Railway deploys has been removed.

For local development, run the API on `http://localhost:4000/api`. For a future hosted backend, set `API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` for the web app instead of relying on a hard-coded Railway URL.

## GitHub Deploys

- Vercel frontend is connected to GitHub and auto-deploys from `main` using `apps/web` as the root directory.
- Railway backend deploys are not triggered from GitHub Actions.
