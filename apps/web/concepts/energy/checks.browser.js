// Explicitly invoked only on the isolated local concept page.
export async function runEnergyChecks() {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname) || location.pathname !== '/concepts/energy/index.html') {
    throw new Error('Run this only on the local Energy Lab, never on the EMS.');
  }
  if (window.__energyChecks?.running) throw new Error('Checks are already running.');
  const report = window.__energyChecks = { running: true, results: [], failures: [], widths: [360, 768, 1440], concepts: ['gold', 'aurora', 'neon'] };
  const check = (name, passed) => {
    (passed ? report.results : report.failures).push(name);
  };
  const waitFor = async (predicate, message) => {
    const deadline = Date.now() + 15000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };
  const frames = async win => {
    await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
  };
  const frame = document.createElement('iframe');
  frame.title = 'Isolated concept layout checks';
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:1100px;border:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.append(frame);
  try {
    for (const width of report.widths) {
      frame.style.width = `${width}px`;
      for (const concept of report.concepts) {
        const label = `${concept} / ${width}px`;
        frame.src = `${location.pathname}?checks=${concept}-${width}#${concept}`;
        await waitFor(() => {
          const win = frame.contentWindow;
          return win?.location.search === `?checks=${concept}-${width}` && win.document.body?.dataset.ready === 'true';
        }, `${label}: did not load`);
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        const q = selector => doc.querySelector(selector);
        const click = selector => {
          const button = q(selector);
          if (!button) throw new Error(`${label}: missing ${selector}`);
          button.click();
        };
        await Promise.all([...doc.images].map(image => image.decode()));
        await frames(win);
        check(`${label}: selected concept`, doc.body.dataset.concept === concept);
        check(`${label}: exactly one selected design`, doc.querySelectorAll('.concept-choice[aria-pressed="true"]').length === 1);
        check(`${label}: original assets decoded`, [...doc.images].every(image => image.naturalWidth > 0));
        check(`${label}: no horizontal page overflow`, doc.documentElement.scrollWidth <= width + 1);
        check(`${label}: headline fits`, q('h1').scrollWidth <= q('h1').clientWidth + 1);
        check(`${label}: cards remain inside viewport`, [...doc.querySelectorAll('.metric,.panel')].every(element => {
          const rect = element.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= width + 1;
        }));
        check(`${label}: sample disclaimer visible`, q('.demo-pill').getBoundingClientRect().width > 0 && doc.body.textContent.includes('NO REAL DATA'));
        if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const ring = q('.ring-one');
          const initial = win.getComputedStyle(ring).transform;
          await frames(win);
          check(`${label}: orbit animation progresses`, win.getComputedStyle(ring).transform !== initial);
          click('#motion-toggle');
          await frames(win);
          check(`${label}: pause stops animations`, doc.body.dataset.motion === 'paused' && doc.getAnimations().every(animation => animation.playState !== 'running'));
          check(`${label}: replay disabled while paused`, q('#replay').disabled);
          const other = concept === 'gold' ? 'aurora' : 'gold';
          click(`[data-style="${other}"]`);
          check(`${label}: pause survives style switch`, doc.body.dataset.motion === 'paused');
          click(`[data-style="${concept}"]`);
          click('#motion-toggle');
        } else {
          check(`${label}: system reduced motion honoured`, doc.body.dataset.motion === 'paused' && q('#motion-toggle').disabled);
        }
        click('input[value="homepage"]');
        check(`${label}: task completion updates counter`, q('#open-task-count').textContent === '02' && q('#task-progress').value === 2);
        click('input[value="homepage"]');
        check(`${label}: task completion reversible`, q('#open-task-count').textContent === '03' && q('#task-progress').value === 1);
        click('#check-in');
        check(`${label}: check-in is clearly a demo`, q('#workday-value').textContent === 'In flow' && q('.toast').textContent.includes('No real attendance'));
        click('#check-in');
        check(`${label}: demo check-in reversible`, q('#workday-value').textContent === 'Ready');
        click('#open-focus');
        await frames(win);
        const modal = q('dialog');
        const modalRect = modal.getBoundingClientRect();
        check(`${label}: focus dialog opens and receives focus`, modal.open && modal.contains(doc.activeElement));
        check(`${label}: dialog fits viewport`, modalRect.left >= -1 && modalRect.right <= width + 1);
        click('#close-focus');
        await frames(win);
        check(`${label}: focus returns to trigger`, !modal.open && doc.activeElement === q('#open-focus'));
        click('nav [data-view="tasks"]');
        check(`${label}: task view and accessible primary heading`, doc.body.dataset.view === 'tasks' && q('#view-title').getAttribute('aria-level') === '1' && win.getComputedStyle(q('.crew-panel')).display === 'none');
        click('nav [data-view="team"]');
        check(`${label}: crew view uses fictional people`, doc.body.dataset.view === 'team' && q('.crew-panel').textContent.includes('Fictional people') && win.getComputedStyle(q('.tasks-panel')).display === 'none');
        click('nav [data-view="overview"]');
        click('.skip-link');
        await frames(win);
        check(`${label}: skip link preserves concept`, doc.body.dataset.concept === concept);
        check(`${label}: no API requests`, win.performance.getEntriesByType('resource').every(entry => !new URL(entry.name, location.origin).pathname.startsWith('/api/')));
        check(`${label}: no external resources`, win.performance.getEntriesByType('resource').every(entry => new URL(entry.name, location.origin).origin === location.origin));
      }
    }
  } catch (error) {
    report.failures.push(error.message);
  } finally {
    frame.remove();
    report.running = false;
  }
  return { passed: report.results.length, failures: report.failures };
}
