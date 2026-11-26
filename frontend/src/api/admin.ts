import api from './client';

// ─── Types ────────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { academicLevels: number; subjects: number };
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count?: { semesters: number; enrollments: number };
}

export interface AcademicLevel {
  id: string;
  branchId: string;
  name: string;
  description?: string;
  order: number;
  branch: { id: string; name: string; code: string };
  _count?: { classes: number; semesters: number };
}

export interface Semester {
  id: string;
  academicLevelId: string;
  academicYearId: string;
  number: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  academicLevel: AcademicLevel;
}

export interface Division {
  id: string;
  classId: string;
  name: string;
  isActive: boolean;
  batches: Batch[];
  _count?: { enrollments: number };
}

export interface Batch {
  id: string;
  divisionId: string;
  name: string;
  isActive: boolean;
}

export interface Class {
  id: string;
  name: string;
  isActive: boolean;
  academicLevel: AcademicLevel;
  academicYear: AcademicYear;
  semester: Semester;
  divisions?: Division[];
  _count?: { divisions: number; enrollments: number };
}

export interface Subject {
  id: string;
  branchId: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  branch: { id: string; name: string; code: string };
  _count?: { facultyAssignments: number };
}

export interface FacultyProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  status: 'ACTIVE' | 'INACTIVE';
  user: {
    id: string;
    username: string;
    status: 'ACTIVE' | 'INACTIVE';
    firstLogin: boolean;
    createdAt: string;
  };
  _count?: { assignments: number; sessions: number };
}

export interface FacultyAssignment {
  id: string;
  faculty: { id: string; firstName: string; lastName: string };
  subject: Subject;
  class: Class;
  division?: Division;
  batch?: Batch;
  semester: Semester;
  academicYear: AcademicYear;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface StudentProfile {
  id: string;
  firstName: string;
  lastName: string;
  prn: string;
  email?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  user: {
    id: string;
    username: string;
    status: 'ACTIVE' | 'INACTIVE';
    firstLogin: boolean;
    createdAt: string;
  };
  enrollments?: Enrollment[];
}

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  divisionId?: string;
  batchId?: string;
  academicYearId: string;
  semesterId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED';
  student?: { id: string; firstName: string; lastName: string; prn: string };
  class?: Class;
  division?: Division;
  batch?: Batch;
  academicYear?: AcademicYear;
  semester?: Semester;
}

export interface TimetableEntry {
  id: string;
  classId: string;
  divisionId?: string;
  batchId?: string;
  subjectId: string;
  facultyId: string;
  lectureTypeId: string;
  dayOfWeek: number;
  timeSlotId: string;
  room?: string;
  academicYearId: string;
  semesterId: string;
  isActive: boolean;
  subject: { id: string; name: string; code?: string };
  class: { id: string; name: string };
  faculty: { id: string; user: { username: string }; firstName: string; lastName: string };
  lectureType: { id: string; code: string; name: string };
  timeSlot: { id: string; startTime: string; endTime: string };
}

// ─── Parsed import row ────────────────────────────────────────────────
export interface ParsedStudentRow {
  firstName: string;
  lastName: string;
  prn: string;
  rowNumber: number;
  duplicatePrn?: boolean;
  usernameConflict?: boolean;
}

export interface ParsedInvalidRow {
  rowNumber: number;
  rawLine: string;
  reason: string;
}

// ─── API functions ────────────────────────────────────────────────────

export const adminApi = {
  // Branches
  getBranches: () => api.get<{ branches: Branch[] }>('/admin/branches').then((r) => r.data.branches),
  createBranch: (data: { name: string; code: string; description?: string }) =>
    api.post<{ branch: Branch }>('/admin/branches', data).then((r) => r.data.branch),
  updateBranch: (id: string, data: Partial<Branch>) =>
    api.put<{ branch: Branch }>(`/admin/branches/${id}`, data).then((r) => r.data.branch),
  deleteBranch: (id: string) => api.delete(`/admin/branches/${id}`),

  // Academic Years
  getAcademicYears: () =>
    api.get<{ academicYears: AcademicYear[] }>('/admin/academic-years').then((r) => r.data.academicYears),
  createAcademicYear: (data: { name: string; startDate: string; endDate: string; isActive?: boolean }) =>
    api.post<{ academicYear: AcademicYear }>('/admin/academic-years', data).then((r) => r.data.academicYear),
  updateAcademicYear: (id: string, data: Partial<AcademicYear>) =>
    api.put<{ academicYear: AcademicYear }>(`/admin/academic-years/${id}`, data).then((r) => r.data.academicYear),
  getSemesters: (yearId: string) =>
    api.get<{ semesters: Semester[] }>(`/admin/academic-years/${yearId}/semesters`).then((r) => r.data.semesters),
  createSemester: (yearId: string, data: { academicLevelId: string; number: number; startDate: string; endDate: string }) =>
    api.post<{ semester: Semester }>(`/admin/academic-years/${yearId}/semesters`, data).then((r) => r.data.semester),

  // Academic Levels
  getAcademicLevels: (branchId?: string) =>
    api.get<{ academicLevels: AcademicLevel[] }>('/admin/academic-levels', { params: { branchId } }).then((r) => r.data.academicLevels),
  createAcademicLevel: (data: { branchId: string; name: string; description?: string; order?: number }) =>
    api.post<{ academicLevel: AcademicLevel }>('/admin/academic-levels', data).then((r) => r.data.academicLevel),
  updateAcademicLevel: (id: string, data: Partial<AcademicLevel>) =>
    api.put<{ academicLevel: AcademicLevel }>(`/admin/academic-levels/${id}`, data).then((r) => r.data.academicLevel),

  // Classes
  getClasses: (params?: { academicYearId?: string; semesterId?: string; academicLevelId?: string }) =>
    api.get<{ classes: Class[] }>('/admin/classes', { params }).then((r) => r.data.classes),
  getClass: (id: string) =>
    api.get<{ class: Class }>(`/admin/classes/${id}`).then((r) => r.data.class),
  createClass: (data: { academicLevelId: string; academicYearId: string; semesterId: string; name: string }) =>
    api.post<{ class: Class }>('/admin/classes', data).then((r) => r.data.class),
  updateClass: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.put<{ class: Class }>(`/admin/classes/${id}`, data).then((r) => r.data.class),
  createDivision: (classId: string, data: { name: string }) =>
    api.post<{ division: Division }>(`/admin/classes/${classId}/divisions`, data).then((r) => r.data.division),
  createBatch: (divisionId: string, data: { name: string }) =>
    api.post<{ batch: Batch }>(`/admin/classes/divisions/${divisionId}/batches`, data).then((r) => r.data.batch),
  deleteBatch: (divisionId: string, batchId: string) =>
    api.delete(`/admin/classes/divisions/${divisionId}/batches/${batchId}`),

  // Subjects
  getSubjects: (branchId?: string) =>
    api.get<{ subjects: Subject[] }>('/admin/subjects', { params: { branchId } }).then((r) => r.data.subjects),
  createSubject: (data: { branchId: string; name: string; code?: string; description?: string }) =>
    api.post<{ subject: Subject }>('/admin/subjects', data).then((r) => r.data.subject),
  updateSubject: (id: string, data: Partial<Subject>) =>
    api.put<{ subject: Subject }>(`/admin/subjects/${id}`, data).then((r) => r.data.subject),
  deleteSubject: (id: string) => api.delete(`/admin/subjects/${id}`),

  // Faculty
  getFaculty: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ faculty: FacultyProfile[]; total: number; page: number; limit: number; totalPages: number }>('/admin/faculty', { params }).then((r) => r.data),
  getFacultyMember: (id: string) =>
    api.get<{ faculty: FacultyProfile }>(`/admin/faculty/${id}`).then((r) => r.data.faculty),
  createFaculty: (data: { firstName: string; lastName: string; email?: string; employeeId?: string; department?: string }) =>
    api.post<{ faculty: FacultyProfile }>('/admin/faculty', data).then((r) => r.data.faculty),
  updateFaculty: (id: string, data: Partial<FacultyProfile>) =>
    api.put<{ faculty: FacultyProfile }>(`/admin/faculty/${id}`, data).then((r) => r.data.faculty),
  resetFacultyPassword: (id: string) =>
    api.post(`/admin/faculty/${id}/reset-password`).then((r) => r.data),

  // Faculty Assignments
  getFacultyAssignments: (params?: { facultyId?: string; classId?: string; semesterId?: string }) =>
    api.get<{ assignments: FacultyAssignment[] }>('/admin/faculty-assignments', { params }).then((r) => r.data.assignments),
  createFacultyAssignment: (data: {
    facultyId: string;
    subjectId: string;
    classId: string;
    divisionId?: string;
    batchId?: string;
    academicYearId: string;
    semesterId: string;
  }) => api.post<{ assignment: FacultyAssignment }>('/admin/faculty-assignments', data).then((r) => r.data.assignment),
  removeFacultyAssignment: (id: string) => api.delete(`/admin/faculty-assignments/${id}`),

  // Students
  getStudents: (params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ students: StudentProfile[]; total: number }>('/admin/students', { params }).then((r) => r.data),
  getStudent: (id: string) =>
    api.get<{ student: StudentProfile }>(`/admin/students/${id}`).then((r) => r.data.student),
  createStudent: (data: { firstName: string; lastName: string; prn: string; email?: string }) =>
    api.post<{ student: StudentProfile }>('/admin/students', data).then((r) => r.data.student),
  updateStudent: (id: string, data: Partial<StudentProfile>) =>
    api.put<{ student: StudentProfile }>(`/admin/students/${id}`, data).then((r) => r.data.student),
  resetStudentPassword: (id: string) =>
    api.post(`/admin/students/${id}/reset-password`).then((r) => r.data),
  parseBulkStudents: (rawText: string) =>
    api.post<{
      valid: ParsedStudentRow[];
      invalid: ParsedInvalidRow[];
      summary: { totalRows: number; validRows: number; invalidRows: number; duplicatePrns: number };
    }>('/admin/students/bulk-parse', { rawText }).then((r) => r.data),
  importBulkStudents: (students: Array<{ firstName: string; lastName: string; prn: string; email?: string }>) =>
    api.post<{
      message: string;
      success: Array<{ prn: string; username: string; firstName: string; lastName: string }>;
      skipped: Array<{ prn: string; reason: string }>;
      errors: Array<{ prn: string; reason: string }>;
    }>('/admin/students/bulk-import', { students }, { timeout: 120000 }).then((r) => r.data),

  // Enrollments
  getEnrollments: (params?: { classId?: string; semesterId?: string; divisionId?: string; page?: number; limit?: number }) =>
    api.get<{ enrollments: Enrollment[]; total: number; page: number; limit: number; totalPages: number }>('/admin/enrollments', { params }).then((r) => r.data),
  createEnrollment: (data: {
    studentId: string;
    classId: string;
    divisionId?: string;
    batchId?: string;
    academicYearId: string;
    semesterId: string;
  }) => api.post<{ enrollment: Enrollment }>('/admin/enrollments', data).then((r) => r.data.enrollment),
  bulkEnroll: (data: {
    studentIds: string[];
    classId: string;
    divisionId?: string;
    batchId?: string;
    academicYearId: string;
    semesterId: string;
  }) => api.post('/admin/enrollments/bulk', data).then((r) => r.data),
  removeEnrollment: (id: string) => api.delete(`/admin/enrollments/${id}`),

  // Timetable Bulk
  parseBulkTimetable: (data: { rawText: string; classId: string; semesterId: string }) =>
    api.post<{
      valid: any[];
      invalid: any[];
      summary: { totalRows: number; validRows: number; invalidRows: number };
    }>('/admin/timetable/bulk-parse', data).then((r) => r.data),
  importBulkTimetable: (data: { entries: any[]; classId: string; semesterId: string }) =>
    api.post<{
      message: string;
      success: number;
      skipped: any[];
      errors: any[];
    }>('/admin/timetable/bulk-import', data).then((r) => r.data),
};
