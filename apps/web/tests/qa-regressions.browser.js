// Run from a page on the isolated development origin, never the user's normal demo.
// import('/tests/qa-regressions.browser.js').then(module => module.runQaRegressionChecks())
export function runQaRegressionChecks() {
  if (location.origin !== 'http://127.0.0.1:5184') {
    throw new Error('Run browser regression checks on isolated port 5184, not the user workspace.');
  }
  if (document.getElementById('qa-fix-frame')) throw new Error('A regression run is already active.');

  const report = window.__qaFixChecks = { running: true, results: [], failures: [] };
  const frame = document.createElement('iframe');
  frame.id = 'qa-fix-frame';
  frame.title = 'Isolated QA regression checks';
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:720px;border:0;z-index:9999;background:white';
  document.body.append(frame);

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    }
    return value;
  }
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const state = () => JSON.parse(localStorage.getItem('ems.frontend-demo.v1'));

  function wait(doc, predicate, label) {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(() => {
        if (predicate()) { observer.disconnect(); clearTimeout(timer); resolve(); }
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error(label)); }, 10000);
    });
  }

  async function visit(path, selector = 'main h1') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Frame navigation timed out: ${path}`)), 10000);
      frame.onload = () => { clearTimeout(timer); resolve(); };
      frame.onerror = () => { clearTimeout(timer); reject(new Error(`Frame failed to load: ${path}`)); };
      frame.src = location.origin + '/preview' + path;
    });
    const doc = frame.contentDocument;
    await wait(doc, () => doc.querySelector(selector), `Missing UI: ${path}`);
    return doc;
  }

  function button(doc, label) {
    const control = [...doc.querySelectorAll('button')].find(item =>
      item.textContent.trim() === label || item.getAttribute('aria-label') === label);
    if (!control) throw new Error(`Missing button: ${label}`);
    control.click();
  }

  function fill(doc, selector, value) {
    const element = doc.querySelector(selector);
    if (!element) throw new Error(`Missing field: ${selector}`);
    const win = doc.defaultView;
    const prototype = element.tagName === 'SELECT' ? win.HTMLSelectElement.prototype :
      element.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new win.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  }

  function pass(condition, label) {
    if (!condition) throw new Error(label);
    report.results.push(label);
  }
  async function test(label, run) {
    try { await run(); } catch (error) { report.failures.push(`${label}: ${error.message}`); }
  }
  const modal = doc => wait(doc, () => doc.querySelector('dialog[open] form'), 'Modal form missing');
  const closed = doc => wait(doc, () => !doc.querySelector('dialog[open]'), 'Modal did not close');
  function submit(doc, selector = 'form') {
    const form = doc.querySelector(selector);
    if (!form) throw new Error(`Missing form: ${selector}`);
    form.requestSubmit();
  }
  function visible(doc, element) {
    const rect = element.getBoundingClientRect();
    const dialog = element.closest('dialog')?.getBoundingClientRect() ?? { top: 0, bottom: doc.defaultView.innerHeight };
    return rect.top >= Math.max(0, dialog.top) &&
      rect.bottom <= Math.min(doc.defaultView.innerHeight, dialog.bottom) && rect.height > 0;
  }

  async function run() {
    const { createDemoData } = await import('/src/core/seed.ts');
    const fixture = createDemoData();
    fixture.employees[0].phone = '+1 (202) 555-0123';
    fixture.audit[0].entity = 'Salary slips';
    fixture.audit[1].entity = 'Leave';
    fixture.audit[2].entity = 'Company';
    for (let index = 0; index < 14; index++) {
      fixture.audit.push({ id: `legacy-salary-${index}`, actor: 'CEO', action: `slip: legacy review ${index}`, entity: 'slip', at: new Date().toISOString() });
    }
    localStorage.setItem('ems.frontend-demo.v1', JSON.stringify(fixture));
    sessionStorage.setItem('ems.preview-session', JSON.stringify({ role: 'Employee', employeeId: 'emp-1' }));
    let doc = await visit('/employee/profile');
    pass(state().audit.length === fixture.audit.length, 'Migration retains every historical audit record');
    pass(state().audit.filter(a => a.entity === 'salary-slips').length === 15, 'Migration combines seed labels and historical slip IDs');
    pass(same(state().employees, fixture.employees), 'Audit migration preserves employee records');
    pass(same(state().slips, fixture.slips), 'Audit migration preserves salary statements');

    for (const [width, theme] of [[1440, 'light'], [360, 'dark']]) {
      await test(`Invalid phone at ${width}px`, async () => {
        frame.style.width = `${width}px`;
        localStorage.setItem('ems.theme', theme);
        doc = await visit('/employee/profile');
        fill(doc, 'input[name="phone"]', 'not-a-phone');
        await wait(doc, () => doc.querySelector('input[name="phone"]').getAttribute('aria-invalid') === 'true', 'Phone error missing');
        submit(doc);
        pass(!doc.querySelector('input[name="phone"]').validity.valid, `Invalid phone rejected by form at ${width}px`);
        pass(doc.querySelector('.field-error')?.textContent.includes('7–15 digits'), `Clear inline phone error at ${width}px`);
        pass(state().employees[0].phone === '+1 (202) 555-0123', `Invalid phone does not overwrite saved value at ${width}px`);
        pass(!doc.querySelector('.toast.success'), 'No false success notification for invalid phone');
        pass(doc.documentElement.scrollWidth <= width + 1, `No page overflow from phone validation at ${width}px`);
        doc = await visit('/employee/profile');
        pass(doc.querySelector('input[name="phone"]').value === '+1 (202) 555-0123', 'Original valid phone retained after reload');
      });
    }

    await test('Valid and blank phone', async () => {
      fill(doc, 'input[name="phone"]', '  +44 20 7946 0958  ');
      submit(doc);
      await wait(doc, () => state().employees[0].phone === '+44 20 7946 0958', 'Valid phone was not saved');
      doc = await visit('/employee/profile');
      pass(doc.querySelector('input[name="phone"]').value === '+44 20 7946 0958', 'Formatted valid phone persists on reload');
      fill(doc, 'input[name="phone"]', '');
      submit(doc);
      await wait(doc, () => state().employees[0].phone === '', 'Blank phone was not saved');
      doc = await visit('/employee/profile');
      pass(doc.querySelector('input[name="phone"]').value === '', 'Optional phone can be cleared and stays blank on reload');
    });

    sessionStorage.setItem('ems.preview-session', JSON.stringify({ role: 'CEO', employeeId: 'emp-1' }));
    await test('CEO phone validation', async () => {
      doc = await visit('/ceo/employees/emp-1');
      button(doc, 'Edit profile');
      await modal(doc);
      fill(doc, 'dialog input[name="phone"]', 'not-a-phone');
      submit(doc, 'dialog form');
      pass(!doc.querySelector('dialog input[name="phone"]').validity.valid, 'CEO employee editing shares phone validation');
      pass(state().employees[0].phone === '', 'Invalid CEO phone edit leaves saved record unchanged');
      button(doc, 'Close dialog');
    });

    for (const [width, theme] of [[1440, 'light'], [360, 'dark']]) {
      await test(`Salary error visibility at ${width}px`, async () => {
        frame.style.width = `${width}px`;
        localStorage.setItem('ems.theme', theme);
        doc = await visit('/ceo/salary-slips/slip-draft');
        button(doc, 'Edit draft');
        await modal(doc);
        for (let index = 0; index < 6; index++) {
          const group = doc.querySelector('.salary-lines');
          const count = group.querySelectorAll('.salary-line').length;
          group.querySelector('button').click();
          await wait(doc, () => doc.querySelector('.salary-lines').querySelectorAll('.salary-line').length === count + 1, 'Salary line not added');
        }
        const lines = doc.querySelector('.salary-lines').querySelectorAll('.salary-line');
        for (let index = 0; index < lines.length; index++) {
          fill(doc, `[aria-label="Earnings label ${index + 1}"]`, `QA earning ${index + 1}`);
          fill(doc, `[aria-label="Earnings amount ${index + 1}"]`, index === 0 ? 'not-money' : '1.00');
        }
        const dialog = doc.querySelector('dialog');
        dialog.scrollTop = dialog.scrollHeight;
        pass(dialog.scrollTop > 0, `Salary modal starts scrolled down before invalid submission at ${width}px`);
        const before = structuredClone(state().slips.find(s => s.id === 'slip-draft'));
        submit(doc, 'dialog form');
        await wait(doc, () => doc.activeElement === doc.querySelector('dialog .modal-error'), 'Salary error was not focused');
        const error = doc.querySelector('dialog .modal-error');
        pass(visible(doc, error), `Salary error summary is visible at ${width}px`);
        pass(doc.activeElement === error, `Salary error receives focus at ${width}px`);
        pass(dialog.scrollTop === 0, `Salary error scrolls the dialog to the top at ${width}px`);
        pass(same(state().slips.find(s => s.id === 'slip-draft'), before), 'Invalid salary submission preserves the draft');
        dialog.scrollTop = dialog.scrollHeight;
        pass(visible(doc, error), `Sticky salary error remains visible while scrolling at ${width}px`);
        submit(doc, 'dialog form');
        await wait(doc, () => dialog.scrollTop === 0, 'Repeated error not revealed');
        pass(doc.activeElement === error, 'Repeated identical validation error remains actionable');
        button(doc, 'Close dialog');
      });
    }

    frame.style.width = '1440px';
    await test('Unified salary audit filter', async () => {
      doc = await visit('/ceo/salary-slips');
      button(doc, 'Create salary slip');
      await modal(doc);
      fill(doc, 'dialog select[name="employeeId"]', 'emp-2');
      fill(doc, 'dialog [aria-label="Earnings amount 1"]', '2400.50');
      submit(doc, 'dialog form');
      await closed(doc);
      const slip = state().slips.find(s => s.employeeId === 'emp-2' && s.status === 'Draft');
      pass(Boolean(slip), 'Salary draft created through CEO form');
      doc = await visit(`/ceo/salary-slips/${slip.id}`);
      button(doc, 'Publish slip');
      await modal(doc);
      submit(doc, 'dialog form');
      await closed(doc);
      pass(state().slips.find(s => s.id === slip.id).status === 'Published', 'Salary statement published through confirmation');
      doc = await visit('/ceo/audit');
      const options = [...doc.querySelector('[aria-label="Filter audit module"]').options];
      pass(options.filter(o => o.text === 'Salary slips').length === 1 && !options.some(o => o.text === 'slip'), 'Exactly one Salary slips option without a separate slip filter');
      fill(doc, '[aria-label="Filter audit module"]', 'salary-slips');
      await wait(doc, () => [...doc.querySelectorAll('.module-label')].every(e => e.textContent === 'Salary slips'), 'Audit filter not applied');
      const actions = [];
      while (true) {
        actions.push(...[...doc.querySelectorAll('tbody tr')].map(row => row.cells[2].textContent));
        const next = doc.querySelector('[aria-label="Next page"]');
        if (next.disabled) break;
        const before = doc.querySelector('.pagination').textContent;
        next.click();
        await wait(doc, () => doc.querySelector('.pagination').textContent !== before, 'Audit pagination did not change');
      }
      pass(actions.length === state().audit.filter(a => a.entity === 'salary-slips').length, 'Salary filter covers all matching pages');
      pass(['Published salary statements', 'slip: save', 'slip: publish', 'slip: legacy review 13'].every(action => actions.includes(action)), 'Salary filter combines seeded, legacy, draft, and publication activity');
      doc = await visit('/ceo/audit');
      pass(state().audit.every(a => a.entity !== 'slip' && a.entity !== 'Salary slips'), 'Audit category migration persists on reload');
    });

    await test('Completed attendance guidance', async () => {
      const data = state();
      data.attendance.push({ id: 'qa-complete', employeeId: 'emp-1', date: new Date().toISOString().slice(0, 10),
        checkIn: new Date(Date.now() - 120000).toISOString(), checkOut: new Date(Date.now() - 60000).toISOString(),
        corrections: [], nonWorking: false });
      localStorage.setItem('ems.frontend-demo.v1', JSON.stringify(data));
      sessionStorage.setItem('ems.preview-session', JSON.stringify({ role: 'Employee', employeeId: 'emp-1' }));
      for (const path of ['/employee/dashboard', '/employee/attendance']) {
        doc = await visit(path);
        const banner = doc.querySelector('.attendance-clock');
        pass(banner.querySelector('p').textContent.includes('No further clock-in is needed today.') &&
          banner.querySelector('.attendance-clock-status').textContent === 'Present', `Correct completed-attendance copy on ${path}`);
        pass(banner.querySelector('button').disabled, `Completed attendance action disabled on ${path}`);
      }
    });

    await test('Browser titles on SPA navigation', async () => {
      doc = await visit('/employee/profile');
      await wait(doc, () => doc.title === 'My Profile | Ebon Studio EMS Preview', 'Profile title missing');
      button(doc, 'Sign out of preview');
      await wait(doc, () => doc.title === 'Welcome to Your Workspace | Ebon Studio EMS Preview', 'Login title stale');
      pass(true, 'Sign-out replaces the prior application browser title');
      doc.querySelector('a[href="/preview/forgot-password"]').click();
      await wait(doc, () => doc.title === 'Forgot Your Password? | Ebon Studio EMS Preview', 'Recovery title stale');
      pass(true, 'Recovery SPA navigation updates the browser title');
      for (const [path, title] of [
        ['/reset-password?token=demo', 'Choose a New Password'],
        ['/accept-invitation?token=demo', 'You Are Invited'],
        ['/session-expired', 'Your Session Has Expired'],
      ]) {
        doc = await visit(path, '.auth-card h1');
        await wait(doc, () => doc.title === `${title} | Ebon Studio EMS Preview`, 'Incorrect auth title');
        pass(true, `Correct browser title on ${path}`);
      }
      doc = await visit('/missing-page', '.not-found h1');
      await wait(doc, () => doc.title === 'Page Not Available | Ebon Studio EMS Preview', 'Not-found title stale');
      pass(true, 'Not-found pages do not retain stale browser titles');
    });
  }

  void run().catch(error => report.failures.push(`Harness: ${error.message}`)).finally(() => {
    frame.remove();
    report.running = false;
  });
  return 'Started QA regression checks. Results will be in window.__qaFixChecks.';
}
