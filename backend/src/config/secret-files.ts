import { readFileSync } from 'node:fs';

const SECRET_NAMES = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'REDIS_PASSWORD',
  'ADMIN_PASSWORD',
] as const;

export function loadSecretFiles(): void {
  for (const name of SECRET_NAMES) {
    const filePath = process.env[`${name}_FILE`];
    if (!filePath) continue;

    const value = readFileSync(filePath, 'utf8').replace(/[\r\n]+$/, '');
    if (!value) throw new Error(`${name}_FILE points to an empty secret`);
    process.env[name] = value;
  }
}
