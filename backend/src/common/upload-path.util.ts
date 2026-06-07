import { existsSync } from 'fs';
import { resolve } from 'path';

const UPLOADS_ROOT = resolve(process.cwd(), 'uploads');

/** Resolve `/uploads/...` to an absolute path confined under the uploads directory. */
export function resolveSecureUploadPath(url: string | undefined): string | null {
  if (!url || !url.startsWith('/uploads/')) return null;

  const relative = url.replace(/^\/uploads\/?/, '');
  if (!relative || relative.includes('..')) return null;

  const absolute = resolve(UPLOADS_ROOT, relative);
  if (!absolute.startsWith(UPLOADS_ROOT)) return null;
  if (!existsSync(absolute)) return null;

  return absolute;
}

export function getUploadsRoot(): string {
  return UPLOADS_ROOT;
}
