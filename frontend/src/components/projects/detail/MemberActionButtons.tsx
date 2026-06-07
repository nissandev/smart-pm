import { Plus, RefreshCw } from 'lucide-react';

type MemberActionButtonsProps = {
  syncAvailable: boolean;
  syncPendingCount: number;
  onSync: () => void;
  onAdd: () => void;
};

export function MemberActionButtons({
  syncAvailable,
  syncPendingCount,
  onSync,
  onAdd,
}: MemberActionButtonsProps) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        type="button"
        onClick={onSync}
        title={
          syncAvailable
            ? `${syncPendingCount} difference${syncPendingCount !== 1 ? 's' : ''} between project and team group — click to sync`
            : 'Project matches the team group'
        }
        className={`relative text-xs py-1.5 px-3 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors ${
          syncAvailable
            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm ring-2 ring-amber-200/80 dark:ring-amber-800/60'
            : 'bg-brand-100 hover:bg-brand-200 dark:bg-brand-950/50 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300'
        }`}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncAvailable ? 'animate-pulse' : ''}`} />
        Sync
        {syncAvailable && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white text-amber-600 text-[10px] font-bold flex items-center justify-center leading-none">
            {syncPendingCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="text-xs py-1.5 px-3 rounded-lg font-medium inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  );
}
