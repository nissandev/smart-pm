import { resolveSecureUploadPath, getUploadsRoot } from './upload-path.util';
import { join } from 'path';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';

describe('upload-path.util', () => {
  const tasksDir = join(getUploadsRoot(), 'tasks');
  const testFile = 'security-test.bin';

  beforeAll(() => {
    mkdirSync(tasksDir, { recursive: true });
    writeFileSync(join(tasksDir, testFile), 'ok');
  });

  afterAll(() => {
    const p = join(tasksDir, testFile);
    if (existsSync(p)) unlinkSync(p);
  });

  it('resolves valid upload URLs under uploads root', () => {
    const resolved = resolveSecureUploadPath(`/uploads/tasks/${testFile}`);
    expect(resolved).toContain('uploads');
    expect(resolved).toContain(testFile);
  });

  it('rejects path traversal', () => {
    expect(resolveSecureUploadPath('/uploads/../package.json')).toBeNull();
    expect(resolveSecureUploadPath('/uploads/tasks/../../package.json')).toBeNull();
  });

  it('rejects non-upload URLs', () => {
    expect(resolveSecureUploadPath('/etc/passwd')).toBeNull();
  });
});
