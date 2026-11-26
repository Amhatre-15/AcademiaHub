# Graph Report - AcademicHub  (2026-10-21)

## Corpus Check
- 175 files · ~109,453 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .example 2, .css 2)

## Summary
- 1171 nodes · 2638 edges · 71 communities (62 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f95c617c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useAuthStore
- index.ts
- lucide-react
- FacultyLayout.tsx
- live-session-sockets.js
- faculty/AssignmentController.ts
- backend/package.json
- GoogleClassroomService
- NotesController.ts
- dependencies
- compilerOptions
- StudentLayout.tsx
- compilerOptions
- faculty/QuizController.ts
- compilerOptions
- frontend/package.json
- dependencies
- devDependencies
- scripts
- devDependencies
- fixtures.ts
- GoogleClassroomSection.tsx
- middleware/auth.ts
- .oxlintrc.json
- scripts
- migration.sql
- DynamicQrDisplay.tsx
- frontend/tsconfig.json
- engines
- prisma
- faculty/AttendanceController.ts
- requireAuth
- StudentLiveSessionPage.tsx
- "classes"
- seedLoadStudents.ts
- express
- "students"
- "quizzes"
- "class_sessions"
- End-to-End Tests (Playwright)
- faculty/SessionController.ts
- Load & Concurrency Tests (k6)
- student/SessionController.ts
- prisma.ts
- AcademiaHub — Implementation Status & Roadmap Tracker
- "assignments"
- "timetable_entries"
- FacultyQuizBankPage.tsx
- AcademiaHub — Master Future Roadmap & Multi-Phase Evolution Plan
- "subjects"
- lucide-react
- 7.2. Mobile-Specific Capabilities & Hardware Integrations
- 4. Phase 18: Core Feature Expansions & Advanced Academic Modules
- "academic_levels"
- "faculty"
- 3. Phase 17: Comprehensive Testing Suite & Quality Assurance Framework
- timetableConflict.ts
- 2. Phase 16: Immediate Integration, Cloud Activation & Operational Stabilization
- React + TypeScript + Vite
- 5. Phase 19: Next-Generation Interactive Classroom & Gemini Multimodal AI
- 6. Phase 20: System-Wide Optimization, Caching & High-Scale Performance
- 8. Phase 22: Production Infrastructure, Multi-Tenancy & Enterprise DevOps
- 1. Executive Vision & System Evolution Blueprint
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- copilot-instructions.md
- seedE2E.ts
- notifications.ts
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `express` - 58 edges
2. `lucide-react` - 45 edges
3. `prisma` - 41 edges
4. `react` - 41 edges
5. `requireAuth()` - 34 edges
6. `react-hot-toast` - 33 edges
7. `requireRole()` - 31 edges
8. `Modal()` - 27 edges
9. `@tanstack/react-query` - 25 edges
10. `useAuthStore` - 24 edges

## Surprising Connections (you probably didn't know these)
- `5.1. Real-Time Collaborative Whiteboard` --references--> `StudentNotebookPage()`  [INFERRED]
  future_plan.md → frontend/src/pages/student/StudentNotebookPage.tsx
- `6.2. Frontend Optimization & Progressive Web App (PWA)` --references--> `AdminLayout()`  [INFERRED]
  future_plan.md → frontend/src/pages/admin/AdminLayout.tsx
- `6.2. Frontend Optimization & Progressive Web App (PWA)` --references--> `FacultyLayout()`  [INFERRED]
  future_plan.md → frontend/src/pages/faculty/FacultyLayout.tsx
- `6.2. Frontend Optimization & Progressive Web App (PWA)` --references--> `StudentLayout()`  [INFERRED]
  future_plan.md → frontend/src/pages/student/StudentLayout.tsx
- `submitAttendance()` --calls--> `deriveCheckpointSecret()`  [EXTRACTED]
  backend/src/controllers/student/SessionController.ts → backend/src/utils/attendance.ts

## Import Cycles
- None detected.

## Communities (71 total, 9 thin omitted)

### Community 0 - "useAuthStore"
Cohesion: 0.09
Nodes (28): authApi, AuthUser, ChangePasswordRequest, LoginRequest, LoginResponse, App(), queryClient, ProtectedRoute() (+20 more)

### Community 1 - "index.ts"
Cohesion: 0.08
Nodes (22): app, authLimiter, globalLimiter, server, errorHandler(), notFoundHandler(), router, router (+14 more)

### Community 2 - "lucide-react"
Cohesion: 0.15
Nodes (15): QuizResultAnswer, QuizResultResponse, StudentActiveQuizResponse, studentApi, StudentAssignment, StudentAttendanceSummary, StudentNote, AttendanceRingChart() (+7 more)

### Community 3 - "FacultyLayout.tsx"
Cohesion: 0.13
Nodes (22): TimetableEntry, AttendanceRosterEntry, AttendanceStatus, facultyApi, FacultyAssignment, Notice, QuizOption, SessionAttendanceResponse (+14 more)

### Community 4 - "live-session-sockets.js"
Cohesion: 0.09
Nodes (15): attendanceLatency, attendanceSuccess, duplicateSubmissions, expiredTokens, options, RATE, TOKENS, HOLD_SECONDS (+7 more)

### Community 5 - "faculty/AssignmentController.ts"
Cohesion: 0.11
Nodes (21): ASSIGNMENTS_BUCKET, STORAGE_BUCKET, storagePathBuilder, supabase, deleteMaterial(), getMaterials(), updateMaterial(), uploadMaterial() (+13 more)

### Community 6 - "backend/package.json"
Cohesion: 0.07
Nodes (27): description, @types/node, typescript, main, name, version, cors, express-rate-limit (+19 more)

### Community 8 - "NotesController.ts"
Cohesion: 0.14
Nodes (16): generateQuiz(), generateQuizSchema, buildNoteResponse(), createNote(), createNoteSchema, deleteNote(), getNote(), getNotesContext() (+8 more)

### Community 9 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, express-validator, @google/generative-ai (+13 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+12 more)

### Community 11 - "StudentLayout.tsx"
Cohesion: 0.16
Nodes (18): api, Notice, Notification, sharedApi, NotificationBell(), StudentAiAssistant(), NoticesPage(), StudentAchievementsPage() (+10 more)

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, declaration, declarationMap, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames, lib (+10 more)

### Community 13 - "faculty/QuizController.ts"
Cohesion: 0.09
Nodes (23): http, request(), runE2E(), addQuestion(), createQuiz(), createQuizSchema, deleteQuestion(), deleteQuiz() (+15 more)

### Community 14 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 15 - "frontend/package.json"
Cohesion: 0.10
Nodes (19): @types/node, typescript, name, private, type, version, autoprefixer, axios (+11 more)

### Community 16 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, axios, clsx, date-fns, html5-qrcode, lucide-react, qrcode, react (+8 more)

### Community 17 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, jest, prisma, ts-jest, ts-node, ts-node-dev, @types/bcryptjs, @types/cors (+7 more)

### Community 18 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, db:generate, db:migrate, db:migrate:prod, db:reset, db:seed, db:studio (+7 more)

### Community 19 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, autoprefixer, jsdom, oxlint, tailwindcss, @tailwindcss/vite, @testing-library/jest-dom, @testing-library/react (+9 more)

### Community 20 - "fixtures.ts"
Cohesion: 0.07
Nodes (36): ActiveClassSession, API_URL, apiLogin(), AuthSession, bearer(), buildDynamicQrPayload(), endQuizAndSession(), ensureLiveStartCheckpoint() (+28 more)

### Community 21 - "GoogleClassroomSection.tsx"
Cohesion: 0.12
Nodes (24): getApiError(), Material, ClassroomDetailsResponse, GoogleAnnouncement, googleClassroomApi, GoogleClassroomLink, GoogleCourse, GoogleCourseMaterial (+16 more)

### Community 22 - "middleware/auth.ts"
Cohesion: 0.14
Nodes (13): env, Express, JwtPayload, Request, requireFirstLoginComplete(), router, mockFindUnique, decodeJwt() (+5 more)

### Community 23 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 24 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, preview, test, test:coverage, test:watch

### Community 25 - "migration.sql"
Cohesion: 0.11
Nodes (34): "attendance_checkpoints", attendance_checkpoints_checkpoint_type_idx, attendance_checkpoints_code_idx, attendance_checkpoints_expires_at_idx, attendance_checkpoints_is_active_idx, attendance_checkpoints_session_id_idx, "attendance_code_submissions", attendance_code_submissions_checkpoint_id_idx (+26 more)

### Community 26 - "DynamicQrDisplay.tsx"
Cohesion: 0.23
Nodes (12): AttendanceCheckpoint, DynamicQrDisplay(), DynamicQrDisplayProps, DynamicQrScanner(), DynamicQrScannerProps, DynamicQrPayload, formatQrPayload(), generateDynamicQrToken() (+4 more)

### Community 30 - "faculty/AttendanceController.ts"
Cohesion: 0.43
Nodes (5): getFacultySessions(), getSessionAttendance(), overrideAttendance(), overrideSchema, router

### Community 31 - "requireAuth"
Cohesion: 0.38
Nodes (7): prisma, requireAuth(), requireRole(), AppError, createError(), validateRequest(), express-validator

### Community 32 - "StudentLiveSessionPage.tsx"
Cohesion: 0.25
Nodes (12): ClassSession, StudentQuizQuestion, useLiveSession(), Countdown(), LiveSessionPage(), QuizControlPanel(), CheatEvent, Countdown() (+4 more)

### Community 33 - ""classes""
Cohesion: 0.12
Nodes (21): "academic_years", academic_years_name_key, "classes", classes_academic_level_id_academic_year_id_semester_id_name_key, classes_academic_year_id_idx, classes_semester_id_idx, "enrollments", enrollments_class_id_idx (+13 more)

### Community 34 - "seedLoadStudents.ts"
Cohesion: 0.25
Nodes (4): COUNT, main(), OUT_DIR, prisma

### Community 35 - "express"
Cohesion: 0.13
Nodes (14): getFacultyAnalytics(), createNotice(), listNotices(), chat(), chatSchema, getLeaderboard(), getStudentAnalytics(), getAttendanceSummary() (+6 more)

### Community 36 - ""students""
Cohesion: 0.11
Nodes (18): "badges", badges_name_key, "engagement_events", engagement_events_event_type_idx, engagement_events_session_id_idx, engagement_events_student_id_idx, "student_badges", student_badges_student_id_badge_id_key (+10 more)

### Community 37 - ""quizzes""
Cohesion: 0.12
Nodes (18): "quiz_answers", quiz_answers_attempt_id_idx, quiz_answers_attempt_id_question_id_key, quiz_answers_question_id_idx, "quiz_attempts", quiz_attempts_quiz_id_idx, quiz_attempts_quiz_id_student_id_key, quiz_attempts_student_id_idx (+10 more)

### Community 38 - ""class_sessions""
Cohesion: 0.14
Nodes (17): "batches", batches_division_id_idx, batches_division_id_name_key, "class_sessions", class_sessions_class_id_idx, class_sessions_date_idx, class_sessions_faculty_id_idx, class_sessions_status_idx (+9 more)

### Community 39 - "End-to-End Tests (Playwright)"
Cohesion: 0.29
Nodes (6): End-to-End Tests (Playwright), Fixture lifecycle, One-time setup, Run, Troubleshooting, What is covered

### Community 40 - "faculty/SessionController.ts"
Cohesion: 0.10
Nodes (26): calculateFinalAttendance(), endSession(), generateAttendanceCode(), getActiveSession(), overrideAttendance(), overrideSchema, startSession(), bootstrap() (+18 more)

### Community 41 - "Load & Concurrency Tests (k6)"
Cohesion: 0.29
Nodes (6): 1. Prepare the fixture and token pool, 2. Start a live session, 3. Run the benchmarks, Load & Concurrency Tests (k6), Reading the output, Thresholds

### Community 42 - "student/SessionController.ts"
Cohesion: 0.16
Nodes (14): getActiveQuiz(), getQuizHistory(), getQuizResult(), submitAnswer(), submitAnswerSchema, verifyQuizEligibility(), getActiveSession(), submitAttendance() (+6 more)

### Community 43 - "prisma.ts"
Cohesion: 0.18
Nodes (7): createAssignment(), getAssignment(), gradeSubmission(), listAssignments(), router, upload, NotificationService

### Community 44 - "AcademiaHub — Implementation Status & Roadmap Tracker"
Cohesion: 0.18
Nodes (10): 1. Quick Start: Where We Are & Immediate Next Priorities, 2. What Is DONE (Completed Modules & Capabilities), 3. What Is REMAINING (Upcoming Implementation Queue), 4. How to Resume Work Next Time, AcademiaHub — Implementation Status & Roadmap Tracker, Comprehensive List of All Previously Implemented Phases:, Next Immediate Priority:, Priority 4: Native Mobile Application (iOS & Android) (+2 more)

### Community 45 - ""assignments""
Cohesion: 0.20
Nodes (10): "assignment_files", assignment_files_assignment_id_idx, "assignment_submissions", assignment_submissions_assignment_id_idx, assignment_submissions_assignment_id_student_id_key, assignment_submissions_student_id_idx, "assignments", assignments_class_id_idx (+2 more)

### Community 46 - ""timetable_entries""
Cohesion: 0.20
Nodes (10): "lecture_types", lecture_types_code_key, "time_slots", time_slots_start_time_end_time_key, "timetable_entries", timetable_entries_class_id_division_id_batch_id_day_of_week_key, timetable_entries_class_id_idx, timetable_entries_day_of_week_idx (+2 more)

### Community 47 - "FacultyQuizBankPage.tsx"
Cohesion: 0.33
Nodes (9): Quiz, QuizQuestion, CreateQuizModal(), FacultyQuizBankPage(), QuestionCard(), QuestionFormModal(), QuizCard(), QuizEditor() (+1 more)

### Community 48 - "AcademiaHub — Master Future Roadmap & Multi-Phase Evolution Plan"
Cohesion: 0.20
Nodes (9): 10.1. Risk Register & Mitigation Strategy, 10.2. Regulatory & Data Privacy Compliance, 10. Risk Assessment, Fallback Protocols & Compliance, 11. Developer Onboarding & Execution Directives, 9. Phase 23: Chronological Implementation Milestones, Sprints & KPIs, AcademiaHub — Master Future Roadmap & Multi-Phase Evolution Plan, Recommended Tooling & Quick Start for Future Phases:, Roadmap Timeline Matrix (+1 more)

### Community 49 - ""subjects""
Cohesion: 0.22
Nodes (9): "student_notes", student_notes_class_id_idx, student_notes_session_id_idx, student_notes_student_id_idx, student_notes_subject_id_idx, "subjects", subjects_branch_id_idx, subjects_branch_id_name_key (+1 more)

### Community 50 - "lucide-react"
Cohesion: 0.05
Nodes (78): AcademicLevel, AcademicYear, adminApi, Batch, Branch, Class, Division, Enrollment (+70 more)

### Community 53 - "7.2. Mobile-Specific Capabilities & Hardware Integrations"
Cohesion: 0.25
Nodes (8): 1. Hardware-Accelerated Dynamic QR Scanner:, 2. Native Push Notification Engine (FCM & APNs):, 3. Biometric Authentication (FaceID / Fingerprint):, 4. Offline First Mode with Local SQLite Cache:, 5. Mobile Home Screen Widgets:, 7.1. Technology Selection: React Native with Expo, 7.2. Mobile-Specific Capabilities & Hardware Integrations, 7. Phase 21: Native Mobile Application Ecosystem (iOS & Android)

### Community 54 - "4. Phase 18: Core Feature Expansions & Advanced Academic Modules"
Cohesion: 0.25
Nodes (8): 1. Parent / Guardian Portal:, 2. Examination Controller & Hall Ticket Engine:, 3. Dean & HOD Management Cockpit:, 4.1. Extended Institutional Roles & Multi-Stakeholder Access, 4.2. Smart Gradebook & Weighted GPA/CGPA Engine, 4.3. Advanced Assignment Plagiarism & In-Browser PDF Annotation, 4.4. Physical Campus Asset & Facility Booking Engine, 4. Phase 18: Core Feature Expansions & Advanced Academic Modules

### Community 55 - ""academic_levels""
Cohesion: 0.29
Nodes (7): "academic_levels", academic_levels_branch_id_idx, academic_levels_branch_id_name_key, "branches", branches_code_idx, branches_code_key, branches_name_key

### Community 56 - ""faculty""
Cohesion: 0.33
Nodes (6): "faculty", faculty_email_key, faculty_employee_id_key, faculty_status_idx, faculty_user_id_idx, faculty_user_id_key

### Community 58 - "3. Phase 17: Comprehensive Testing Suite & Quality Assurance Framework"
Cohesion: 0.33
Nodes (6): 3.1. Automated Backend Unit & Integration Tests (Jest / Supertest), 3.2. Automated Frontend Component & Hook Tests (Vitest & React Testing Library), 3.3. End-to-End (E2E) Browser Automation (Playwright), 3.4. High-Concurrency WebSocket & API Load Testing (k6), 3. Phase 17: Comprehensive Testing Suite & Quality Assurance Framework, Key Test Scenarios:

### Community 59 - "timetableConflict.ts"
Cohesion: 0.60
Nodes (3): checkTimetableSlotConflict(), ConflictCheckResult, TimetableSlotEntry

### Community 60 - "2. Phase 16: Immediate Integration, Cloud Activation & Operational Stabilization"
Cohesion: 0.40
Nodes (5): 2.1. Cloud Database Resumption & Hybrid Fallback Engine, 2.2. Supabase Storage Pipeline Stabilization, 2.3. Automated Background Cron & State Maintenance, 2.4. Google Classroom & Gemini AI Credentials Verification, 2. Phase 16: Immediate Integration, Cloud Activation & Operational Stabilization

### Community 61 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 62 - "5. Phase 19: Next-Generation Interactive Classroom & Gemini Multimodal AI"
Cohesion: 0.50
Nodes (4): 5.1. Real-Time Collaborative Whiteboard, 5.2. Live Classroom In-Session Doubt Queue, 5.3. Multimodal Gemini AI Classroom Intelligence, 5. Phase 19: Next-Generation Interactive Classroom & Gemini Multimodal AI

### Community 63 - "6. Phase 20: System-Wide Optimization, Caching & High-Scale Performance"
Cohesion: 0.40
Nodes (5): 6.1. High-Performance Caching Layer (Redis), 6.2. Frontend Optimization & Progressive Web App (PWA), 6.3. Asynchronous Task Queue (BullMQ), 6.4. Database Query Profiling & Indexing Strategy, 6. Phase 20: System-Wide Optimization, Caching & High-Scale Performance

### Community 64 - "8. Phase 22: Production Infrastructure, Multi-Tenancy & Enterprise DevOps"
Cohesion: 0.50
Nodes (4): 8.1. Production Containerization & Orchestration, 8.2. Institutional Multi-Tenancy Architecture, 8.3. Enterprise Observability & Site Reliability Engineering (SRE), 8. Phase 22: Production Infrastructure, Multi-Tenancy & Enterprise DevOps

### Community 65 - "1. Executive Vision & System Evolution Blueprint"
Cohesion: 0.67
Nodes (3): 1.1. Context & Baseline, 1.2. Strategic Objectives for the Future Phases, 1. Executive Vision & System Evolution Blueprint

### Community 74 - "seedE2E.ts"
Cohesion: 0.18
Nodes (8): BRANCH, currentSlot(), main(), prisma, SUBJECT, prisma, bcryptjs, dotenv

### Community 76 - "notifications.ts"
Cohesion: 0.60
Nodes (3): getNotifications(), markAsRead(), router

### Community 78 - "vite.config.ts"
Cohesion: 0.22
Nodes (6): @tailwindcss/vite, @testing-library/react, @testing-library/user-event, vite, @vitejs/plugin-react, vitest

## Knowledge Gaps
- **31 isolated node(s):** `@types/node`, `@types/ws`, `nanoid`, `uuid`, `@types/bcryptjs` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 446 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `express` to `index.ts`, `faculty/AssignmentController.ts`, `backend/package.json`, `NotesController.ts`, `faculty/SessionController.ts`, `student/SessionController.ts`, `prisma.ts`, `notifications.ts`, `faculty/QuizController.ts`, `middleware/auth.ts`, `faculty/AttendanceController.ts`, `requireAuth`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `requireAuth()` (e.g. with `academicLevels.ts` and `academicYears.ts`) actually correct?**
  _`requireAuth()` has 32 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/ws`, `nanoid` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useAuthStore` be split into smaller, more focused modules?**
  _Cohesion score 0.09408033826638477 - nodes in this community are weakly interconnected._
- **Why does `AcademiaHub — Master Future Roadmap & Multi-Phase Evolution Plan` connect `AcademiaHub — Master Future Roadmap & Multi-Phase Evolution Plan` to `8. Phase 22: Production Infrastructure, Multi-Tenancy & Enterprise DevOps`, `1. Executive Vision & System Evolution Blueprint`, `7.2. Mobile-Specific Capabilities & Hardware Integrations`, `4. Phase 18: Core Feature Expansions & Advanced Academic Modules`, `3. Phase 17: Comprehensive Testing Suite & Quality Assurance Framework`, `2. Phase 16: Immediate Integration, Cloud Activation & Operational Stabilization`, `5. Phase 19: Next-Generation Interactive Classroom & Gemini Multimodal AI`, `6. Phase 20: System-Wide Optimization, Caching & High-Scale Performance`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08374384236453201 - nodes in this community are weakly interconnected._
- **Why does `6.2. Frontend Optimization & Progressive Web App (PWA)` connect `6. Phase 20: System-Wide Optimization, Caching & High-Scale Performance` to `StudentLayout.tsx`, `lucide-react`, `FacultyLayout.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._