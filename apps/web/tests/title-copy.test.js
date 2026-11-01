import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('uses Title Case labels in the connected sidebar', () => {
  const app = readFileSync(new URL('../src/live/App.tsx', import.meta.url), 'utf8');
  for (const title of ['My Profile', 'Leave Requests', 'Salary Slips', 'Company Settings', 'Audit History', 'Account Security']) {
    expect(app).toContain(`title:'${title}'`);
  }
});
