# 🎓 AcademiaHub — Enterprise Institutional Management & Interactive Lecture Hall Platform

[![CI Pipeline](https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square&logo=githubactions)](https://github.com/Amhatre-15/AcademiaHub)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-38B2AC?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-239%20Passing-success?style=flat-square&logo=vitest)](https://github.com/Amhatre-15/AcademiaHub)

> **AcademiaHub** is an all-in-one institutional ERP and real-time interactive lecture hall platform engineered to eliminate attendance proxying, streamline fragmented academic workflows, bridge faculty-student communication gaps, and provide data-driven insights across educational institutions.

---

## 📑 Table of Contents

- [Key Subsystems & Highlights](#-key-subsystems--highlights)
- [System Architecture](#-system-architecture)
- [Comprehensive Tech Stack](#-comprehensive-tech-stack)
- [User Roles & Portals](#-user-roles--portals)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Local Development Setup](#-local-development-setup)
- [Seed Login Credentials](#-seed-login-credentials)
- [Cloud Deployment (Vercel + Render + Neon)](#-cloud-deployment)
- [Repository Directory Structure](#-repository-directory-structure)
- [Security Architecture](#-security-architecture)
- [License & Authors](#-license--authors)

---

## ⚡ Key Subsystems & Highlights

### 1. 🛡️ 1-Second Cryptographic Rotating Dynamic QR Attendance
* **Zero-Proxy Guarantee:** Mitigates screenshot sharing and proxy check-ins by generating an **HMAC-SHA256 rotating QR stream** that refreshes every **1,000ms**.
* **Dual-Checkpoint Verification:** Evaluates student presence at both class start and end; automatically computes final status (`PRESENT`, `LATE`, `PARTIAL`, `ABSENT`) based on configurable institutional rules.
* **Faculty Projector Mode:** High-contrast, full-screen display with animated millisecond countdown rings for lecture hall screens.
* **Student In-App Scanner:** Native camera viewfinder powered by `html5-qrcode` with laser scanning animations and Web Audio API audio confirmation chimes.

### 2. 💬 Interactive Classroom 2.0 & Real-Time Doubt Queue
* **Live In-Session Doubt Queue:** Students can submit lecture queries in real time without interrupting the professor.
* **Peer Upvoting ("+1 / Me Too"):** Identifies widespread student confusion; sorts queries dynamically on the faculty cockpit.
* **Anonymous Mode:** Encourages participation by allowing shy students to ask questions anonymously.
* **Collaborative Vector Whiteboard:** Real-time vector-drawn whiteboard with 1-tap "Save Canvas to Student Notebook" for immediate revision.

### 3. 📂 Google Classroom & Resource Hub
* **OAuth2 Cloud Sync:** Links official institutional courses directly with Google Classroom via Google OAuth2.
* **In-App Document Hub:** Students and faculty view and access syllabus slides, Google Drive attachments, YouTube lecture links, and coursework without leaving AcademiaHub.

### 4. 🎮 Gamified Student Experience & Progressive Dashboard
* **Instant 0ms Paint:** Priority-based progressive rendering renders user profile and daily schedule instantly, loading attendance metrics asynchronously.
* **Scholar Ranking & XP:** Dynamic reward system awarding XP for prompt attendance, quiz completion, and peer assistance.
* **Streak Tracking:** Visual flame streak counters and statutory attendance health gauges with warning thresholds ($<75\%$).

### 5. 🏛️ Multi-Stakeholder Portals & Smart Gradebook
* **Parent / Guardian Portal:** Real-time attendance monitoring, timetable insights, and automatic warning alerts when attendance dips below statutory thresholds.
* **Exam Controller & Seating Scatter:** Algorithmic examination seating generator that scatters students across halls to prevent adjacent identical course seats.
* **10-20-30-40 Rubric Gradebook:** Configurable GPA/CGPA grading model (10% Attendance, 20% Quizzes, 30% Assignments, 40% Exams) with cryptographic transcript hash verification.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT PRESENTATION TIER                        │
│                                                                        │
│   React 19 SPA (Vite)  •  Tailwind CSS 4  •  Zustand  •  TanStack Query │
│   ┌─────────────────┬─────────────────┬──────────────┬─────────────┐   │
│   │ Student Portal  │ Faculty Cockpit │ Admin Portal │ Parent View │   │
│   └─────────────────┴─────────────────┴──────────────┴─────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (REST) / WSS (WebSockets)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       APPLICATION & SECURITY TIER                      │
│                                                                        │
│   Node.js (>=18)  •  Express.js 4  •  TypeScript 5.9                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Helmet Security Headers • IP Sliding-Window Rate Limiter      │   │
│   │ Stateless JWT Validation • Role-Based Access Control (RBAC)   │   │
│   └────────────────────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────┬─────────────────────────────────┐   │
│   │ REST API Controller Tier     │ Real-Time WebSocket Engine      │   │
│   │ (/api/admin, /api/faculty,   │ (Native RFC 6455 ws server,     │   │
│   │  /api/student, /api/auth)    │  SessionManager room pub/sub)   │   │
│   └──────────────────────────────┴─────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Prisma ORM (Type-Safe Query Layer)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         DATA PERSISTENCE TIER                          │
│                                                                        │
│   PostgreSQL 16 (ACID-Compliant Relational Database)                   │
│   • 30+ 3NF Normalized Models (Users, Sessions, Timetables, Quizzes)   │
│   • Redis / In-Memory Ephemeral Cache (Leaderboards & Dynamic Tokens)  │
│   • Composite Unique Indexes & Foreign Key Cascades                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Comprehensive Tech Stack

| Domain | Technology | Version | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `19.2.8` | UI rendering engine with concurrent actions and transitions |
| **Frontend Language** | TypeScript | `~6.0.2` | Static type safety across state stores, views, and API hooks |
| **Bundler & Server** | Vite | `8.3.0` | Ultra-fast development server & Rollup production bundler |
| **Styling** | Tailwind CSS | `4.3.3` | Utility-first styling with responsive and dark mode support |
| **Client State** | Zustand | `5.0.15` | Local persistent authentication state (`academiahub-auth`) |
| **Server State** | TanStack Query | `5.102.8`| Server data caching with request deduplication |
| **Client Routing** | React Router DOM | `7.18.3` | Code-split lazy chunking (`StudentLayout`, `FacultyLayout`, etc.) |
| **QR Code Engine** | html5-qrcode / qrcode | `2.3.8` / `1.5.4` | Viewfinder camera video stream reader and canvas renderer |
| **Backend Runtime** | Node.js | `>=18.0.0` | Asynchronous V8 JavaScript backend runtime |
| **Backend Framework** | Express.js | `4.21.1` | REST route routing, middleware pipelines, and error handling |
| **Backend Language** | TypeScript | `5.9.3` | Server-side static typing compiled to CommonJS modules |
| **Database ORM** | Prisma Client | `5.22.0` | Relational query builder, schema migration, and model typings |
| **Database Engine** | PostgreSQL | `16.x` | ACID relational database (Hosted on Supabase/Neon or Docker) |
| **Real-Time Sockets** | ws | `8.18.0` | Native RFC 6455 bidirectional WebSocket communication |
| **Authentication** | jsonwebtoken | `9.0.2` | Cryptographic Bearer token signing and verification (7-day expiry) |
| **Password Security** | bcryptjs | `2.4.3` | Adaptive salted one-way hashing (12 work factor rounds) |
| **Security Headers** | Helmet | `8.0.0` | Strict Content Security Policy, Frameguard, and XSS headers |
| **Rate Limiter** | express-rate-limit | `7.4.1` | Sliding-window IP rate limiting (500 req/15m; 20 attempts/15m login) |
| **AI Integration** | @google/generative-ai | `0.24.1` | Google Gemini AI (`gemini-2.5-flash`) for automated quiz questions |
| **Google Cloud** | googleapis | `185.0.0` | Google Classroom & Drive OAuth2 integration |
| **Backend Testing** | Jest + ts-jest | `29.7.0` | 154 backend unit and integration tests across 17 suites |
| **Frontend Testing** | Vitest + RTL | `5.0.5` | 85 frontend unit and component tests across 9 suites |
| **End-to-End Testing** | Playwright | `1.64.1` | Full-stack Chromium user journeys across roles |
| **Load Testing** | k6 | `0.49.0` | High-concurrency load testing (1,200 concurrent VUs) |

---

## 👥 User Roles & Portals

AcademiaHub features granular Role-Based Access Control (RBAC) across distinct stakeholder personas:

* **👑 IT Administrator (`IT_ADMIN`):** Complete institutional setup — manages branches, academic years, semesters, lecture halls, faculty assignments, and master timetables with conflict detection.
* **👨‍🏫 Faculty Member (`FACULTY`):** Daily teaching cockpit — launches live lecture sessions, projects the 1-second rotating dynamic QR, operates the live doubt queue, creates and reviews quizzes, and tracks student attendance histories.
* **🎓 Student (`STUDENT`):** Personal academic hub — scans attendance QR codes via camera, tracks streaks and scholar level, views synced Google Classroom lecture slides, takes live quizzes, and upvotes questions in the doubt queue.
* **👨‍👩‍👦 Parent / Guardian (`PARENT`):** Transparency portal — monitors real-time attendance percentages, class schedules, and automated warnings for low attendance.
* **🏛️ Exam Officer & Dean (`EXAM_OFFICER`, `DEAN`):** Institutional oversight — generates scattered exam seating charts, hall tickets, gradebooks, and performance analytics.

---

## 🧪 Testing & Quality Assurance

AcademiaHub maintains an extensive test suite with **239 automated tests** passing at 100%:

```bash
# Run backend Jest test suites (154 tests)
npm test --prefix backend

# Run frontend Vitest test suites (85 tests)
npm test --prefix frontend

# Run complete Playwright end-to-end browser tests
npm run test:e2e

# Run k6 attendance rush concurrency simulation
npm run test:load:attendance
```

### Coverage Highlights:
* **Attendance State Machine:** START $\rightarrow$ ACTIVE $\rightarrow$ END $\rightarrow$ CLOSED state lifecycle and margin evaluation.
* **Rotating HMAC Tolerance:** Verifies fresh 1,000ms tokens are accepted while stale screenshots are rejected.
* **Timetable Conflict Detection:** Validates overlapping slot collision avoidance for rooms and instructors.
* **Role-Based Access Control (RBAC):** Validates route guards against cross-role privilege escalation.
* **IDOR & Security Boundaries:** Ensures students cannot view or mutate other students' confidential academic records.

---

## 💻 Local Development Setup

### 1. Prerequisites
* **Node.js:** `>= 18.0.0`
* **npm:** `>= 9.0.0`
* **Docker** *(Optional, for offline local PostgreSQL)*

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/Amhatre-15/AcademiaHub.git
cd AcademiaHub

# Install dependencies across root, backend, and frontend
npm run install:all
```

### 3. Environment Configuration
Copy the sample environment template in `backend`:
```bash
cd backend
cp .env.example .env
```
Update `.env` with your PostgreSQL database connection string (from Neon, Supabase, or local Docker).

### 4. Database Setup & Seeding
```bash
# Generate the Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Seed initial institutional data, admin, faculty, and student accounts
npm run db:seed
```

### 5. Start Development Servers
From the root directory:
```bash
npm run dev
```
* **Frontend Application:** `http://localhost:5173`
* **Backend API Server:** `http://localhost:5000`
* **WebSocket Server:** `ws://localhost:5000`

---

## 🔑 Seed Login Credentials

Once seeded (`npm run db:seed`), the following test accounts are ready for testing:

| Role | Username | Default Password | Initial Action Required |
| :--- | :--- | :--- | :--- |
| **IT Administrator** | `admin` | `Admin@sspu2024` | Direct login to Admin Dashboard |
| **Faculty Member** | `Mandar` / `Parag` / `Pragati` | `sspu@123` | Prompted to change password on 1st login |
| **Student** | Student PRN | PRN | Prompted to change password on 1st login |

---

## 🚀 Cloud Deployment

AcademiaHub is pre-configured for deployment on modern cloud platforms:

### Quick Deploy (Vercel + Render + Neon)
1. **Database:** Create a free PostgreSQL instance on [Neon.tech](https://neon.tech).
2. **Backend:** Deploy `backend/` to [Render.com](https://render.com) as a Web Service. Add environment variables (`DATABASE_URL`, `JWT_SECRET`, etc.).
3. **Frontend:** Deploy `frontend/` to [Vercel.com](https://vercel.com). Add environment variables (`VITE_API_URL`, `VITE_WS_URL`).

Refer to the complete, step-by-step [DEPLOYMENT.md](DEPLOYMENT.md) guide for details.

---

## 📂 Repository Directory Structure

```
AcademiaHub/
├── backend/                  # Node.js + Express + TypeScript Backend
│   ├── prisma/               # Prisma schema & migration files
│   │   ├── schema.prisma     # 30+ normalized relational data models
│   │   └── seed.ts           # Demo seed script for testing
│   ├── src/
│   │   ├── config/           # Environment and client configurations
│   │   ├── controllers/      # Route controllers (Admin, Faculty, Student, Auth)
│   │   ├── middleware/       # JWT auth, RBAC guard, error handler, rate limiter
│   │   ├── routes/           # REST endpoint definitions
│   │   ├── services/         # Business logic (Attendance, QR, Google Classroom)
│   │   ├── websocket/        # SessionManager & RFC 6455 WebSocket engine
│   │   └── index.ts          # Server entrypoint
│   └── package.json
│
├── frontend/                 # React 19 + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── components/       # Reusable UI widgets (QR Scanner, Navbar, Modals)
│   │   ├── layouts/          # Role layouts (AdminLayout, FacultyLayout, StudentLayout)
│   │   ├── pages/            # Role-specific application views
│   │   ├── services/         # Axios API clients & WebSocket hooks
│   │   ├── stores/           # Zustand state stores (authStore)
│   │   └── App.tsx           # Client router and route guards
│   └── package.json
│
├── e2e/                      # Playwright End-to-End browser test suite
├── load-tests/               # k6 high-concurrency load testing scripts
├── .github/workflows/        # Automated GitHub Actions CI test pipelines
├── DEPLOYMENT.md             # Production cloud deployment manual
├── render.yaml               # 1-Click Render cloud blueprint
└── package.json              # Monorepo task orchestration
```

---

## 🔒 Security Architecture

* **Zero Plaintext Credentials:** All passwords hashed using `bcryptjs` with 12 adaptive work rounds.
* **HMAC Attendance Verification:** Rotating QR codes signed with server-side secrets, rendering intercepted QR screenshots obsolete within 1 second.
* **Role-Based Authorization:** Strict middleware hierarchy verifies that authenticated claims match required endpoint permissions.
* **Denial of Service Prevention:** Dual sliding-window rate limiters block automated password brute-forcing and API denial of service.
* **Strict Git Hygiene:** Production `.gitignore` policy prevents private `.env` files and credentials from ever being staged or tracked.

---

## 📄 License & Authors

Developed and engineered by:
* **Atharva Ajit Mhatre**
* **Laxi Patel**
* **Niharika Pandey**
* **Shubh Patel**
* **Dhruv Patel**

Licensed under the MIT License.
