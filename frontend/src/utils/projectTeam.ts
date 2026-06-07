import type { Project } from '../types';
import { differenceInDays, isPast, startOfDay } from 'date-fns';
import { getProjectLeadId } from './projectPermissions';

export interface ProjectDeadlineHighlight {
  pillClass: string;
  statusLabel: string | null;
}

/** PRD §08: green > 7 days, amber 2–7 days, red < 2 days or overdue. */
export function getProjectDeadlineHighlight(
  deadline: string,
  status: Project['status'],
): ProjectDeadlineHighlight {
  if (status === 'Completed') {
    return {
      pillClass:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
      statusLabel: 'Completed',
    };
  }

  const due = startOfDay(new Date(deadline));
  const today = startOfDay(new Date());
  const daysLeft = differenceInDays(due, today);
  const overdue = isPast(due);

  if (overdue) {
    return {
      pillClass:
        'bg-red-100 text-red-800 border-red-300 ring-1 ring-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 dark:ring-red-900/50',
      statusLabel: 'Overdue',
    };
  }
  if (daysLeft <= 2) {
    return {
      pillClass:
        'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60 dark:ring-red-900/30',
      statusLabel: daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days left`,
    };
  }
  if (daysLeft <= 7) {
    return {
      pillClass:
        'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 dark:ring-amber-900/30',
      statusLabel: `${daysLeft} days left`,
    };
  }
  return {
    pillClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 dark:ring-emerald-900/30',
    statusLabel: `${daysLeft} days left`,
  };
}

export function getProjectTeamBreakdown(project: Project) {
  const leadId = getProjectLeadId(project);
  const pmCount = leadId ? 1 : 0;
  const memberCount = (project.members ?? []).filter((m) => {
    const id = typeof m === 'object' ? m._id : String(m);
    return id !== leadId;
  }).length;
  return { pmCount, memberCount, totalPeople: pmCount + memberCount };
}

export function formatTeamLabel(project: Project): string {
  const { pmCount, memberCount } = getProjectTeamBreakdown(project);
  if (pmCount && memberCount) return `${pmCount} PM · ${memberCount} members`;
  if (pmCount) return `${pmCount} PM`;
  return `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
