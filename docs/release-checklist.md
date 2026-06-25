# Release Checklist

Use this checklist before pushing to GitHub or deploying to Vercel.

## Local Checks

- Run `npm.cmd run typecheck`.
- Run `npm.cmd run build`.
- Run `/api/evaluation` in Mock mode and confirm the full suite is 15/15.
- Run `/api/agent` Real smoke test when credentials are available.
- Visit the main pages:
  - `/`
  - `/chat`
  - `/knowledge`
  - `/tools`
  - `/evaluation`
  - `/about`

## Git Checks

- Run `git status`.
- Confirm `.env.local` is not tracked.
- Confirm `.env`, `.env.local`, `.env*.local`, `.next`, `node_modules`, and `tsconfig.tsbuildinfo` are ignored.
- Confirm the intended release tag exists.
- Search tracked files for sensitive strings before publishing:
  - `sk-`
  - full API keys
  - full private proxy addresses

## GitHub Push Steps

Run these only after final review:

```bash
git remote add origin <your-github-repo-url>
git push -u origin master
git push origin --tags
```

If the remote already exists, use:

```bash
git remote -v
git push origin master
git push origin --tags
```

## Vercel Deployment Steps

1. Import the GitHub repository into Vercel.
2. Keep the default Next.js build settings.
3. Configure environment variables in Vercel Project Settings:
   - `AI_API_KEY`
   - `AI_BASE_URL`
   - `AI_MODEL`
   - `AI_PROVIDER`
   - `AI_REQUEST_TIMEOUT_MS`
4. Deploy the project.
5. Verify `/`, `/chat`, `/knowledge`, `/tools`, `/evaluation`, and `/about`.
6. Verify Mock mode first.
7. Enable Real API mode only after server-side environment variables are configured.

## Deployment Safety Notes

- Do not commit `.env.local`.
- Do not paste API keys into README, docs, or frontend code.
- Store API keys only in Vercel Environment Variables.
- Production usually should not use local proxy variables such as `HTTP_PROXY` or `HTTPS_PROXY`.
- Frontend pages should only show masked diagnostics, never full secrets.
- Mock mode should remain usable even if Real API credentials are missing.
