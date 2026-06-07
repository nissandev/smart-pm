import { CheckSquare, Plus, Receipt } from 'lucide-react';
import { formatCurrency } from '@/utils/projectTeam';

export type ProjectDetailTab = 'tasks' | 'expenses';

type ProjectDetailTabsProps = {
  activeTab: ProjectDetailTab;
  taskCount: number;
  expenseTotal: number;
  expenseCurrency: string;
  canManage: boolean;
  onTabChange: (tab: ProjectDetailTab) => void;
  onAddTask: () => void;
};

export function ProjectDetailTabs({
  activeTab,
  taskCount,
  expenseTotal,
  expenseCurrency,
  canManage,
  onTabChange,
  onAddTask,
}: ProjectDetailTabsProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5 border-b border-slate-200 dark:border-slate-700 flex-wrap">
      <div className="flex gap-1">
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'tasks'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => onTabChange('tasks')}
        >
          <CheckSquare className="w-4 h-4" />
          Tasks
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {taskCount}
          </span>
        </button>
        <button
          type="button"
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'expenses'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => onTabChange('expenses')}
        >
          <Receipt className="w-4 h-4" />
          Expenses
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
            {formatCurrency(expenseTotal, expenseCurrency)}
          </span>
        </button>
      </div>
      {activeTab === 'tasks' && canManage && (
        <button
          type="button"
          className="btn-primary text-xs py-1.5 flex items-center gap-1 mb-1"
          onClick={onAddTask}
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      )}
    </div>
  );
}
