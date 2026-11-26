import { useQuery } from '@tanstack/react-query';
import { GitBranch, Calendar, GraduationCap, Users, BookOpen, ClipboardList } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { PageHeader, StatCard } from '../../components/ui/AdminComponents';

export default function AdminOverview() {
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: adminApi.getBranches });
  const { data: yearsData } = useQuery({ queryKey: ['academic-years'], queryFn: adminApi.getAcademicYears });
  const { data: facultyData } = useQuery({ queryKey: ['faculty', { limit: 1 }], queryFn: () => adminApi.getFaculty({ limit: 1 }) });
  const { data: studentsData } = useQuery({ queryKey: ['students', { limit: 1 }], queryFn: () => adminApi.getStudents({ limit: 1 }) });
  const { data: classes } = useQuery({ queryKey: ['classes'], queryFn: () => adminApi.getClasses() });
  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: () => adminApi.getSubjects() });

  const activeYear = yearsData?.find((y) => y.isActive);

  return (
    <div className="p-6">
      <PageHeader
        title="Admin Overview"
        subtitle="Manage your institution's academic structure, faculty, and students."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Branches"
          value={branches?.length ?? '—'}
          icon={<GitBranch size={18} />}
          color="blue"
        />
        <StatCard
          label="Classes"
          value={classes?.length ?? '—'}
          icon={<Calendar size={18} />}
          color="purple"
        />
        <StatCard
          label="Subjects"
          value={subjects?.length ?? '—'}
          icon={<BookOpen size={18} />}
          color="green"
        />
        <StatCard
          label="Faculty Members"
          value={facultyData?.total ?? '—'}
          icon={<Users size={18} />}
          color="orange"
        />
        <StatCard
          label="Students"
          value={studentsData?.total ?? '—'}
          icon={<GraduationCap size={18} />}
          color="blue"
        />
        <StatCard
          label="Assignments"
          value="—"
          icon={<ClipboardList size={18} />}
          color="purple"
        />
      </div>

      {activeYear && (
        <div className="card card-body mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Active Academic Year</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{activeYear.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(activeYear.startDate).toLocaleDateString()} — {new Date(activeYear.endDate).toLocaleDateString()}
          </p>
        </div>
      )}

      <div className="card card-body">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: 'Add Student', href: '/admin/students' },
            { label: 'Bulk Import Students', href: '/admin/students' },
            { label: 'Add Faculty', href: '/admin/faculty' },
            { label: 'Assign Faculty', href: '/admin/faculty-assignments' },
            { label: 'Enroll Students', href: '/admin/enrollments' },
            { label: 'Add Subject', href: '/admin/subjects' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="block px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg font-medium transition-colors"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}


