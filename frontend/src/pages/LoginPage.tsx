import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services';
import { useAuthStore } from '../store/authStore';

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@smartpm.dev', password: 'admin123', color: 'bg-purple-500' },
  { label: 'Project Manager', email: 'pm@smartpm.dev', password: 'pm123456', color: 'bg-blue-500' },
  { label: 'Member', email: 'john@smartpm.dev', password: 'member123', color: 'bg-emerald-500' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    const { data } = await authApi.login(loginEmail, loginPassword);
    setAuth(data.user, data.token);
    toast.success(`Welcome back, ${data.user.name}!`);
    navigate('/');
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await performLogin(email, password);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demo: typeof DEMO_USERS[0]) => {
    setDemoLoading(demo.label);
    setEmail(demo.email);
    setPassword(demo.password);
    try {
      await performLogin(demo.email, demo.password);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Demo login failed — run seed first');
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0f0f17]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SmartPM</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Your projects,<br />perfectly organized.
          </h2>
          <p className="text-brand-200 text-lg">
            Collaborate, track tasks, and ship faster with your team.
          </p>
        </div>
        <div className="flex gap-4">
          {['24 Projects', '148 Tasks', '4 Team Members'].map((s) => (
            <div key={s} className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-white font-semibold text-sm">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">SmartPM</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sign in</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
            Welcome back — sign in to your workspace
          </p>

          {/* One-click demo login */}
          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              Demo login — one click
            </p>
            <div className="flex flex-col gap-2">
              {DEMO_USERS.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  disabled={!!demoLoading || loading}
                  onClick={() => handleDemoLogin(demo)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-brand-950/30 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-left disabled:opacity-50"
                >
                  <span className={`w-2 h-2 rounded-full ${demo.color} flex-shrink-0`} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {demoLoading === demo.label ? `Signing in as ${demo.label}…` : `Demo ${demo.label}`}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">{demo.email}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-400 bg-slate-50 dark:bg-[#0f0f17] px-3">
              or sign in manually
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              disabled={loading || !!demoLoading}
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
