import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const git = args => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
test('Secret and generated paths are ignored while source/templates remain publishable', () => {
  for (const path of ['.env', 'apps/api/.env.admin', 'apps/api/.env.production', 'deploy/api.env', 'deploy/release.env',
    'deploy/secrets/resend_api_key', 'private/id_ed25519', 'tls/server.pfx', 'tls/server.crt', 'backup/data.sql',
    'data.dump.age', 'data.sql.gz', 'data.sqlite3', 'node_modules/test/index.js', 'apps/web/dist/index.html',
    'tmp/report.json', '.local-mail/invitation.json', '.npmrc', 'database.sql', 'cloudflare.token', 'backup.tar.gz']) {
    assert.equal(git(['check-ignore', '--no-index', '-q', path]).status, 0, path);
  }
  for (const path of ['apps/api/.env.example', 'deploy/.env.example', 'deploy/api.env.example',
    'apps/api/src/core/secrets.js', 'apps/api/migrations/003_email_outbox.sql']) {
    assert.equal(git(['check-ignore', '--no-index', '-q', path]).status, 1, path);
  }
});
test('No tracked file is hidden by ignore rules', () => {
  const tracked = git(['ls-files', '-z']);
  assert.equal(tracked.status, 0);
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '--no-index', '--stdin', '-z'], {
    input: tracked.stdout, encoding: 'utf8',
  });
  assert.equal(ignored.status, 1, `Tracked ignored paths must be reviewed: ${ignored.stdout.replaceAll('\0', ', ')}`);
});
