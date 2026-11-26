import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { prisma } from './config/prisma';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sessionManager } from './websocket/SessionManager';
import { startSessionWatchdog, stopSessionWatchdog } from './jobs/sessionWatchdog';

// Route imports
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';

// Admin routes
import adminBranchRoutes from './routes/admin/branches';
import adminAcademicYearRoutes from './routes/admin/academicYears';
import adminAcademicLevelRoutes from './routes/admin/academicLevels';
import adminClassRoutes from './routes/admin/classes';
import adminSubjectRoutes from './routes/admin/subjects';
import adminFacultyRoutes from './routes/admin/faculty';
import adminFacultyAssignmentRoutes from './routes/admin/facultyAssignments';
import adminStudentRoutes from './routes/admin/students';
import adminEnrollmentRoutes from './routes/admin/enrollments';
import adminTimetableRoutes from './routes/admin/timetable';
import facultyTimetableRoutes from './routes/faculty/timetable';
import facultySessionRoutes from './routes/faculty/sessions';
import facultyAttendanceRoutes from './routes/faculty/attendance';
import facultyMaterialsRoutes from './routes/faculty/materials';
import studentTimetableRoutes from './routes/student/timetable';
import studentSessionRoutes from './routes/student/sessions';
import studentOverviewRoutes from './routes/student/overview';
import studentAttendanceRoutes from './routes/student/attendance';
import studentMaterialsRoutes from './routes/student/materials';
import facultyQuizRoutes from './routes/faculty/quiz';
import studentQuizRoutes from './routes/student/quiz';
import studentNotesRoutes from './routes/student/notes';
import sharedNotificationRoutes from './routes/shared/notifications';
import sharedNoticeRoutes from './routes/shared/notices';
import sharedGoogleRoutes from './routes/shared/google';
import facultyAssignmentRoutes from './routes/faculty/assignments';
import studentAssignmentRoutes from './routes/student/assignments';
import studentAnalyticsRoutes from './routes/student/analytics';
import facultyAnalyticsRoutes from './routes/faculty/analytics';
import facultyAiRoutes from './routes/faculty/ai';
import studentAiRoutes from './routes/student/ai';
import parentRoutes from './routes/parent';
import adminExamRoutes from './routes/admin/exam';

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────────
// Security middleware
// ─────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Configurable so the Playwright suite can perform multiple role logins
  // without tripping the production default of 20 attempts / 15 minutes.
  max: parseInt(process.env['AUTH_RATE_LIMIT_MAX'] ?? '20', 10),
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// app.use('/api', limiter);

// ─────────────────────────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/shared/notifications', sharedNotificationRoutes);
app.use('/api/shared/notices', sharedNoticeRoutes);
app.use('/api/shared/google', sharedGoogleRoutes);

// Admin routes
app.use('/api/admin/branches', adminBranchRoutes);
app.use('/api/admin/academic-years', adminAcademicYearRoutes);
app.use('/api/admin/academic-levels', adminAcademicLevelRoutes);
app.use('/api/admin/classes', adminClassRoutes);
app.use('/api/admin/subjects', adminSubjectRoutes);
app.use('/api/admin/faculty', adminFacultyRoutes);
app.use('/api/admin/faculty-assignments', adminFacultyAssignmentRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/admin/enrollments', adminEnrollmentRoutes);
app.use('/api/admin/timetable', adminTimetableRoutes);

app.use('/api/faculty/timetable', facultyTimetableRoutes);
app.use('/api/faculty/sessions', facultySessionRoutes);
app.use('/api/faculty/attendance', facultyAttendanceRoutes);
app.use('/api/faculty/materials', facultyMaterialsRoutes);
app.use('/api/faculty/quiz', facultyQuizRoutes);
app.use('/api/faculty/assignments', facultyAssignmentRoutes);
app.use('/api/faculty/analytics', facultyAnalyticsRoutes);
app.use('/api/faculty/ai', facultyAiRoutes);
app.use('/api/student/timetable', studentTimetableRoutes);
app.use('/api/student/sessions', studentSessionRoutes);
app.use('/api/student/attendance', studentAttendanceRoutes);
app.use('/api/student/overview', studentOverviewRoutes);
app.use('/api/student/materials', studentMaterialsRoutes);
app.use('/api/student/quiz', studentQuizRoutes);
app.use('/api/student/notes', studentNotesRoutes);
app.use('/api/student/assignments', studentAssignmentRoutes);
app.use('/api/student/analytics', studentAnalyticsRoutes);
app.use('/api/student/ai', studentAiRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/admin/exam', adminExamRoutes);

// ─────────────────────────────────────────────────────────────────
// 404 & Error handlers (must be last)
// ─────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // Test database connection
    try {
      await prisma.$connect();
      console.log('✅ Database connected');
    } catch (dbErr: any) {
      console.warn('⚠️ Warning: Database connection issue on startup:', dbErr.message);
      console.warn('   (If using Supabase, please verify that your project is unpaused in the Supabase Dashboard)');
    }

    // Initialize WebSockets
    sessionManager.initialize(server);

    server.listen(env.PORT, () => {
      console.log(`🚀 AcademiaHub API running on port ${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Frontend URL: ${env.FRONTEND_URL}`);

      // Start background session watchdog
      startSessionWatchdog();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  stopSessionWatchdog();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  stopSessionWatchdog();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

bootstrap();

export { app, server };
