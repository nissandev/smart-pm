import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services';
import { useAuthStore } from '../store/authStore';
import AuthHeroPanel, { AuthMobileHeroStrip } from '../components/auth/AuthHeroPanel';

const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO !== 'false';

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@smartpm.dev', password: 'admin123', color: 'bg-purple-500', ring: 'ring-purple-500/30' },
  { label: 'Project Manager', email: 'pm@smartpm.dev', password: 'pm123456', color: 'bg-blue-500', ring: 'ring-blue-500/30' },
  { label: 'Member', email: 'john@smartpm.dev', password: 'member123', color: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
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
    setAuth(data.user, data.accessToken);
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
    <div className="min-h-screen flex bg-slate-100 dark:bg-[#0a0a12]">
      <AuthHeroPanel variant="login" />

      <div className="flex-1 flex flex-col min-h-screen">
        <AuthMobileHeroStrip />

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[420px]">
            <div className="card p-8 sm:p-9 shadow-xl shadow-slate-200/50 dark:shadow-black/30 border-slate-200/80 dark:border-slate-700/50">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Welcome back
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                  Sign in to manage projects and tasks
                </p>
              </div>

              {SHOW_DEMO && (
                <div className="mb-6">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-widest">
                    One-click demo
                  </p>
                  <div className="grid gap-2">
                    {DEMO_USERS.map((demo) => (
                      <button
                        key={demo.label}
                        type="button"
                        disabled={!!demoLoading || loading}
                        onClick={() => handleDemoLogin(demo)}
                        className={`group flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:border-brand-300 dark:hover:border-brand-600 hover:bg-brand-50/80 dark:hover:bg-brand-950/40 transition-all text-left disabled:opacity-50 ring-0 hover:ring-2 ${demo.ring}`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${demo.color} flex-shrink-0 shadow-sm`} />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">
                          {demoLoading === demo.label ? `Signing in…` : demo.label}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-[#16162b] px-3 text-xs text-slate-400">
                    or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input bg-white dark:bg-slate-900/50"
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
                      className="input pr-10 bg-white dark:bg-slate-900/50"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full py-3 mt-1 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-brand-600/25"
                  disabled={loading || !!demoLoading}
                >
                  {loading && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  )}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                  Create account
                </Link>
              </p>
            </div>

            <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-6">
              SmartPM · Project tracking · Task boards · Team analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
