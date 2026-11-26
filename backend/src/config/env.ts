import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),
  DIRECT_URL: requireEnv('DIRECT_URL'),

  // Supabase Storage
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // JWT
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_EXPIRES_IN: optionalEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  // Server
  PORT: parseInt(optionalEnv('PORT', '5000'), 10),
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),

  // Institution
  INITIAL_ADMIN_USERNAME: optionalEnv('INITIAL_ADMIN_USERNAME', 'admin'),
  INITIAL_ADMIN_PASSWORD: optionalEnv('INITIAL_ADMIN_PASSWORD', 'Admin@sspu2024'),
  INSTITUTION_NAME: optionalEnv('INSTITUTION_NAME', 'AcademiaHub College'),
  INSTITUTION_TIMEZONE: optionalEnv('INSTITUTION_TIMEZONE', 'Asia/Kolkata'),

  // Attendance
  ATTENDANCE_CODE_LENGTH: parseInt(optionalEnv('ATTENDANCE_CODE_LENGTH', '4'), 10),
  ATTENDANCE_CODE_EXPIRY_SECONDS: parseInt(optionalEnv('ATTENDANCE_CODE_EXPIRY_SECONDS', '60'), 10),

  // File uploads
  MAX_FILE_SIZE_MB: parseInt(optionalEnv('MAX_FILE_SIZE_MB', '50'), 10),
  ALLOWED_MIME_TYPES: optionalEnv(
    'ALLOWED_MIME_TYPES',
    'application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/gif,image/webp'
  ).split(','),

  // AI (optional)
  AI_PROVIDER: process.env['AI_PROVIDER'] ?? null,
  GEMINI_API_KEY: process.env['GEMINI_API_KEY'] ?? null,
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] ?? null,

  // Google Classroom (optional)
  GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'] ?? null,
  GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'] ?? null,
  GOOGLE_REDIRECT_URI: process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:5000/api/auth/google/callback',

  // Helpers
  get isDev() { return this.NODE_ENV === 'development'; },
  get isProd() { return this.NODE_ENV === 'production'; },
  get MAX_FILE_SIZE_BYTES() { return this.MAX_FILE_SIZE_MB * 1024 * 1024; },
} as const;
