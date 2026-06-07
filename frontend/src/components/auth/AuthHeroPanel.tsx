import {
  Zap, LayoutGrid, BarChart3, Users, CheckSquare, Sparkles,
} from 'lucide-react';

const FEATURES = [
  { icon: LayoutGrid, label: 'Kanban boards', desc: 'Drag tasks across Todo → Done' },
  { icon: BarChart3, label: 'Live dashboards', desc: 'KPIs, charts & overdue alerts' },
  { icon: Users, label: 'Team workspaces', desc: 'Groups, members & workload views' },
  { icon: CheckSquare, label: 'Smart tasks', desc: 'Priority, deadlines & assignments' },
];

const COPY = {
  login: {
    badge: 'Built for Admin · PM · Team workflows',
    title: 'Ship projects faster with clarity.',
    subtitle:
      'Plan work, track progress on Kanban boards, and keep your team aligned — all in one workspace.',
  },
  signup: {
    badge: 'Free team member account',
    title: 'Join your team workspace.',
    subtitle:
      'Sign up to collaborate on projects, update tasks on Kanban boards, and stay on top of deadlines.',
  },
};

export default function AuthHeroPanel({ variant = 'login' }: { variant?: 'login' | 'signup' }) {
  const copy = COPY[variant];

  return (
    <div className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col overflow-hidden">
      <img
        src="/login-hero.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center scale-105"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f17]/90 via-brand-900/75 to-brand-700/60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(129,140,248,0.25),_transparent_55%)]" />

      <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-lg shadow-black/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white tracking-tight">SmartPM</span>
            <p className="text-xs text-brand-200/80 font-medium">Project & Task Collaboration</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-brand-100 text-xs font-medium w-fit mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            {copy.badge}
          </div>

          <h2 className="text-4xl xl:text-[2.75rem] font-bold text-white leading-[1.15] tracking-tight mb-5">
            {copy.title}
          </h2>
          <p className="text-lg text-brand-100/90 leading-relaxed mb-10">{copy.subtitle}</p>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center group-hover:bg-white/15 transition-colors">
                  <Icon className="w-5 h-5 text-brand-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-sm text-brand-200/70">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'Kanban', sub: 'Task boards' },
            { value: 'RBAC', sub: 'Role-based access' },
            { value: 'Live', sub: 'Dashboard KPIs' },
          ].map((s) => (
            <div
              key={s.value}
              className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 px-4 py-3.5 shadow-lg shadow-black/10"
            >
              <p className="text-white font-bold text-sm">{s.value}</p>
              <p className="text-brand-200/70 text-xs mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthMobileHeroStrip({ subtitle }: { subtitle?: string }) {
  return (
    <div className="lg:hidden relative h-44 overflow-hidden">
      <img src="/login-hero.png" alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900/95 to-brand-700/80" />
      <div className="relative z-10 h-full flex flex-col justify-end p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">SmartPM</span>
        </div>
        <p className="text-sm text-brand-100/90">
          {subtitle ?? 'Kanban · Dashboard · Team collaboration'}
        </p>
      </div>
    </div>
  );
}
