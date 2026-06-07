import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export function CopyProjectIdButton({
  projectId,
  size = 'sm',
  className = '',
}: {
  projectId: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(projectId);
      setCopied(true);
      toast.success('Project ID copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy project ID');
    }
  };

  const iconClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const padClass = size === 'sm' ? 'p-1.5' : 'p-2';

  return (
    <button
      type="button"
      className={`${padClass} text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors ${className}`}
      onClick={handleCopy}
      title="Copy project ID for CSV import"
    >
      {copied ? (
        <Check className={`${iconClass} text-emerald-500`} />
      ) : (
        <Copy className={iconClass} />
      )}
    </button>
  );
}
