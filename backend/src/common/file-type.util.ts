import { BadRequestException } from '@nestjs/common';

type MimeMatcher = { mime: string; matches: (buf: Buffer) => boolean };

const ZIP_SIGNATURE = (buf: Buffer) => buf[0] === 0x50 && buf[1] === 0x4b;

const MATCHERS: MimeMatcher[] = [
  {
    mime: 'image/png',
    matches: (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: 'image/jpeg',
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/gif',
    matches: (b) => b.length >= 3 && b.slice(0, 3).toString('ascii') === 'GIF',
  },
  {
    mime: 'image/webp',
    matches: (b) =>
      b.length >= 12 &&
      b.slice(0, 4).toString('ascii') === 'RIFF' &&
      b.slice(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'application/pdf',
    matches: (b) => b.length >= 5 && b.slice(0, 5).toString('ascii') === '%PDF-',
  },
  {
    mime: 'application/msword',
    matches: (b) => b.length >= 8 && b.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    matches: ZIP_SIGNATURE,
  },
  {
    mime: 'application/vnd.ms-excel',
    matches: (b) => b.length >= 8 && b.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    matches: ZIP_SIGNATURE,
  },
  {
    mime: 'text/plain',
    matches: (b) => !b.includes(0),
  },
  {
    mime: 'text/csv',
    matches: (b) => !b.includes(0),
  },
];

const ALLOWED_MIMES = new Set(MATCHERS.map((m) => m.mime));

/** Verify buffer content matches the declared MIME (magic-byte check). */
export function assertBufferMatchesMime(buffer: Buffer, declaredMime: string): void {
  if (!ALLOWED_MIMES.has(declaredMime)) {
    throw new BadRequestException('File type not allowed');
  }

  const matcher = MATCHERS.find((m) => m.mime === declaredMime);
  if (!matcher || !matcher.matches(buffer)) {
    throw new BadRequestException('File content does not match its declared type');
  }
}
