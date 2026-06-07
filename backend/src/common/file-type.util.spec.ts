import { BadRequestException } from '@nestjs/common';
import { assertBufferMatchesMime } from './file-type.util';

describe('file-type.util', () => {
  it('accepts a valid PNG signature', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => assertBufferMatchesMime(png, 'image/png')).not.toThrow();
  });

  it('rejects PNG declared MIME with wrong bytes', () => {
    expect(() => assertBufferMatchesMime(Buffer.from('not-a-png'), 'image/png')).toThrow(
      BadRequestException,
    );
  });

  it('rejects disallowed MIME types', () => {
    expect(() => assertBufferMatchesMime(Buffer.from('test'), 'application/x-msdownload')).toThrow(
      BadRequestException,
    );
  });
});
