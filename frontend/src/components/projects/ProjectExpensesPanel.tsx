import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Edit2, DollarSign, Receipt, Search,
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
}: {
  projectId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProjectExpense | null>(null);
  const [deleting, setDeleting] = useState<ProjectExpense | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', projectId],
    queryFn: () => expensesApi.getAll(projectId),
  });

  const { data: summary } = useQuery({
    queryKey: ['expenses-summary', projectId],
    queryFn: () => expensesApi.getSummary(projectId),
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
    <div className="card p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Project expenses</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Track API, AI, hosting, and other project costs
            </p>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-primary text-xs py-1.5 inline-flex items-center gap-1"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Add expense
          </button>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Total spent</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(summary?.total ?? 0, currency)}
          </p>
        </div>
        {(summary?.byCategory ?? []).slice(0, 3).map((row) => (
          <div
            key={row.category}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 truncate">
              {row.category}
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(row.total, currency)}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            className="input pl-8 py-1.5 text-xs"
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input py-1.5 text-xs w-auto min-w-[130px]"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

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
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Added by</th>
                {canManage && <th className="px-4 py-2.5 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((expense) => (
                <tr key={expense._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {format(new Date(expense.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_STYLES[expense.category]}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{expense.description}</p>
                    {expense.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{expense.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(expense.amount, expense.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                    {(expense.createdBy as User)?.name ?? '—'}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-brand-500 rounded-lg"
                          onClick={() => setEditing(expense)}
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
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
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== expenses.length && ` (of ${expenses.length})`}
            · Total {formatCurrency(summary?.total ?? 0, currency)}
          </div>
        </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {expense ? 'Edit expense' : 'Add expense'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="input min-h-[72px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice #, billing period…"
              maxLength={500}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {expense ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
