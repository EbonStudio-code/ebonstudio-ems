import { createHash } from 'node:crypto';

// Git may check SQL out with CRLF on Windows and LF on Linux. Accept only these
// equivalent encodings; never ignore SQL content changes or rewrite old journals.
export function migrationChecksums(source) {
  const lf = source.toString('utf8').replaceAll('\r\n', '\n');
  return [...new Set([lf, lf.replaceAll('\n', '\r\n')].map(value =>
    createHash('sha256').update(value).digest('hex')))];
}
