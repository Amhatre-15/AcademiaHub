# AcademiaHub — Master Future Roadmap & Multi-Phase Evolution Plan
**File:** `future_plan.md`  
**Current Codebase State:** Phases 1–15 Core Implemented (~96% Complete, TypeScript Verified)  
**Target Architecture:** Enterprise-Grade Cloud Platform, High-Throughput Real-Time Engine, Scalable Micro-Services & Native Mobile Ecosystem  
**Target Audience:** Engineering Leads, Full-Stack Developers, DevOps Engineers, and Product Stakeholders  

---

## Table of Contents
1. [Executive Vision & System Evolution Blueprint](#1-executive-vision--system-evolution-blueprint)
2. [Phase 16: Immediate Integration, Cloud Activation & Operational Stabilization](#2-phase-16-immediate-integration-cloud-activation--operational-stabilization)
3. [Phase 17: Comprehensive Testing Suite & Quality Assurance Framework](#3-phase-17-comprehensive-testing-suite--quality-assurance-framework)
4. [Phase 18: Core Feature Expansions & Advanced Academic Modules](#4-phase-18-core-feature-expansions--advanced-academic-modules)
5. [Phase 19: Next-Generation Interactive Classroom & Gemini Multimodal AI](#5-phase-19-next-generation-interactive-classroom--gemini-multimodal-ai)
6. [Phase 20: System-Wide Optimization, Caching & High-Scale Performance](#6-phase-20-system-wide-optimization-caching--high-scale-performance)
7. [Phase 21: Native Mobile Application Ecosystem (iOS & Android)](#7-phase-21-native-mobile-application-ecosystem-ios--android)
8. [Phase 22: Production Infrastructure, Multi-Tenancy & Enterprise DevOps](#8-phase-22-production-infrastructure-multi-tenancy--enterprise-devops)
9. [Phase 23: Chronological Implementation Milestones, Sprints & KPIs](#9-phase-23-chronological-implementation-milestones-sprints--kpis)
10. [Risk Assessment, Fallback Protocols & Compliance](#10-risk-assessment-fallback-protocols--compliance)

---

## 1. Executive Vision & System Evolution Blueprint

### 1.1. Context & Baseline
AcademiaHub has established a rock-solid foundation:
- **Core Architecture:** TypeScript end-to-end (Node.js/Express on backend, React 19/Vite on frontend).
- **Data Model:** 30+ relational entities in `backend/prisma/schema.prisma` mapping academic hierarchies, dynamic rotating QR attendance, quiz banks, live sessions, notebooks, gamification XP, and Google Classroom sync.
- **Priority Sprint Enhancements:**
  - **Priority 1 Implemented:** Priority-based progressive loading architecture (0ms paint for hero/radar/quick dock) and visually redesigned Student Dashboard featuring 3D-styled icons, real attendance gauge, and live class radar.
  - **Priority 2 Implemented:** Cryptographic 1-second rotating HMAC-SHA256 dynamic QR code attendance system verified with faculty projector mode and student camera viewfinder.
  - **Priority 3 Implemented:** In-app Google Classroom integration with OAuth2, course linking, and direct viewing of slides, Drive attachments, and assignments inside AcademiaHub.
  - **Detailed Tracker:** See [PROJECT_STATUS.md](file:///d:/AcademicHub/PROJECT_STATUS.md) for full sprint deliverables and remaining tasks.
- **Verification:** 100% clean builds with zero TypeScript compiler errors (`tsc` backend & `vite build` frontend).

### 1.2. Strategic Objectives for the Future Phases
The subsequent development phases transition AcademiaHub from an **institutional web prototype** into a **mission-critical university operating system**:
1. **Zero-Downtime Infrastructure:** Eliminate cloud provider pause vulnerabilities through hybrid local-container failover.
2. **Defensive Software Engineering:** Attain >85% automated test coverage across unit, integration, and load dimensions.
3. **Campus-Wide Feature Breadth:** Expand beyond classroom sessions into examinations, gradebooks, parent portals, and resource booking.
4. **Sub-Second Performance at Scale:** Guarantee <100ms API response times and instant WebSocket synchronization for concurrent halls of 1,000+ students.
5. **Pocket-First Mobility:** Deliver dedicated iOS and Android native apps equipped with instant biometric login, hardware-accelerated QR scanning, and push notifications.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ACADEMIAHUB ECOSYSTEM                           │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Web Client (React 19)       │    Native Mobile (iOS & Android)    │
│  - Faculty Cockpit & Projector   │  - Zero-Latency Dynamic QR Scanner  │
│  - Admin Hierarchy & Timetable   │  - Offline Student Notebook Cache   │
│  - Student Dashboard & Notes     │  - APNs / FCM Push Notification Hub │
├──────────────────────────────────┴─────────────────────────────────────┤
│                    API GATEWAY & REVERSE PROXY                         │
│             Rate Limiting • SSL Termination • Compression              │
├──────────────────────────────────┬─────────────────────────────────────┤
│       Express API Backend        │      Real-Time WebSocket Engine     │
│  - RBAC Middleware & IDOR Guard  │  - Session Lifecycle Broadcasts     │
│  - Gemini Multimodal AI Service  │  - Rotating Dynamic HMAC QR Stream  │
│  - Google Classroom OAuth2 Sync  │  - Live Anti-Cheat Quiz Sync        │
├──────────────────────────────────┴─────────────────────────────────────┤
│                ASYNCHRONOUS WORKERS & CACHE (Redis)                    │
│   BullMQ Queues • Session State Cache • Leaderboard • Timetable Cache  │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Primary PostgreSQL DB       │         Object Storage (S3/CDN)     │
│  Prisma ORM • Connection Pool    │  Course Materials • PDF Annotations │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Phase 16: Immediate Integration, Cloud Activation & Operational Stabilization

### 2.1. Cloud Database Resumption & Hybrid Fallback Engine
- **Supabase Cloud Unpause:**
  - Restore active status for production Supabase / PostgreSQL instance.
  - Validate connection strings: `DATABASE_URL` (pooled port 6543 / PgBouncer) and `DIRECT_URL` (direct port 5432 for migrations).
  - Execute `npx prisma db push` and verify synchronization with all 30+ tables.
  - Execute `npm run db:seed` to populate test branches, academic years, faculty accounts, and enrolled students.
- **Local Database Fallback (`docker-compose.local-db.yml`):**
  - Implement a secondary development environment using local PostgreSQL 16 Alpine in Docker:
    ```yaml
    version: '3.8'
    services:
      postgres:
        image: postgres:16-alpine
        container_name: academiahub-local-postgres
        environment:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: local_dev_password
          POSTGRES_DB: academiahub
        ports:
          - "5433:5432"
        volumes:
          - pgdata:/var/lib/postgresql/data
    volumes:
      pgdata:
    ```
  - Provide an `.env.local` toggle allowing developers to instantly pivot between cloud Supabase and local Docker PostgreSQL without external network dependencies.

### 2.2. Supabase Storage Pipeline Stabilization
- **Storage Bucket Configuration:**
  - Verify and provision the `course-materials` bucket in Supabase.
  - Implement strict Storage Row-Level Security (RLS) policies:
    - **Upload:** Restricted to authenticated users with role `FACULTY` or `IT_ADMIN`.
    - **Read:** Permitted only if the requesting student is actively enrolled in the subject's class division.
- **Signed URL & Streaming Proxy:**
  - Ensure `MaterialController.ts` serves presigned download URLs with 15-minute expiration to prevent hotlinking and unauthorized material redistribution.
  - Implement streaming response headers for large course PDFs to facilitate in-browser page-by-page rendering.

### 2.3. Automated Background Cron & State Maintenance
- **Session Auto-Closer Worker:**
  - **Problem:** If a faculty member leaves a lecture session in `ACTIVE` state without clicking "End Session", students remain in limbo and final attendance is not computed.
  - **Implementation:** Introduce a lightweight Node.js cron scheduler (`node-cron` or `bree`) in `backend/src/jobs/sessionWatchdog.ts`.
  - **Rule:** Inspect all sessions in `ACTIVE` status whose timetable slot ended >30 minutes ago. Automatically invoke `calculateFinalAttendance(sessionId)`, transition status to `CLOSED`, and broadcast `SESSION_ENDED` over WebSockets.
- **Streak & Engagement Evaluator:**
  - Execute a daily midnight job computing student consecutive attendance streaks, granting badge rewards, and updating the global XP leaderboard.

### 2.4. Google Classroom & Gemini AI Credentials Verification
- **Google Classroom End-to-End Handshake:**
  - Configure production OAuth credentials in Google Cloud Console (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
  - Set authorized redirect URI to `http://localhost:5000/api/shared/google/callback` (and production domain equivalent).
  - Verify two-way synchronization: pulling assignments and course documents from Google Classroom directly into the AcademiaHub database.
- **Gemini AI Service Hardening:**
  - Validate `GEMINI_API_KEY` handling with fallback to `gemini-1.5-flash` or `gemini-1.5-pro`.
  - Implement exponential backoff for quota exhaustion (HTTP 429) and structured JSON parsing validation for generated quiz questions.

---

## 3. Phase 17: Comprehensive Testing Suite & Quality Assurance Framework

### 3.1. Automated Backend Unit & Integration Tests (Jest / Supertest)
Create a comprehensive test suite in `backend/src/__tests__/`:

```
backend/src/__tests__/
├── auth/
│   ├── login.test.ts             # Password verification, JWT generation, invalid credentials
│   ├── firstLogin.test.ts        # Mandatory password change enforcement
│   └── rbac.test.ts              # Route protection (Student blocked from /admin & /faculty)
├── attendance/
│   ├── stateMachine.test.ts      # PRESENT, PARTIAL, LATE, ABSENT edge conditions
│   ├── dynamicQr.test.ts         # HMAC-SHA256 signature validation & timestamp skew
│   └── override.test.ts          # Manual faculty override with required audit logging
├── academic/
│   ├── timetableConflict.test.ts # Room, class, and faculty timeslot overlap checks
│   └── enrollment.test.ts        # Bulk student import and username collision resolution
└── quiz/
    ├── gating.test.ts            # Verification that only START-attended students can enter
    └── antiCheat.test.ts         # Window blur, tab switch logging, score submission
```

#### Key Test Scenarios:
1. **Attendance State Machine Matrix:**
   - Both checkpoints valid (`START` + `END`) within window $\rightarrow$ `PRESENT`.
   - `START` valid, `END` missing $\rightarrow$ `PARTIAL`.
   - `START` missing, `END` valid $\rightarrow$ `LATE`.
   - Neither checkpoint valid $\rightarrow$ `ABSENT`.
2. **Dynamic QR HMAC Defense:**
   - Verify that a token older than 10 seconds is rejected (`EXPIRED`).
   - Verify that altering a single character in the QR hash payload returns `INVALID`.
   - Verify that replay attacks with an already-marked student ID return `DUPLICATE`.
3. **IDOR & Boundary Checks:**
   - Ensure Student A cannot access Student B's personal notes (`/api/student/notes/:id`).
   - Ensure Faculty X cannot modify grades for a class assigned to Faculty Y.

### 3.2. Automated Frontend Component & Hook Tests (Vitest & React Testing Library)
Configure Vitest in `frontend/` to test critical UI components:
- `DynamicQrScanner.test.tsx`: Test camera initialization, permission refusal error handling, and scanning callback invocation.
- `DynamicQrDisplay.test.tsx`: Verify the SVG QR code refreshes every $N$ seconds with new cryptographic tokens.
- `StudentNotebookPage.test.tsx`: Verify debounced autosave triggers API call after 1,000ms of typing inactivity.
- `Pagination.test.tsx`: Verify boundary page numbers, disabled previous/next controls, and page change events.

### 3.3. End-to-End (E2E) Browser Automation (Playwright)
Deploy Playwright suites simulating full multi-user browser journeys:
- **Test Journey 1 (The Complete Classroom Cycle):**
  1. Headless Browser 1 (Faculty): Logs in, opens `/faculty/live`, launches lecture session.
  2. Faculty displays rotating dynamic QR code on screen.
  3. Headless Browser 2 (Student): Logs in, navigates to `/student/live`, submits token captured from QR.
  4. Real-time WebSocket reflects student on faculty live roster.
  5. Faculty triggers Quiz 1.
  6. Student receives live quiz modal, answers 3 questions, submits.
  7. Faculty ends session. Both verify final attendance status (`PRESENT`) and XP awarded (+50).
- **Test Journey 2 (Anti-Cheat In-Quiz Enforcement):**
  1. Student starts active timed quiz.
  2. Script simulates page blur (`window.dispatchEvent(new Event('blur'))`).
  3. Verify warning banner appears in UI and violation count increments in database.

### 3.4. High-Concurrency WebSocket & API Load Testing (k6)
- **Classroom Rush Simulation:**
  - Script a k6 scenario where **1,200 virtual users (students)** authenticate and hit the attendance checkpoint endpoint within a **45-second window** (simulating 9:00 AM class start across campus).
  - Measure:
    - p95 and p99 response times (target: $<120\text{ms}$).
    - Error rate (target: $0.00\%$).
    - WebSocket broadcast delivery latency under concurrent message load.

---

## 4. Phase 18: Core Feature Expansions & Advanced Academic Modules

### 4.1. Extended Institutional Roles & Multi-Stakeholder Access
Extend `enum Role` in `schema.prisma`:
```prisma
enum Role {
  IT_ADMIN
  FACULTY
  STUDENT
  PARENT          // NEW: Guardian access
  EXAM_OFFICER    // NEW: Examination cell
  DEAN            // NEW: Academic oversight
}
```

#### 1. Parent / Guardian Portal:
- **Direct Child Linkage:** Relational mapping linking parents to one or more registered students.
- **Attendance Monitor:** Real-time visibility into daily lecture attendance with automated SMS/Email/WhatsApp alerts when attendance drops below statutory threshold (e.g., $<75\%$).
- **Academic Progress & Fees:** View published assignment grades, term results, and fee payment histories.

#### 2. Examination Controller & Hall Ticket Engine:
- **Centralized Exam Scheduling:** Midterm and final exam timetable scheduling with hall capacity allocation.
- **Automated Seating Arrangement:** Algorithm that scatters students across different branches to prevent neighboring students from having identical question papers.
- **Digital Hall Ticket Generator:** Downloadable PDF hall ticket with student photograph, barcode, authorized subjects, and room numbers.

#### 3. Dean & HOD Management Cockpit:
- Branch-wide syllabus tracking (percentage of lectures completed vs scheduled).
- Faculty teaching load distribution and student feedback analytics.

### 4.2. Smart Gradebook & Weighted GPA/CGPA Engine
- **Configurable Evaluation Rubrics:**
  - Flexible percentage weighting per subject:
    - *Attendance & Participation:* 10%
    - *Quizzes & Mini-Tests:* 20%
    - *Lab Work & Assignments:* 30%
    - *Final Examination:* 40%
- **Automated GPA/CGPA Calculation:**
  - Dynamic grading scales (e.g., 10-point scale: O, A+, A, B+, B, C, F).
  - Transcript generation exportable as cryptographically verifiable PDF with embedded hash and verification link.

### 4.3. Advanced Assignment Plagiarism & In-Browser PDF Annotation
- **Document Annotation Engine:**
  - In-app canvas overlay allowing faculty to highlight, draw, annotate, and leave inline audio/text comments directly on student PDF submissions without downloading third-party tools.
- **Plagiarism & Similarity Checking:**
  - Cross-submission text comparison using n-gram tokenization and cosine similarity to flag copied code or plagiarized assignment essays between peers.

### 4.4. Physical Campus Asset & Facility Booking Engine
- **Resource Reservation:**
  - Booking management for Computer Labs, Robotics Labs, Seminar Halls, Projectors, and Auditorium slots.
- **Conflict Avoidance Matrix:** Same slot-overlap detection logic used in `timetable.ts` applied to physical rooms and equipment.

---

## 5. Phase 19: Next-Generation Interactive Classroom & Gemini Multimodal AI

### 5.1. Real-Time Collaborative Whiteboard
- **Faculty Canvas Stream:**
  - Integration of an infinite canvas engine (`tldraw` or `excalidraw`).
  - Faculty writes equations, diagrams, and notes on tablet/stylus; vectors stream live to all connected student screens via the existing WebSocket infrastructure.
- **Snapshot to Notebook:**
  - Students can click a 1-tap "Save Canvas to Notebook" button, immediately capturing the current board state and embedding the image directly into their private `StudentNotebookPage`.

### 5.2. Live Classroom In-Session Doubt Queue
- **Silent Student Doubts:**
  - Students submit questions during lecture without interrupting faculty flow.
  - Optional "Ask Anonymously" toggle to encourage introverted students.
- **Peer Upvoting:**
  - Other students in the session can click "+1 / Me Too".
  - Questions automatically sort by vote count on the faculty live cockpit, highlighting common sticking points in real time.

### 5.3. Multimodal Gemini AI Classroom Intelligence
Extend `AiService.ts` with next-generation generative capabilities:

```
┌────────────────────────────────────────────────────────┐
│             GEMINI MULTIMODAL CAPABILITIES             │
├────────────────────────────────────────────────────────┤
│  1. Slide-to-Quiz Generator (PDF/PPTX -> MCQs)         │
│  2. Post-Lecture Summary & Flashcard Builder           │
│  3. Context-Grounded Student AI Tutor                  │
│  4. Automated Code Grading & Style Critique            │
└────────────────────────────────────────────────────────┘
```

1. **Slide-to-Quiz Batch Generator:**
   - Faculty uploads lecture presentation (PDF/PPTX).
   - Gemini parses text and diagrammatic slides, generating a 10-question multiple-choice quiz covering key concepts, with difficulty distribution (Easy, Medium, Hard).
2. **Post-Lecture Automated Study Guides:**
   - Once a session transitions to `CLOSED`, Gemini analyzes the lecture's materials, whiteboard notes, and quiz topics to automatically generate a 1-page executive summary and 5 revision flashcards for enrolled students.
3. **Context-Grounded Student AI Learning Companion:**
   - Chat assistant grounded **strictly** in the faculty's uploaded syllabus and reference notes (RAG - Retrieval-Augmented Generation).
   - Strict Anti-Cheat Lockdown: Automatically disabled and grayed out whenever the student enters any active quiz or exam environment.

---

## 6. Phase 20: System-Wide Optimization, Caching & High-Scale Performance

### 6.1. High-Performance Caching Layer (Redis)
Introduce Redis (`ioredis`) to offload the primary database from ephemeral high-frequency operations:

```
[ Client Request ] ──> [ Express Backend ]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
        [ Redis Cache ]            [ PostgreSQL (Prisma) ]
        • Active Session Rooms     • Persistent Relational Records
        • Dynamic QR Tokens        • User Accounts & Enrollments
        • Live Leaderboard ZSET    • Audit Logs & Final Grades
        • API Rate Limit Counters
```

- **Ephemeral Session State:** Store live WebSocket room memberships and active attendance tokens in Redis with exact TTLs (e.g., 10 seconds for rotating QR codes), avoiding disk I/O on PostgreSQL.
- **Live Quiz Leaderboards:** Utilize Redis Sorted Sets (`ZADD`, `ZREVRANGE`) to calculate instant millisecond-level live quiz rankings across hundreds of competing students.
- **API Response Caching:** Cache immutable data (Branches, Academic Levels, Past Semester Timetables) with Redis cache invalidation hooks on admin updates.

### 6.2. Frontend Optimization & Progressive Web App (PWA)
- **Route-Based Lazy Loading:**
  - Implement `React.lazy()` and dynamic `import()` for all role-specific views (`AdminLayout`, `FacultyLayout`, `StudentLayout`), shrinking the initial JavaScript bundle from ~2.4MB to $<250\text{KB}$.
- **Virtualization for Large Rosters:**
  - Integrate `@tanstack/react-virtual` for student enrollment lists and large attendance sheets to render only elements currently visible in the DOM viewport.
- **Progressive Web App (PWA) Manifest & Service Worker:**
  - Cache critical UI assets, icons, and fonts offline via Workbox.
  - Enable students to open the application, view their saved timetable, and read notebook entries even during campus Wi-Fi dropouts.

### 6.3. Asynchronous Task Queue (BullMQ)
Migrate heavy CPU/IO operations out of the HTTP request-response cycle into background worker threads:
- **Bulk Student CSV Parsing:** Processing 5,000+ student records with PRN hashing offloaded to BullMQ worker.
- **PDF Certificate & Report Card Rendering:** Headless Chromium rendering executed asynchronously; student receives a notification when their transcript is ready.
- **Batch Email & Notification Dispatch:** Push notifications and email alerts queued and rate-controlled to prevent provider throttling.

### 6.4. Database Query Profiling & Indexing Strategy
Optimize `schema.prisma` with composite indexes for frequent query patterns:
```prisma
// Example Index Optimization in schema.prisma:
model AttendanceRecord {
  // Existing fields...
  @@index([sessionId, studentId])
  @@index([studentId, status])
  @@index([createdAt])
}

model SessionCheckpointToken {
  // Existing fields...
  @@index([sessionId, checkpointType, expiresAt])
}

model AuditLog {
  // Existing fields...
  @@index([userId, action])
  @@index([createdAt])
}
```
- **Table Partitioning:** Implement PostgreSQL native range partitioning for `AttendanceRecord` and `AuditLog` by academic semester/year to maintain sub-millisecond query execution as records surpass millions of rows.

---

## 7. Phase 21: Native Mobile Application Ecosystem (iOS & Android)

### 7.1. Technology Selection: React Native with Expo
- **Shared Architecture:**
  - 100% code reuse of TypeScript API interfaces, Zod validation schemas, and formatting utilities between web and mobile repositories.
  - State management powered by Zustand with persistent AsyncStorage.
- **Target Platforms:** iOS 16+ and Android 10+ (API Level 29+).

```
mobile/
├── assets/                  # Logos, icons, splash screens
├── src/
│   ├── api/                 # Axios client with secure token refresh
│   ├── components/
│   │   ├── AttendanceScanner.tsx # Hardware camera scanner with real-time frame processing
│   │   ├── TimetableCard.tsx     # Native swipeable daily schedule card
│   │   └── OfflineNotebook.tsx   # SQLite local note editor
│   ├── navigation/          # React Navigation (Bottom Tabs + Native Stack)
│   ├── screens/
│   │   ├── auth/            # Biometric Login, First-Login Password Reset
│   │   ├── student/         # Mobile Dashboard, Live Attendance, Quizzes, Grades
│   │   └── faculty/         # Quick QR Launch, Daily Schedule, Override Roster
│   ├── services/
│   │   ├── PushService.ts   # FCM / APNs registration and deep-link routing
│   │   └── BiometricService.ts # FaceID / Fingerprint keychain authentication
│   └── store/               # Zustand mobile auth & offline cache stores
```

### 7.2. Mobile-Specific Capabilities & Hardware Integrations

#### 1. Hardware-Accelerated Dynamic QR Scanner:
- Utilize `react-native-vision-camera` with a native frame processor to scan rotating HMAC QR codes in $<200\text{ms}$.
- Automatic camera exposure and focus calibration for projecting screens and dimly lit lecture halls.

#### 2. Native Push Notification Engine (FCM & APNs):
- **Class Reminders:** "Lecture for *Data Structures* begins in 10 minutes in Room 302."
- **Attendance Alerts:** "Session started! START attendance checkpoint is now open."
- **Urgent Notices:** Campus-wide emergency alerts pushed directly to device lock screens with vibration alerts.

#### 3. Biometric Authentication (FaceID / Fingerprint):
- Integrate `expo-local-authentication` / `react-native-keychain`.
- Students authenticate with FaceID or Fingerprint in $<0.5\text{s}$, completely eliminating repetitive password entry while maintaining device-level security.

#### 4. Offline First Mode with Local SQLite Cache:
- Integrate WatermelonDB or `expo-sqlite` to cache student notebooks, personal timetables, and downloaded PDF materials locally.
- Students can write and edit notebook entries during transit or without internet; modifications synchronize automatically upon network reconnection.

#### 5. Mobile Home Screen Widgets:
- **iOS WidgetKit & Android AppWidget:**
  - Display current day's class timetable at a glance.
  - Attendance percentage meter showing proximity to the 75% requirement.

---

## 8. Phase 22: Production Infrastructure, Multi-Tenancy & Enterprise DevOps

### 8.1. Production Containerization & Orchestration
Provide hardened, minimal production Docker manifests:

- **Backend Multi-Stage `Dockerfile`:**
  - Build stage: TypeScript compilation and Prisma client generation.
  - Production runtime stage: `node:20-alpine`, non-root user (`node`), production dependencies only, $<150\text{MB}$ final container size.
- **Frontend Multi-Stage `Dockerfile`:**
  - Build stage: Vite production asset bundling.
  - Runtime stage: High-performance `nginx:alpine` serving static assets with gzip/brotli compression and browser cache-control headers.

```yaml
# docker-compose.prod.yml Architecture Overview
version: '3.8'
services:
  nginx-proxy:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [backend, frontend]
  backend:
    build: { context: ./backend, dockerfile: Dockerfile }
    environment:
      NODE_ENV: production
    depends_on: [redis]
  frontend:
    build: { context: ./frontend, dockerfile: Dockerfile }
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: [redisdata:/data]
volumes:
  redisdata:
```

### 8.2. Institutional Multi-Tenancy Architecture
Evolve AcademiaHub to serve multiple universities, colleges, or distinct campus branches from a single unified cloud deployment:
- **Tenant Identification:**
  - Subdomain routing (e.g., `sspu.academiahub.io`, `mit.academiahub.io`).
  - Automatic injection of `tenantId` into every database query via Prisma Client Extension / Middleware.
- **White-Label Customization:**
  - Institution-specific logos, branding color palettes, portal titles, and campus notice channels loaded dynamically based on the active domain.

### 8.3. Enterprise Observability & Site Reliability Engineering (SRE)
- **Centralized Telemetry (Prometheus & Grafana):**
  - Export metrics: Request latency, HTTP status code distribution, active WebSocket client count, database connection pool saturation.
- **Application Performance Monitoring & Error Tracking:**
  - Full integration of Sentry across both frontend and backend for real-time crash reporting, breadcrumbs, and release health monitoring.
- **Automated Disaster Recovery (DR):**
  - Daily automated pg_dump database snapshots encrypted with AES-256 and pushed to geo-redundant S3 cold storage.
  - Automated weekly restore drill verifying database recoverability and zero data corruption.

---

## 9. Phase 23: Chronological Implementation Milestones, Sprints & KPIs

### Roadmap Timeline Matrix

| Milestone / Phase | Estimated Duration | Primary Focus | Key Deliverables | Success Criteria (KPI) |
| :--- | :---: | :--- | :--- | :--- |
| **Sprint 1–2 (Phase 16)** | 3 Weeks | **Integration & Stabilization** | Supabase Cloud restore, local Docker DB fallback, session watchdog cron, storage RLS | DB online, 0 connection errors, orphan sessions auto-closed |
| **Sprint 3–4 (Phase 17)** | 4 Weeks | **Testing & QA Automation** | Automated Jest unit tests, Playwright E2E suites, k6 concurrency load scripts | $>85\%$ test coverage, 1,200 concurrent student load verified |
| **Sprint 5–6 (Phase 18)** | 4 Weeks | **Advanced Academic Features** | Parent portal, exam controller, GPA gradebook, PDF annotation tool | Parent login active, weighted grade calculations verified |
| **Sprint 7–8 (Phase 19)** | 4 Weeks | **Classroom 2.0 & Multimodal AI** | Collaborative whiteboard, doubt upvoting, slide-to-quiz AI generator | Whiteboard sync $<50\text{ms}$, 1-click AI quiz generation |
| **Sprint 9–10 (Phase 20)** | 4 Weeks | **System Optimization** | Redis caching layer, BullMQ background queues, PWA, route splitting | Bundle $<250\text{KB}$, p95 API response $<80\text{ms}$ |
| **Sprint 11–13 (Phase 21)** | 6 Weeks | **Native Mobile Ecosystem** | React Native (Expo) app, camera QR scanner, FCM/APNs push notifications | QR scan $<200\text{ms}$, push notifications deliver $<2\text{s}$ |
| **Sprint 14–15 (Phase 22)** | 4 Weeks | **DevOps & Multi-Tenancy** | Production Docker stack, multi-tenant subdomains, Prometheus/Sentry | 99.95% uptime SLA, multi-subdomain branding operational |

---

## 10. Risk Assessment, Fallback Protocols & Compliance

### 10.1. Risk Register & Mitigation Strategy

| Risk Scenario | Impact | Likelihood | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **Cloud Database Pause / Outage** | Critical | High (Free tier) | Provision automated failover or deploy persistent managed PostgreSQL (e.g. AWS RDS, Neon, or Railway) with connection pooling. |
| **Dynamic QR Projection Latency / Camera Glare** | Medium | Medium | Implement high-contrast QR display toggle, adjustable rotation intervals (1s to 15s), and emergency manual attendance code fallback. |
| **Gemini AI API Quota Depletion / Throttling** | Medium | Low | Implement Redis caching for common prompt responses, request rate limiting, and fallback to cached question banks. |
| **WebSocket Connection Drops during Lecture** | High | Low | Implement exponential reconnect logic with client-side buffer queue and HTTP polling fallback if WebSocket connection is severed. |
| **Student Proxy Attendance / Camera Sharing** | High | Medium | Dynamic rotating HMAC-SHA256 tokens with 10-second lifespans prevent photo sharing; optional BLE/geofencing verifies physical presence. |

### 10.2. Regulatory & Data Privacy Compliance
1. **FERPA / Academic Privacy Compliance:**
   - Strict student data isolation ensuring only authorized faculty and administrative officials can view grades, attendance records, and personal notes.
   - Comprehensive audit logging recording every view, export, and manual override of academic data.
2. **Data Retention & Right to be Forgotten:**
   - Automated archival of historical academic sessions after graduation.
   - GDPR-compliant data export utilities allowing students to download their complete academic history, notes, and quiz submissions in standard JSON/PDF formats.

---

## 11. Developer Onboarding & Execution Directives

### Recommended Tooling & Quick Start for Future Phases:
1. **To run the full development stack:**
   ```bash
   npm run dev
   ```
2. **To switch to the local database container:**
   ```bash
   docker-compose -f docker-compose.local-db.yml up -d
   ```
3. **To run automated unit & integration tests:**
   ```bash
   npm test --prefix backend
   ```
4. **To verify production builds:**
   ```bash
   npm run build --prefix backend
   npm run build --prefix frontend
   ```

*This master future plan document is versioned and maintained under source control to guide the iterative evolution of the AcademiaHub ecosystem.*
