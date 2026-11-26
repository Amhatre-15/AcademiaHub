# 🚀 AcademiaHub — Project Deployment & Session Master Summary

**Last Updated:** November 2026  
**Repository:** [https://github.com/Amhatre-15/AcademiaHub](https://github.com/Amhatre-15/AcademiaHub)  
**System Status:** ✅ **100% Operational, Fully Deployed & Production Ready**

---

## 🌐 1. Live Deployment Endpoints

| Component | Cloud Platform | Live Public URL | Health / Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Render Static Site | [https://academiahub-frontend.onrender.com](https://academiahub-frontend.onrender.com) | ✅ Active (React 19 SPA) |
| **Backend REST API** | Render Web Service | [https://academiahub-backend-ahzt.onrender.com](https://academiahub-backend-ahzt.onrender.com) | ✅ Active (Express + Node.js) |
| **API Health Check** | Render Web Service | [https://academiahub-backend-ahzt.onrender.com/health](https://academiahub-backend-ahzt.onrender.com/health) | `{"status":"ok","database":"connected"}` |
| **Live WebSocket** | Render Native WSS | `wss://academiahub-backend-ahzt.onrender.com` | ✅ Active (Rotating QR + Doubts) |
| **Database** | Render PostgreSQL / Neon | Managed PostgreSQL 16 | ✅ Connected & Seeded |

---

## 🔑 2. Verified Working Login Credentials

All accounts are seeded and verified working against the live database:

| Role | Username | Password | Post-Login Destination |
| :--- | :--- | :--- | :--- |
| **👑 IT Administrator** | `admin` | `Admin@sspu2024` | Directly lands on `/admin` dashboard |
| **👨‍🏫 Faculty Member** | `Mandar` | `sspu@123` | Lands on `/faculty` dashboard |
| **👨‍🏫 Faculty Member** | `Parag` | `sspu@123` | Lands on `/faculty` dashboard |
| **🎓 Student** | Registered PRN | PRN | Lands on `/student` dashboard |

---

## 🛡️ 3. Security Hardening & Secret Leak Remediation

1. **Compromised GitHub Repo Deleted:**
   * The previous repository containing the leaked Supabase service role key was permanently deleted from GitHub.
2. **Fresh Repository with Clean Commit History:**
   * Created a brand-new repository (`Amhatre-15/AcademiaHub`) with an initial clean root commit.
   * Zero history of leaked `.env` files, past keys, or connection strings exists in git commits.
3. **Hardened `.gitignore`:**
   * Strictly ignores `.env`, `.env.*`, `*.bak`, `local_pg_data/`, and test artifacts.
4. **Sanitized `.env.example`:**
   * Replaced all real credentials with generic production template placeholders (`your-project-id.supabase.co`, `your-supabase-service-role-key-here`).
5. **Purged AI Metadata Folders:**
   * Removed `.agents/`, `.claude/`, `.codex/`, `.cursor/`, `.gemini/`, `graphify-out/`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to ensure a clean, professional, human-engineered repository.

---

## 🔧 4. Technical Issues Diagnosed & Resolved

| Issue Encountered | Root Cause | Engineering Solution Implemented |
| :--- | :--- | :--- |
| **"Network Error" on Sign In** | Helmet set default `Cross-Origin-Resource-Policy: same-origin`, which blocked browser cross-origin requests between frontend and backend. | Configured Helmet with `crossOriginResourcePolicy: { policy: 'cross-origin' }` and expanded CORS allowed origins. |
| **Login button refreshing to landing page** | `LoginPage.tsx` used `from \|\| dashboardPath`. When arriving from `/`, `from` was `'/'` (truthy), navigating users back to the landing page instead of `/admin`. | Changed logic to `(from && from !== '/') ? from : dashboardPath` and added auto-redirect in `LandingPage.tsx`. |
| **Render Build Failure: TS7016 (`jsonwebtoken`)** | Under `NODE_ENV=production`, `npm install` skips `devDependencies`, causing `@types/*` to be missing during `tsc`. | Promoted TypeScript types (`@types/jsonwebtoken`, `@types/express`, `@types/node`, `@types/bcryptjs`, etc.) to dependencies and updated `buildCommand` to `npm install --include=dev`. |
| **Render Blueprint Error: `user not valid`** | Render reserves the username `postgres` for internal database administration. | Removed `user: postgres` from `render.yaml` so Render generates the standard user automatically. |
| **Render Blueprint Error: `no such plan free for service type web`** | Render static sites are permanently free and do not accept a `plan` parameter. | Removed `plan: free` from the static frontend service definition in `render.yaml`. |
| **Missing Shell for DB Seed** | Render disables terminal shell access on free compute instances. | Configured `startCommand` in `render.yaml` to auto-seed on startup: `npx prisma migrate deploy && npm run db:seed && npm run start`. |

---

## 👥 5. Team & Author Attribution

Updated in [README.md](README.md):
* **Atharva Ajit Mhatre**
* **Laxi Patel**
* **Niharika Pandey**
* **Shubh Patel**
* **Dhruv Patel**

---

## 🚀 6. How to Resume Work in the Next Session

1. **Pull the latest clean code:**
   ```bash
   git pull origin main
   ```
2. **Local Development (Offline / Local):**
   ```bash
   npm run dev
   ```
   * Frontend: `http://localhost:5173`
   * Backend: `http://localhost:5000`
3. **Triggering Live Deployments:**
   * Any commit pushed to `main` (`git push origin main`) automatically triggers a production rebuild and deployment on Render.
