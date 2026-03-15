# 经管实证论文 AI Agent

Monorepo for the MVP web product described in `经管科研论文_agent_prd_与部署方案.md`.
GitHub `main` is the source of truth for the current Vercel frontend and Railway backend deployments.


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

## Railway Backend

The backend is prepared for Railway with [railway.json](/D:/Courses/常用/Codex/科研论文agent/railway.json), [Dockerfile.api](/D:/Courses/常用/Codex/科研论文agent/Dockerfile.api), [.dockerignore](/D:/Courses/常用/Codex/科研论文agent/.dockerignore), and [.railwayignore](/D:/Courses/常用/Codex/科研论文agent/.railwayignore).

Recommended Railway service settings:

- Root directory: repository root
- Builder: Dockerfile
- Dockerfile path: `Dockerfile.api`
- Start command: use the Docker `CMD`

Required environment variables:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_FAST_MODEL`
- `OPENAI_CODE_MODEL`
- `OPENAI_REASONING_MODEL`
- `OPENAI_TIMEOUT_MS`
- `OPENAI_FAST_TIMEOUT_MS`
- `OPENAI_CODE_TIMEOUT_MS`
- `OPENAI_REASONING_TIMEOUT_MS`
- `OPENAI_ENABLE_THINKING`
- `OPENAI_REASONING_ENABLE_THINKING`
- `OPENAI_MAX_TOKENS`
- `OPENAI_FAST_MAX_TOKENS`
- `OPENAI_CODE_MAX_TOKENS`
- `OPENAI_REASONING_MAX_TOKENS`
- `OPENAI_USE_RESPONSE_FORMAT`
- `WEB_ORIGIN`
- `PORT=4000`
- `PROMPTS_DIR=/app/packages/prompts`

Runtime notes:

- The container runs `prisma migrate deploy` before starting NestJS.
- The API listens on `/api` and reads `PORT` from the Railway runtime.
- Prompts are loaded from the repo at `/app/packages/prompts` inside the container.
- `.railwayignore` keeps the upload context limited to the API, shared package, prompts package, and root build files.

## Repeatable API Deploy

Primary release flow from the repository root:

1. Set `RAILWAY_API_TOKEN` in your shell.
2. Run `npx @railway/cli up . --path-as-root -p <railway-project-id> -e production -s api --ci`.

Bundle-based fallback flow:

1. Set `RAILWAY_API_TOKEN` or `RAILWAY_TOKEN` in your shell.
2. Run `powershell -ExecutionPolicy Bypass -File .\scripts\deploy-railway-api.ps1 -ProjectId <railway-project-id>`.
3. Add `-PrepareOnly` if you only want to inspect the staged bundle at `.tmp-railway-api-bundle`.

The fallback script uses [scripts/prepare-railway-api-bundle.ps1](/D:/Courses/常用/Codex/科研论文agent/scripts/prepare-railway-api-bundle.ps1) to stage a backend-only bundle and [scripts/deploy-railway-api.ps1](/D:/Courses/常用/Codex/科研论文agent/scripts/deploy-railway-api.ps1) to deploy it.

## GitHub Deploys

- Vercel frontend is connected to GitHub and auto-deploys from `main` using `apps/web` as the root directory.
- Railway backend is connected to GitHub, and [deploy-railway-api.yml](/D:/Courses/常用/Codex/科研论文agent/.github/workflows/deploy-railway-api.yml) triggers a service-scoped production deploy on every backend-relevant push to `main`.
- Add a repository secret named `RAILWAY_TOKEN` in GitHub Actions before relying on the backend workflow.
