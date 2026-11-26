import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  ShieldCheck, 
  Brain, 
  Trophy, 
  Activity, 
  CheckCircle,
  BarChart,
  Calendar,
  Lock
} from 'lucide-react';

const words = [
  "Reimagined.",
  "Redefined.",
  "Reinvented.",
  "Rebuilt.",
  "Reconnected.",
  "Revolutionized.",
  "Recrafted.",
  "Reenergized."
];

const LandingPage = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user) {
      const dashboardPath =
        user.firstLogin ? '/change-password' :
        user.role === 'IT_ADMIN' ? '/admin' :
        user.role === 'FACULTY' ? '/faculty' :
        user.role === 'PARENT' ? '/parent' :
        '/student';
      navigate(dashboardPath, { replace: true });
    }
  }, [token, user, navigate]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    
    const handler = (e: any) => setIsReducedMotion(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  useEffect(() => {
    if (isReducedMotion) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setWordIndex((current) => (current + 1) % words.length);
        setIsAnimating(false);
      }, 250);
    }, 2500);

    return () => clearInterval(interval);
  }, [isReducedMotion]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">AcademiaHub</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors hidden sm:block">Features</a>
              <a href="#roles" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors hidden sm:block">Solutions</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors hidden sm:block">Pricing</a>
              <Link 
                to="/login" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white pt-20 pb-24 border-b border-gray-200">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium text-sm mb-6 border border-indigo-100">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
            The next generation of campus management
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6 leading-tight">
            Education Management, <br />
            <span
              className={`inline-block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-300 transform ${
                isAnimating && !isReducedMotion
                  ? 'opacity-0 -translate-y-2 scale-95'
                  : 'opacity-100 translate-y-0 scale-100'
              }`}
            >
              {words[wordIndex]}
            </span>
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-10">
            AcademiaHub unifies academic administration, interactive learning, live attendance, and AI-powered insights into a single, highly secure SaaS platform. Say goodbye to fragmented systems and manual paperwork.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/login" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              Go to Dashboard
            </Link>
            <a 
              href="#features" 
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-8 py-3.5 rounded-xl text-lg font-medium transition-all shadow-sm flex items-center justify-center"
            >
              Explore Features
            </a>
          </div>
        </div>
      </section>

      {/* Core Features Overview */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to run your institution</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">A comprehensive suite of tools designed to reduce administrative overhead and increase student engagement.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Activity className="h-6 w-6 text-blue-600" />}
              title="Live Attendance & Quizzes"
              description="Real-time, cryptographically secure attendance codes. Conduct live interactive quizzes that automatically grade and sync to analytics."
              color="bg-blue-50"
            />
            <FeatureCard 
              icon={<Trophy className="h-6 w-6 text-yellow-600" />}
              title="Gamification & XP"
              description="Students earn XP, maintain streaks, and unlock badges for attending classes, submitting assignments, and passing quizzes."
              color="bg-yellow-50"
            />
            <FeatureCard 
              icon={<Brain className="h-6 w-6 text-purple-600" />}
              title="AI Learning Assistant"
              description="Built-in AI tutor that helps students understand concepts. Automatically locks down during active quizzes to ensure academic integrity."
              color="bg-purple-50"
            />
            <FeatureCard 
              icon={<BookOpen className="h-6 w-6 text-emerald-600" />}
              title="Smart Student Notes"
              description="Context-aware, rich-text markdown notes with autosave functionality. Students can link notes directly to specific classes and materials."
              color="bg-emerald-50"
            />
            <FeatureCard 
              icon={<BarChart className="h-6 w-6 text-pink-600" />}
              title="Advanced Analytics"
              description="Comprehensive dashboards for both students and faculty. Track performance metrics, attendance trends, and engagement levels."
              color="bg-pink-50"
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-6 w-6 text-indigo-600" />}
              title="Enterprise Security"
              description="Strict Role-Based Access Control (RBAC), forced initial password changes, IDOR protection, and encrypted JWT sessions."
              color="bg-indigo-50"
            />
          </div>
        </div>
      </section>

      {/* Role-Based Solutions */}
      <section id="roles" className="py-20 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Tailored experiences for every user</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">AcademiaHub provides specialized dashboards and tools for administrators, faculty, and students.</p>
          </div>

          <div className="space-y-16">
            {/* IT Admin */}
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2">
                <div className="bg-slate-100 p-8 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-slate-800 p-3 rounded-lg"><Lock className="h-6 w-6 text-white" /></div>
                    <h3 className="text-2xl font-bold text-slate-800">IT Administrator</h3>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-700">Provision structured academic hierarchies (Branches, Classes, Divisions)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-700">Manage faculty assignments and secure student onboarding</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-700">Design dynamic timetables with conflict resolution</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-slate-600 flex-shrink-0" />
                      <span className="text-slate-700">Monitor system-wide audit logs and broadcast university notices</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="lg:w-1/2">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Complete Control & Governance</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  The Admin portal is the command center. IT Administrators can seamlessly manage the entire institutional lifecycle, ensuring strict data boundaries and seamless operations without relying on manual spreadsheets.
                </p>
              </div>
            </div>

            {/* Faculty */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
              <div className="lg:w-1/2">
                <div className="bg-indigo-50 p-8 rounded-2xl border border-indigo-100 shadow-inner">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-indigo-600 p-3 rounded-lg"><Users className="h-6 w-6 text-white" /></div>
                    <h3 className="text-2xl font-bold text-indigo-900">Faculty Member</h3>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                      <span className="text-indigo-800">Initiate live sessions corresponding to timetable slots</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                      <span className="text-indigo-800">Generate time-sensitive cryptographic attendance codes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                      <span className="text-indigo-800">Deploy AI-generated quizzes and track real-time responses</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-indigo-600 flex-shrink-0" />
                      <span className="text-indigo-800">Upload course materials and grade assignment submissions</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="lg:w-1/2">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Empowering Educators</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  Faculty are freed from administrative burdens. Attendance takes seconds. Quizzes are generated and graded instantly. Analytics pinpoint which students are falling behind, allowing for proactive intervention.
                </p>
              </div>
            </div>

            {/* Student */}
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="lg:w-1/2">
                <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100 shadow-inner">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-emerald-600 p-3 rounded-lg"><GraduationCap className="h-6 w-6 text-white" /></div>
                    <h3 className="text-2xl font-bold text-emerald-900">Student</h3>
                  </div>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                      <span className="text-emerald-800">View upcoming timetable and active sessions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                      <span className="text-emerald-800">Submit START and END codes to log attendance reliably</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                      <span className="text-emerald-800">Earn XP, level up, and unlock achievements for participation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                      <span className="text-emerald-800">Query the context-aware AI tutor for personalized help</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="lg:w-1/2">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Engaging Learning Journey</h3>
                <p className="text-gray-600 text-lg leading-relaxed">
                  We transform the student experience from passive to active. Through gamification, students are motivated to attend, participate, and excel. The integrated AI tutor ensures no student is left confused.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing Section (Demo) */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Transparent Pricing for Institutions</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Choose the tier that best fits your campus size and technological needs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Tier 1 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Essential Campus</h3>
              <p className="text-gray-500 mb-6 min-h-[48px]">Perfect for smaller colleges upgrading from manual systems.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">$499</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Up to 1,000 Students</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Standard Timetable</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Basic Attendance</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Notice Board</span></li>
              </ul>
              <button className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl transition-colors">
                Contact Sales
              </button>
            </div>

            {/* Tier 2 */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-600 p-8 flex flex-col relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold tracking-wide">
                MOST POPULAR
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Advanced University</h3>
              <p className="text-gray-500 mb-6 min-h-[48px]">Full interactive suite including gamification and live quizzes.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">$1,299</span>
                <span className="text-gray-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Up to 5,000 Students</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Cryptographic Attendance</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Live Quizzes & Grading</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Gamification & Leaderboards</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Student Analytics</span></li>
              </ul>
              <button className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-md">
                Contact Sales
              </button>
            </div>

            {/* Tier 3 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise Scale</h3>
              <p className="text-gray-500 mb-6 min-h-[48px]">Maximum capability with AI integration and custom rules.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Unlimited Students</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">AI Learning Assistant</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">AI Quiz Generation</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">Dedicated Success Manager</span></li>
                <li className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-indigo-600" /><span className="text-gray-600">SSO & API Access</span></li>
              </ul>
              <button className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-indigo-400" />
              <span className="text-2xl font-bold text-white">AcademiaHub</span>
            </div>
            <div className="text-sm">
              &copy; {new Date().getFullYear()} AcademiaHub Solutions. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}>
      {icon}
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
