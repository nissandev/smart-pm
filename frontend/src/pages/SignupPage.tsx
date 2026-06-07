import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../services';
import { useAuthStore } from '../store/authStore';
import AuthHeroPanel, { AuthMobileHeroStrip } from '../components/auth/AuthHeroPanel';

export default function SignupPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.register({
        name: name.trim(),
        email,
        password,
      });
      setAuth(data.user, data.token);
      toast.success(`Welcome, ${data.user.name}!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-[#0a0a12]">
      <AuthHeroPanel variant="signup" />

      <div className="flex-1 flex flex-col min-h-screen">
        <AuthMobileHeroStrip subtitle="Create your team member account" />

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[420px]">
            <div className="card p-8 sm:p-9 shadow-xl shadow-slate-200/50 dark:shadow-black/30 border-slate-200/80 dark:border-slate-700/50">
              <div className="mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mb-4">
                  <UserPlus className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Create account
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5">
                  Join as a team member — collaborate on projects and tasks
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="label">Full name</label>
                  <input
                    className="input bg-white dark:bg-slate-900/50"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
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
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
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
                <div>
                  <label className="label">Confirm password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input bg-white dark:bg-slate-900/50"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                  New accounts are created as <span className="font-medium text-slate-500 dark:text-slate-400">Team Members</span>.
                  Admins can upgrade roles from Manage Users.
                </p>

                <button
                  type="submit"
                  className="btn-primary w-full py-3 mt-1 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-brand-600/25"
                  disabled={loading}
                >
                  {loading && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  )}
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                  Sign in
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
