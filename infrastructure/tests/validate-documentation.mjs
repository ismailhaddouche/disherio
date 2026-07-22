import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const markdownFiles = [
  ...fs.readdirSync(root)
    .filter((name) => /^(README(?:_[a-z]+)?|HTTPS-SETUP)\.md$/i.test(name))
    .map((name) => path.join(root, name)),
  ...walk(path.join(root, 'docs')).filter((file) => file.endsWith('.md')),
];

for (const file of markdownFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim().split(/\s+['"]/)[0];
    if (!target || target.startsWith('#') || /^[a-z][a-z\d+.-]*:/i.test(target)) continue;
    target = target.replace(/^<|>$/g, '').split('#')[0];
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    if (!fs.existsSync(resolved)) {
      failures.push(`${path.relative(root, file)}: broken local link ${match[1]}`);
    }
  }
}

const staleClaims = [
  [/SameSite=Strict|sameSite:\s*strict/i, 'cookies are SameSite=Lax'],
  [/X-Frame-Options[^\n|]*SAMEORIGIN/i, 'production framing policy is DENY'],
  [/grep\s+(?:MONGO_ROOT_PASS|CF_TUNNEL_TOKEN)\s+\.env/i, 'secrets are not read from .env'],
  [/mongosh\s+-u\s+admin\s+-p\b/i, 'MongoDB passwords must not be placed in argv'],
  [/Socket\.IO can fall back to its in-memory adapter/i, 'production security state fails closed'],
  [/Sharp\s+0\.34|TypeScript\s+5\.4/i, 'documented dependency version is stale'],
];

for (const file of markdownFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const [pattern, reason] of staleClaims) {
    if (pattern.test(source)) {
      failures.push(`${path.relative(root, file)}: stale claim (${reason})`);
    }
  }
}

const sensitiveExampleKeys = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI',
  'MONGO_ROOT_PASS',
  'MONGO_APP_PASS',
  'REDIS_PASSWORD',
  'ADMIN_PASSWORD',
  'CF_TUNNEL_TOKEN',
  'NGROK_AUTHTOKEN',
];
const exampleEnv = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const key of sensitiveExampleKeys) {
  const match = exampleEnv.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match || match[1].trim() !== '') {
    failures.push(`.env.example: ${key} must exist with an empty example value`);
  }
}

const routeMounts = new Map([
  ['auth.routes.ts', '/api/auth'],
  ['dish.routes.ts', '/api/dishes'],
  ['order.routes.ts', '/api/orders'],
  ['totem.routes.ts', '/api/totems'],
  ['image.routes.ts', '/api/uploads'],
  ['restaurant.routes.ts', '/api/restaurant'],
  ['dashboard.routes.ts', '/api/dashboard'],
  ['staff.routes.ts', '/api/staff'],
  ['customer.routes.ts', '/api/customers'],
  ['health.routes.ts', '/health'],
  ['metrics.routes.ts', '/metrics'],
]);
const apiReference = fs.readFileSync(path.join(root, 'docs/api-contracts.md'), 'utf8');
for (const [filename, mount] of routeMounts) {
  const source = fs.readFileSync(path.join(root, 'backend/src/routes', filename), 'utf8');
  for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
    const method = match[1].toUpperCase();
    const suffix = match[2] === '/' ? '' : match[2];
    const route = `${mount}${suffix}`;
    const documentedRoute = route.startsWith('/api/') ? route.slice(4) : route;
    const escapedRoute = documentedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const documentedContract = new RegExp(
      `(?:^|[^A-Z])(?:[A-Z]+\\|)*${method}(?:\\|[A-Z]+)*\\s+${escapedRoute}(?=[\\s\x60,|]|$)`,
      'm',
    );
    if (!documentedContract.test(apiReference)) {
      failures.push(`docs/api-contracts.md: missing executable contract ${method} ${route}`);
    }
  }
}

const installScript = fs.readFileSync(path.join(root, 'scripts/install.sh'), 'utf8');
if (/grep\s+-E\s+["']\^\(Usuario\|Contraseña\)/.test(installScript)) {
  failures.push('scripts/install.sh: status must not print credential-file password lines');
}
const configureScript = fs.readFileSync(path.join(root, 'scripts/configure.sh'), 'utf8');
if (/Contraseña generada:\s*\$new_pass|Nueva contraseña:\s*\$\{?new_pass/.test(configureScript)) {
  failures.push('scripts/configure.sh: generated/reset passwords must not be logged or printed');
}

const productionTypeScript = [
  ...walk(path.join(root, 'backend/src')).filter((file) => file.endsWith('.ts') && !file.includes(`${path.sep}__tests__${path.sep}`)),
  ...walk(path.join(root, 'shared')).filter((file) => file.endsWith('.ts')),
  ...walk(path.join(root, 'frontend/src')).filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts')),
];
for (const file of productionTypeScript) {
  if (/eslint-disable[^\n]*no-explicit-any/.test(fs.readFileSync(file, 'utf8'))) {
    failures.push(`${path.relative(root, file)}: production no-explicit-any suppression is forbidden`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

console.log(`Documentation checks passed (${markdownFiles.length} Markdown files)`);
