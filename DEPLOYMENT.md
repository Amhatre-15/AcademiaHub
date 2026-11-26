# 🌐 AcademiaHub — Live Web Deployment Guide

This guide walks you through deploying **AcademiaHub** online so that anyone with a web browser can access and interact with the platform.

AcademiaHub is a full-stack platform consisting of:
1. **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (SPA)
2. **Backend:** Node.js + Express + TypeScript + WebSockets (`ws`)
3. **Database:** PostgreSQL (Prisma ORM)

---

## 🚀 Option 1: The Recommended Free Stack (Best Performance)

This setup uses **Neon / Supabase** (PostgreSQL Database), **Render / Railway** (Backend with WebSocket support), and **Vercel** (Global Frontend CDN).

```
┌─────────────────────────────────┐
│       Frontend (Vercel)         │  👉 https://academiahub.vercel.app
│   React 19 + Vite Static CDN    │
└────────────────┬────────────────┘
                 │ HTTPS / WSS
┌────────────────▼────────────────┐
│       Backend (Render)          │  👉 https://academiahub-api.onrender.com
│ Node.js + Express + WebSockets  │
└────────────────┬────────────────┘
                 │ TCP / SSL
┌────────────────▼────────────────┐
│   Database (Neon / Supabase)    │  👉 PostgreSQL 16
│        Managed Cloud DB         │
└─────────────────────────────────┘
```

---

### Step 1: Set Up Cloud PostgreSQL Database (2 Minutes)

Choose either **Neon** (instant setup) or **Supabase**:

#### Using Neon (Fastest):
1. Go to [https://neon.tech](https://neon.tech) and sign up for free.
2. Click **Create Project** -> Name it `academiahub` -> Select region closest to you.
3. Copy the **Connection String** (e.g., `postgresql://user:password@ep-xyz.region.neon.tech/neondb?sslmode=require`).
4. Keep this connection string handy as your `DATABASE_URL` and `DIRECT_URL`.

---

### Step 2: Deploy Backend to Render (3 Minutes)

Render natively supports Node.js HTTP and long-lived **WebSockets** for real-time QR attendance and classroom doubts.

1. Go to [https://render.com](https://render.com) and log in with GitHub.
2. Click **New +** -> **Web Service**.
3. Select your GitHub repository: `https://github.com/Amhatre-15/AcademiaHub`.
4. Configure the service settings:
   - **Name:** `academiahub-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm run start`
   - **Instance Type:** `Free`
5. In **Environment Variables**, add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `5000` | Backend port |
   | `DATABASE_URL` | *Your Neon/Supabase PostgreSQL connection string* | Primary DB pool |
   | `DIRECT_URL` | *Your Neon/Supabase PostgreSQL connection string* | Direct connection |
   | `JWT_SECRET` | *Any random 64-char string* | e.g. `95iiI8jWnnQWA6AaUwDBZVOyIvAmEfk7gS00FYHuWc/SyjwKAUb0WB5OTaT4cq0cDGxOp8pgpOLV2ybOcfdHcA==` |
   | `FRONTEND_URL` | `https://your-frontend-domain.vercel.app` *(update after Step 3)* | CORS allowed origin |
   | `SUPABASE_URL` | `https://placeholder.supabase.co` | Required placeholder |
   | `SUPABASE_SERVICE_ROLE_KEY` | `placeholder-service-role-key` | Required placeholder |
6. Click **Deploy Web Service**.
7. Once deployed, copy your backend URL (e.g. `https://academiahub-backend.onrender.com`).

*(Optional Seed Demo Data):*
Open the **Shell** tab on Render and run:
```bash
npm run db:seed
```

---

### Step 3: Deploy Frontend to Vercel (2 Minutes)

1. Go to [https://vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import `Amhatre-15/AcademiaHub`.
4. Configure the project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `frontend`.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. In **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://academiahub-backend.onrender.com/api` *(use your Render URL from Step 2)* |
   | `VITE_WS_URL` | `wss://academiahub-backend.onrender.com` *(use your Render URL with wss://)* |
   | `VITE_APP_NAME` | `AcademiaHub` |
6. Click **Deploy**.
7. In ~60 seconds, your site will be live at `https://academiahub-xyz.vercel.app`!
8. Copy your live Vercel URL, go back to Render, and set `FRONTEND_URL` to match your Vercel URL.

---

## ⚡ Option 2: 1-Click All-in-One Deployment via Render Blueprint

If you want frontend, backend, and database all hosted on a single dashboard:

1. Push your latest code including `render.yaml` to GitHub:
   ```bash
   git add .
   git commit -m "feat: add production deployment configs"
   git push origin main
   ```
2. Log in to [Render](https://render.com).
3. Click **New +** -> **Blueprint**.
4. Select `Amhatre-15/AcademiaHub`.
5. Render reads `render.yaml` and will automatically provision:
   - A managed PostgreSQL database
   - The Node.js Backend Web Service
   - The Vite Frontend Static Site
6. Click **Apply**.

---

## 🔑 Demo Login Accounts for Live Visitors

Once the database is seeded (`npm run db:seed`), visitors can test all institutional roles:

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **IT Administrator** | `admin` | `Admin@sspu2024` | Full access to branch, student, faculty, and timetable management |
| **Faculty Member** | `Mandar` / `Parag` / `Pragati` | `sspu@123` | Can start active lecture sessions and launch dynamic rotating QR code |
| **Student** | Registered PRN | PRN | Can view student dashboard, scan dynamic QR, and view attendance stats |
