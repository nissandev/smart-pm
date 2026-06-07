import { existsSync, unlinkSync } from 'fs';
import { resolveSecureUploadPath } from './upload-path.util';

/** Remove a local upload file referenced by `/uploads/...` URL. Best-effort. */
export function deleteUploadByUrl(url: string | undefined): void {
  const absolute = resolveSecureUploadPath(url);
  if (!absolute) return;
  try {
    if (existsSync(absolute)) unlinkSync(absolute);
  } catch {
    // Non-fatal — DB record is source of truth
  }
}

export function collectAttachmentUrls(
  attachments: Array<{ url?: string }> | undefined,
): string[] {
  if (!attachments?.length) return [];
  return attachments.map((a) => a.url).filter((u): u is string => !!u);
}
