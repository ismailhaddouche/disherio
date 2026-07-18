import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSecretFiles } from '../config/secret-files';

describe('secret file loading', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalJwtSecretFile = process.env.JWT_SECRET_FILE;
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'disherio-secrets-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalJwtSecretFile === undefined) delete process.env.JWT_SECRET_FILE;
    else process.env.JWT_SECRET_FILE = originalJwtSecretFile;
  });

  it('loads a mounted secret and removes its trailing newline', () => {
    const secretPath = join(directory, 'jwt_secret');
    writeFileSync(secretPath, 'mounted-secret-value\n', { mode: 0o600 });
    process.env.JWT_SECRET_FILE = secretPath;

    loadSecretFiles();

    expect(process.env.JWT_SECRET).toBe('mounted-secret-value');
  });

  it('rejects an empty mounted secret', () => {
    const secretPath = join(directory, 'jwt_secret');
    writeFileSync(secretPath, '', { mode: 0o600 });
    process.env.JWT_SECRET_FILE = secretPath;

    expect(() => loadSecretFiles()).toThrow('JWT_SECRET_FILE points to an empty secret');
  });
});
