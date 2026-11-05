import { readFile } from 'node:fs/promises';
try {
  if (process.argv.includes('--worker')) {
    const heartbeat = Number(await readFile('/tmp/ems-mail-heartbeat', 'utf8'));
    if (!heartbeat || Date.now() - heartbeat > 90000) throw new Error();
  } else {
    const response = await fetch('http://127.0.0.1:3000/api/v1/health/ready', {
      headers: { 'X-Readiness-Key': process.env.READINESS_SECRET }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error();
  }
} catch { process.exitCode = 1; }
