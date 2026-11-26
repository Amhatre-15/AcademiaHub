import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Server-side Supabase client using service role key.
// This client has full access to Storage and bypasses RLS.
// NEVER expose this to the frontend.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const STORAGE_BUCKET = 'academiahub-materials';
export const ASSIGNMENTS_BUCKET = 'academiahub-assignments';

export const storagePathBuilder = {
  material: (classId: string, subjectId: string, sessionId: string | null, fileName: string) => {
    const session = sessionId ?? 'general';
    return `materials/${classId}/${subjectId}/${session}/${fileName}`;
  },
  assignment: (classId: string, assignmentId: string, fileName: string) => {
    return `assignments/${classId}/${assignmentId}/${fileName}`;
  },
  submission: (assignmentId: string, studentId: string, fileName: string) => {
    return `submissions/${assignmentId}/${studentId}/${fileName}`;
  },
};
