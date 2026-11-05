import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const inventory = spawnSync('git', ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
if (inventory.status !== 0) throw new Error('Cannot inventory Git-visible files');
const target = await mkdtemp(join(tmpdir(), 'ems-secret-scan-'));
for (const name of new Set(inventory.stdout.split('\0').filter(Boolean))) {
  const source = resolve(root, name);
  if (relative(root, source).startsWith('..')) throw new Error('Unexpected path');
  try {
    const entry = await lstat(source);
    if (!entry.isFile()) continue;
    const destination = join(target, name);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
// Ignored .env/private mail/backups never enter this snapshot. Output is redacted.
const scan = spawnSync('docker', ['run', '--rm', '--mount', `type=bind,source=${target},target=/scan,readonly`,
  'zricethezav/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
  'dir', '/scan', '--redact', '--no-banner'], { stdio: 'inherit', timeout: 120000 });
process.exitCode = scan.status ?? 1;
