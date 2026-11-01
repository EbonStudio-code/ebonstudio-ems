const concepts = {
  gold: {
    title: 'Electric Gold',
    headline: ['Make work.', 'Feel electric.'],
    description: 'Kinetic rings. Warm electricity. A studio that feels switched on.',
    body: 'A little less routine. A lot more momentum. Your people, projects and next big move, together.',
  },
  aurora: {
    title: 'Aurora Glass',
    headline: ['Find your flow.', 'Own your orbit.'],
    description: 'Liquid colour, floating glass and a softer, otherworldly kind of energy.',
    body: 'Make room for your best ideas. A fluid, colourful workspace built around your people.',
  },
  neon: {
    title: 'Neon Grid',
    headline: ['Less idle.', 'More impact.'],
    description: 'Lime voltage. Cyan edges. A sharper, after-hours creative playground.',
    body: 'Big ideas do not stand still. Put your crew, your next move and your momentum in one place.',
  },
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const entranceAnimations = new Set();
let userPaused = false;
let checkedIn = false;
let toastTimeout;

function announce(message) {
  const toast = $('.toast');
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.dataset.visible = 'true';
  toastTimeout = setTimeout(() => { toast.dataset.visible = 'false'; }, 4000);
}

function replay() {
  entranceAnimations.forEach(animation => animation.cancel());
  entranceAnimations.clear();
  if (document.body.dataset.motion === 'paused' || document.hidden) return;
  $$('[data-reveal]').filter(element => element.getClientRects().length).forEach((element, index) => {
    const animation = element.animate([
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 600, delay: Math.min(index * 50, 250), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    entranceAnimations.add(animation);
    animation.addEventListener('finish', () => entranceAnimations.delete(animation), { once: true });
  });
}

function syncMotion() {
  const paused = motionPreference.matches || userPaused;
  document.body.dataset.motion = paused ? 'paused' : 'running';
  $('#motion-toggle').setAttribute('aria-pressed', String(paused));
  $('#motion-toggle').disabled = motionPreference.matches;
  $('#motion-toggle').textContent = motionPreference.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
  $('#replay').disabled = paused;
  $('#motion-note').textContent = motionPreference.matches
    ? 'Your system prefers reduced motion. Animations are disabled.'
    : paused ? 'Motion is paused. The design is still fully interactive.' : 'Ambient animation is on. Pause it anytime.';
  if (paused) {
    entranceAnimations.forEach(animation => animation.cancel());
    entranceAnimations.clear();
  }
}

function selectConcept(key, updateHash = true) {
  if (!Object.hasOwn(concepts, key)) key = 'gold';
  const concept = concepts[key];
  document.body.dataset.concept = key;
  $$('.concept-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.style === key)));
  const emphasis = document.createElement('em');
  emphasis.textContent = concept.headline[1];
  $('#hero-title').replaceChildren(concept.headline[0], document.createElement('br'), emphasis);
  $('#hero-description').textContent = concept.body;
  $('#concept-description').textContent = concept.description;
  document.title = `${concept.title} · Ebon Studio Energy Lab`;
  if (updateHash) history.replaceState(null, '', `#${key}`);
  replay();
}

function selectView(view) {
  document.body.dataset.view = view;
  const names = { overview: 'Your daily orbit', tasks: 'Your next moves', team: 'Meet your crew' };
  $('#view-title').textContent = names[view];
  // Keep one visible primary heading in the simplified task and crew views.
  $('#view-title').setAttribute('role', 'heading');
  $('#view-title').setAttribute('aria-level', view === 'overview' ? '2' : '1');
  $$('nav [data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  replay();
}

function updateTasks(announceChange = true) {
  const tasks = $$('input[name="task"]');
  const completed = tasks.filter(task => task.checked).length;
  const open = tasks.length - completed;
  $('#task-progress').value = completed;
  $('#task-progress').textContent = `${completed} of ${tasks.length} complete`;
  $('#task-progress-copy').textContent = `${completed} / ${tasks.length} done`;
  $('#open-task-count').textContent = String(open).padStart(2, '0');
  $('#nav-task-count').textContent = String(open);
  if (announceChange) announce(`${completed} of ${tasks.length} sample tasks complete. Nothing saved.`);
}

$$('.concept-choice').forEach(button => button.addEventListener('click', () => selectConcept(button.dataset.style)));
$$('nav [data-view]').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
$$('input[name="task"]').forEach(input => input.addEventListener('change', () => updateTasks()));
$('#motion-toggle').addEventListener('click', () => { userPaused = !userPaused; syncMotion(); });
$('#replay').addEventListener('click', replay);
$('#check-in').addEventListener('click', () => {
  checkedIn = !checkedIn;
  $('#check-in span').textContent = checkedIn ? 'Undo · demo' : 'Check in · demo';
  $('#workday-value').textContent = checkedIn ? 'In flow' : 'Ready';
  $('#workday-note').textContent = checkedIn ? 'Sample check-in only.' : 'Try the sample check-in.';
  announce(checkedIn ? 'Sample check-in. No real attendance was recorded.' : 'Sample check-in cleared.');
});
$('#open-focus').addEventListener('click', () => $('#focus-dialog').showModal());
$('#close-focus').addEventListener('click', () => $('#focus-dialog').close());
$('#finish-focus').addEventListener('click', () => $('#focus-dialog').close());
$('#focus-dialog').addEventListener('close', () => $('#open-focus').focus());
motionPreference.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', () => {
  document.body.dataset.hidden = String(document.hidden);
  if (document.hidden) {
    entranceAnimations.forEach(animation => animation.cancel());
    entranceAnimations.clear();
  }
});
window.addEventListener('hashchange', () => {
  const key = location.hash.slice(1);
  if (Object.hasOwn(concepts, key)) selectConcept(key, false);
});
syncMotion();
updateTasks(false);
selectConcept(location.hash.slice(1) || 'gold', false);
document.body.dataset.ready = 'true';
