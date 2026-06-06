import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, UserX } from 'lucide-react';
import type { User } from '../../types';
import { ASSIGNEE_ROLE_LABELS, ASSIGNEE_ROLE_STYLES } from '../../utils/taskAssignees';

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="w-7 h-7 text-xs rounded-full bg-brand-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

interface AssigneePickerProps {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AssigneePicker({
  users,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search by name or email…',
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = users.find((u) => u._id === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const pick = (userId: string) => {
    onChange(userId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="input w-full flex items-center gap-2 text-left disabled:opacity-60"
      >
        {selected ? (
          <>
            <UserAvatar name={selected.name} />
            <span className="flex-1 min-w-0 truncate text-sm text-slate-900 dark:text-white">
              {selected.name}
            </span>
            {selected.role !== 'admin' && (
              <span
                className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                  ASSIGNEE_ROLE_STYLES[selected.role as 'project_manager' | 'member']
                }`}
              >
                {ASSIGNEE_ROLE_LABELS[selected.role as 'project_manager' | 'member']}
              </span>
            )}
          </>
        ) : (
          <span className="flex-1 text-sm text-slate-400">Unassigned</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a1a2e] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                className="input pl-8 py-1.5 text-sm"
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => pick('')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  !value ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <UserX className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span>Unassigned</span>
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-xs text-slate-400 text-center">No matching users</li>
            ) : (
              filtered.map((u) => (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => pick(u._id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                      value === u._id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    }`}
                  >
                    <UserAvatar name={u.name} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="truncate text-slate-900 dark:text-white">{u.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{u.email}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                        ASSIGNEE_ROLE_STYLES[u.role as 'project_manager' | 'member']
                      }`}
                    >
                      {ASSIGNEE_ROLE_LABELS[u.role as 'project_manager' | 'member']}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
