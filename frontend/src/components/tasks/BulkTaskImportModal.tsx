import { useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksApi } from '../../services';
import { Spinner } from '../shared';

export interface BulkImportResult {
  created: number;
  failed: number;
  results: { row: number; title: string; success: boolean; error?: string }[];
}

export function BulkTaskImportModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const blob = await tasksApi.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smartpm-task-import-template.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    } finally {
      setDownloading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Choose a CSV file first');
      return;
    }
    setLoading(true);
    try {
      const { data } = await tasksApi.bulkImport(file);
      setResult(data);
      if (data.created > 0) {
        onSuccess();
        toast.success(`Imported ${data.created} task${data.created !== 1 ? 's' : ''}`);
      }
      if (data.failed > 0 && data.created === 0) {
        toast.error('No tasks were imported — check errors below');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bulk import tasks</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload a CSV — max 200 rows per file
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 mb-5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Step 1 — Download the template
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            Columns: <code className="text-brand-600 dark:text-brand-400">project</code> (project ID — copy from Projects page),{' '}
            <code className="text-brand-600 dark:text-brand-400">title</code>,{' '}
            <code className="text-brand-600 dark:text-brand-400">description</code>,{' '}
            <code className="text-brand-600 dark:text-brand-400">assignedToEmail</code>,{' '}
            <code className="text-brand-600 dark:text-brand-400">dueDate</code>,{' '}
            <code className="text-brand-600 dark:text-brand-400">priority</code>,{' '}
            <code className="text-brand-600 dark:text-brand-400">status</code>
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={downloading}
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            {downloading ? <Spinner size="sm" /> : <Download className="w-4 h-4" />}
            Download example CSV
          </button>
        </div>

        <div className="mb-5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
            Step 2 — Upload your file
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl py-8 px-4 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-950/20 transition-colors"
          >
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {file ? file.name : 'Click to choose CSV file'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Use the same structure as the template</p>
          </button>
        </div>

        {result && (
          <div className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 text-sm font-medium text-slate-700 dark:text-slate-300">
              {result.created} imported · {result.failed} failed
            </div>
            <ul className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {result.results.map((r) => (
                <li key={r.row} className="px-4 py-2 flex items-start gap-2 text-xs">
                  {r.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-slate-600 dark:text-slate-400">
                    Row {r.row}: <span className="font-medium text-slate-800 dark:text-slate-200">{r.title}</span>
                    {!r.success && r.error && (
                      <span className="text-red-500 dark:text-red-400"> — {r.error}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={handleImport}
              disabled={loading || !file}
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Importing…' : 'Import tasks'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
