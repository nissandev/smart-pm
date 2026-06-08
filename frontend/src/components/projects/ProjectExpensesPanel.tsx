import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Edit2, DollarSign, Receipt, Search,
  TrendingUp, Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { expensesApi, type ExpenseInput } from '../../services';
import { ConfirmModal, EmptyState, Spinner } from '../shared';
import type { ExpenseCategory, ProjectExpense, User } from '../../types';
import { formatCurrency } from '../../utils/projectTeam';

const CATEGORIES: ExpenseCategory[] = ['Hosting', 'AI / API', 'Tools', 'Domain', 'Other'];

const CATEGORY_STYLES: Record<ExpenseCategory, string> = {
  Hosting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'AI / API': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Tools: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Domain: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export function ProjectExpensesPanel({
  projectId,
  canManage,
  embedded = false,
}: {
  projectId: string;
  canManage: boolean;
  embedded?: boolean;
}) {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProjectExpense | null>(null);
  const [deleting, setDeleting] = useState<ProjectExpense | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', projectId],
    queryFn: ({ signal }) => expensesApi.getAll(projectId, signal),
  });

  const { data: summary } = useQuery({
    queryKey: ['expenses-summary', projectId],
    queryFn: ({ signal }) => expensesApi.getSummary(projectId, signal),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['expenses', projectId] });
    qc.invalidateQueries({ queryKey: ['expenses-summary', projectId] });
    qc.invalidateQueries({ queryKey: ['expense-totals'] });
    qc.invalidateQueries({ queryKey: ['activity'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: ExpenseInput) => expensesApi.create(projectId, data),
    onSuccess: () => {
      toast.success('Expense added');
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add expense'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseInput> }) =>
      expensesApi.update(projectId, id, data),
    onSuccess: () => {
      toast.success('Expense updated');
      setEditing(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(projectId, id),
    onSuccess: () => {
      toast.success('Expense deleted');
      setDeleting(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete expense'),
  });

  const currency = summary?.currency ?? 'USD';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [expenses, categoryFilter, search]);

  return (
    <div className={embedded ? 'space-y-4' : 'card p-5 mb-4'}>

      {/* Panel header */}
      <div className="flex items-center justify-between gap-3">
        {!embedded ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Project Expenses</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
                Track API, AI, hosting, and other project costs
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Expenses</h2>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Track hosting, API, AI, and other project costs
            </p>
          </div>
        )}
        {canManage && (
          <button
            type="button"
            className="btn-primary text-xs py-1.5 flex-shrink-0"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Add expense</span>
            <span className="xs:hidden">Add</span>
          </button>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total spent */}
        <div className="card p-3 sm:p-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center mb-2 sm:mb-3">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-heading text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-none mb-1 truncate">
            {formatCurrency(summary?.total ?? 0, currency)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
            Total spent
          </p>
        </div>

        {/* Per-category breakdown */}
        {(summary?.byCategory ?? []).slice(0, 3).map((row, i) => {
          const palettes = [
            { icon: 'text-brand-600 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-500/15', grad: 'from-brand-500/10' },
            { icon: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/15', grad: 'from-amber-500/10' },
            { icon: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/15', grad: 'from-purple-500/10' },
          ];
          const p = palettes[i % palettes.length];
          return (
            <div key={row.category} className="card p-3 sm:p-4 relative overflow-hidden">
              <div className={`absolute inset-x-0 top-0 h-14 bg-gradient-to-b ${p.grad} to-transparent pointer-events-none`} />
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${p.bg} flex items-center justify-center mb-2 sm:mb-3`}>
                <Layers className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${p.icon}`} />
              </div>
              <p className="font-heading text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-none mb-1 truncate">
                {formatCurrency(row.total, currency)}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide truncate">
                {row.category}
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            className="input pl-8 py-2 text-xs w-full"
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input py-2 text-xs sm:w-[160px]"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Log hosting, API, AI, and tool costs for this project"
          action={
            canManage ? (
              <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                Add first expense
              </button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-slate-400">No expenses match your filters</p>
      ) : (
        <>
          {/* Mobile card list — visible below sm */}
          <div className="sm:hidden space-y-2">
            {filtered.map((expense) => (
              <div
                key={expense._id}
                className="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {expense.description}
                    </p>
                    {expense.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{expense.notes}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap flex-shrink-0 pl-2">
                    {formatCurrency(expense.amount, expense.currency)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${CATEGORY_STYLES[expense.category]}`}>
                      {expense.category}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">
                      {format(new Date(expense.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                        onClick={() => setEditing(expense)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        onClick={() => setDeleting(expense)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1 px-1">
              <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
              {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== expenses.length && ` (of ${expenses.length})`}
              · Total {formatCurrency(summary?.total ?? 0, currency)}
            </div>
          </div>

          {/* Desktop table — visible from sm up */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.07]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.03] text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.06]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Added by</th>
                  {canManage && <th className="px-4 py-3 w-20" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {filtered.map((expense) => (
                  <tr
                    key={expense._id}
                    className="bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.025] transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {format(new Date(expense.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_STYLES[expense.category]}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{expense.description}</p>
                      {expense.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{expense.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(expense.amount, expense.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                      {(expense.createdBy as User)?.name ?? '—'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                            onClick={() => setEditing(expense)}
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            onClick={() => setDeleting(expense)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/[0.02] text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-white/[0.06] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== expenses.length && ` (of ${expenses.length})`}
              · Total {formatCurrency(summary?.total ?? 0, currency)}
            </div>
          </div>
        </>
      )}

      {(showForm || editing) && (
        <ExpenseFormModal
          expense={editing}
          loading={createMutation.isPending || updateMutation.isPending}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSubmit={(data) => {
            if (editing) updateMutation.mutate({ id: editing._id, data });
            else createMutation.mutate(data);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete expense"
          description={`Remove "${deleting.description}" (${formatCurrency(deleting.amount, deleting.currency)})?`}
          onConfirm={() => deleteMutation.mutate(deleting._id)}
          onCancel={() => setDeleting(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function ExpenseFormModal({
  expense,
  onClose,
  onSubmit,
  loading,
}: {
  expense: ProjectExpense | null;
  onClose: () => void;
  onSubmit: (data: ExpenseInput) => void;
  loading: boolean;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'Hosting');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [date, setDate] = useState(
    expense?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(expense?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0.01) {
      toast.error('Enter a valid amount (min 0.01)');
      return;
    }
    onSubmit({
      category,
      description: description.trim(),
      amount: parsed,
      date,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="card w-full sm:max-w-md p-5 sm:p-6 rounded-t-2xl sm:rounded-2xl">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          {expense ? 'Edit expense' : 'Add expense'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. OpenAI API credits"
              maxLength={200}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (USD)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="49.99"
                required
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input min-h-[68px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice #, billing period…"
              maxLength={500}
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {expense ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
