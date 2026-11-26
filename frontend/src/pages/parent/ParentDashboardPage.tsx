import React, { useEffect, useState } from 'react';
import {
  parentApi,
  type LinkedChild,
  type ChildAttendanceResponse,
  type ChildGradesResponse,
} from '../../api/parent';
import { useAuthStore } from '../../stores/authStore';

export const ParentDashboardPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<ChildAttendanceResponse | null>(null);
  const [gradesData, setGradesData] = useState<ChildGradesResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'attendance' | 'grades'>('attendance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await parentApi.getChildren();
      setChildren(data);
      if (data.length > 0) {
        setSelectedStudentId(data[0].studentId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load linked student profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentData(selectedStudentId);
    }
  }, [selectedStudentId]);

  const loadStudentData = async (studentId: string) => {
    try {
      const [att, grd] = await Promise.all([
        parentApi.getChildAttendance(studentId).catch(() => null),
        parentApi.getChildGrades(studentId).catch(() => null),
      ]);
      setAttendanceData(att);
      setGradesData(grd);
    } catch (err: any) {
      console.error('Error loading child records', err);
    }
  };

  const selectedChild = children.find((c) => c.studentId === selectedStudentId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Navigation Bar */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-800/80 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              AH
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Parent & Guardian Portal
              </h1>
              <p className="text-xs text-slate-400">
                Logged in as <span className="text-indigo-400 font-medium">{user?.username}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={() => fetchChildren()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1.5 border border-slate-700"
          >
            <span>↻</span> Refresh
          </button>
          <button
            onClick={logout}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors border border-red-500/20"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading ward records...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm">
            {error}
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
            <div className="text-4xl mb-3">👨‍👩‍👧</div>
            <h3 className="text-lg font-semibold text-slate-200">No Linked Students Found</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
              No student profiles have been linked to this parent account yet. Please contact the IT Administration office to link your ward's PRN.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Child Selector Tabs (if multiple children) */}
            {children.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {children.map((child) => (
                  <button
                    key={child.studentId}
                    onClick={() => setSelectedStudentId(child.studentId)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                      selectedStudentId === child.studentId
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span>{child.firstName} {child.lastName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
                      {child.prn}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Statutory Attendance Warning Banner */}
            {selectedChild?.statutoryWarning && (
              <div className="p-4 md:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4 text-amber-200 shadow-xl shadow-amber-950/40">
                <div className="text-2xl mt-0.5">⚠️</div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-300 text-base">
                    Statutory Attendance Debarment Alert
                  </h4>
                  <p className="text-xs md:text-sm text-amber-200/90 mt-1">
                    {selectedChild.firstName}'s cumulative attendance has dropped to{' '}
                    <span className="font-bold text-white underline">
                      {selectedChild.attendancePercentage}%
                    </span>
                    , which is below the mandatory university threshold of 75%. Continued absenteeism risks debarment from end-semester final examinations.
                  </p>
                </div>
              </div>
            )}

            {/* Ward Profile Overview Card */}
            {selectedChild && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Student Details
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {selectedChild.firstName} {selectedChild.lastName}
                  </h3>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">PRN: {selectedChild.prn}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Class: <span className="text-slate-200 font-medium">{selectedChild.className} (Div {selectedChild.divisionName})</span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Attendance Health
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`text-3xl font-black ${
                        selectedChild.attendancePercentage >= 75
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {selectedChild.attendancePercentage}%
                    </span>
                    <span className="text-xs text-slate-400">
                      ({selectedChild.attendedLectures} / {selectedChild.totalLectures} sessions)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        selectedChild.attendancePercentage >= 75
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-amber-500 to-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, selectedChild.attendancePercentage)}%` }}
                    />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Academic Standing
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-indigo-400">
                      {gradesData?.sgpa ? gradesData.sgpa.toFixed(2) : '—'}
                    </span>
                    <span className="text-xs text-slate-400">SGPA (10-pt scale)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Academic Year: <span className="text-slate-200">{selectedChild.academicYear}</span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Contact Information
                  </span>
                  <p className="text-xs text-slate-300 mt-2 truncate">
                    ✉ {selectedChild.email || 'No email registered'}
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    📞 {selectedChild.phone || 'No phone registered'}
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === 'attendance'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Detailed Attendance Log
              </button>
              <button
                onClick={() => setActiveTab('grades')}
                className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
                  activeTab === 'grades'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Published Gradebook & Transcripts
              </button>
            </div>

            {/* Tab 1: Attendance Log */}
            {activeTab === 'attendance' && (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
                <div className="p-4 md:p-5 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white text-sm md:text-base">
                    Lecture Session Attendance Records
                  </h3>
                  <span className="text-xs text-slate-400">
                    Showing latest {attendanceData?.records.length || 0} sessions
                  </span>
                </div>

                {!attendanceData || attendanceData.records.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">
                    No attendance records logged for this student yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm">
                      <thead className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4">Faculty</th>
                          <th className="py-3 px-4">Date & Time</th>
                          <th className="py-3 px-4">Checkpoints</th>
                          <th className="py-3 px-4">Final Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {attendanceData.records.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-200">
                              {r.subjectName}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{r.facultyName}</td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                              {new Date(r.date).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                    r.startAttended
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-slate-800 text-slate-500'
                                  }`}
                                >
                                  START: {r.startAttended ? '✓' : '✗'}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                    r.endAttended
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-slate-800 text-slate-500'
                                  }`}
                                >
                                  END: {r.endAttended ? '✓' : '✗'}
                                </span>
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  r.finalStatus === 'PRESENT'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : r.finalStatus === 'PARTIAL'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : r.finalStatus === 'LATE'
                                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {r.finalStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Gradebook & Transcripts */}
            {activeTab === 'grades' && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden">
                  <div className="p-4 md:p-5 border-b border-slate-800 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-white text-sm md:text-base">
                        Published Academic Gradebook
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Weighting: Attendance 10% • Quizzes 20% • Assignments 30% • Exams 40%
                      </p>
                    </div>

                    {gradesData?.transcriptHash && (
                      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-[11px] text-indigo-300 font-mono">
                        <span>🔒 Verified:</span>
                        <span>{gradesData.transcriptHash.slice(0, 12)}...</span>
                      </div>
                    )}
                  </div>

                  {!gradesData || gradesData.grades.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      No published grades available for this academic term yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs md:text-sm">
                        <thead className="bg-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Subject</th>
                            <th className="py-3 px-4 text-center">Att (10%)</th>
                            <th className="py-3 px-4 text-center">Quiz (20%)</th>
                            <th className="py-3 px-4 text-center">Assign (30%)</th>
                            <th className="py-3 px-4 text-center">Exam (40%)</th>
                            <th className="py-3 px-4 text-center">Total (100)</th>
                            <th className="py-3 px-4 text-center">Grade</th>
                            <th className="py-3 px-4 text-center">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {gradesData.grades.map((g) => (
                            <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-medium text-slate-200">{g.subjectName}</span>
                                {g.subjectCode && (
                                  <span className="block text-[11px] text-slate-400 font-mono">
                                    {g.subjectCode}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-300 font-mono">
                                {g.attendanceScore.toFixed(0)}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-300 font-mono">
                                {g.quizScore.toFixed(0)}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-300 font-mono">
                                {g.assignmentScore.toFixed(0)}
                              </td>
                              <td className="py-3 px-4 text-center text-slate-300 font-mono">
                                {g.examScore.toFixed(0)}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-white font-mono">
                                {g.totalWeightedScore.toFixed(1)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded font-black text-xs ${
                                    g.letterGrade === 'O'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : g.letterGrade === 'A+' || g.letterGrade === 'A'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : g.letterGrade === 'B+' || g.letterGrade === 'B'
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                      : g.letterGrade === 'C'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {g.letterGrade}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-semibold text-slate-200 font-mono">
                                {g.gradePoint.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ParentDashboardPage;
