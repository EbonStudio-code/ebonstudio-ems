// Synthetic preview only. Never runs against the normal user workspace.
export async function runAttendanceClockChecks() {
  if (location.origin !== 'http://127.0.0.1:5184') throw new Error('Attendance checks require isolated origin 5184.');
  const report = window.__attendanceClockChecks = {running:true,results:[],failures:[]};
  const keys = ['ems.frontend-demo.v1','ems.theme'];
  const prior = keys.map(key => localStorage.getItem(key));
  const priorSession = sessionStorage.getItem('ems.preview-session');
  const frame = document.createElement('iframe');
  frame.title = 'Synthetic attendance clock checks';
  frame.style.cssText = 'position:fixed;inset:0;width:1440px;height:1000px;border:0;z-index:9999;background:white';
  document.body.append(frame);
  let doc;
  function mark(condition, message) {
    if (!condition) throw new Error(message);
    report.results.push(message);
  }
  function wait(predicate, message) {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve,reject) => {
      const observer = new MutationObserver(() => {
        if (predicate()) {observer.disconnect();clearTimeout(timer);resolve();}
      });
      observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
      const timer = setTimeout(() => {observer.disconnect();reject(new Error(message));},12000);
    });
  }
  async function visit(path) {
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('Preview navigation timed out')),12000);
      frame.onload = () => {clearTimeout(timer);resolve();};
      frame.src = location.origin+'/preview/employee/'+path;
    });
    doc = frame.contentDocument;
    await wait(() => doc.querySelector('.attendance-clock button'), 'Attendance clock not rendered');
    await doc.fonts.ready;
    // The embedded pane can be hidden and pause animation timelines. This suite
    // checks settled layout, not playback, so finish only this synthetic frame's finite animations.
    for (const animation of doc.getAnimations()) {
      if (animation.effect?.getTiming().iterations !== Infinity) animation.finish();
    }
  }
  function store(data) {
    localStorage.setItem(keys[0], JSON.stringify(data));
    sessionStorage.setItem('ems.preview-session',JSON.stringify({role:'Employee',employeeId:'emp-1'}));
  }
  const button = () => doc.querySelector('.attendance-clock button');
  const status = () => doc.querySelector('.attendance-clock-status').textContent;
  try {
    const {createDemoData} = await import('/src/core/seed.ts');
    const {dateKey,addDays} = await import('/src/core/dates.ts');
    const now = Date.now();
    const fixture = createDemoData(new Date(now));
    fixture.settings.timezone = 'Asia/Kolkata';
    fixture.employees[0].startDate = '2020-01-01';
    fixture.attendance = fixture.attendance.filter(a => a.employeeId !== 'emp-1');
    const today = dateKey(new Date(now),fixture.settings.timezone);
    const midnight = Date.parse(today+'T00:00:00+05:30');
    const record = {id:'clock-layout',employeeId:'emp-1',date:today,
      checkIn:new Date(Math.max(midnight,now-3600000)).toISOString(),checkOut:null,nonWorking:false,corrections:[]};
    for (const state of ['ready','open','complete']) {
      const data = structuredClone(fixture);
      if (state !== 'ready') data.attendance.push({...record,checkOut:state === 'complete' ? new Date(now).toISOString() : null});
      store(data);
      for (const path of ['dashboard','attendance']) {
        await visit(path);
        mark(button().textContent === ({ready:'Clock in',open:'Clock out',complete:'Day completed'})[state], `${state} action on ${path}`);
        mark(status() === (state === 'ready' ? 'Not recorded' : 'Present'), `${state} attendance status on ${path}`);
        mark(button().disabled === (state === 'complete'), `${state} action availability on ${path}`);
        for (const width of [360,900,1440]) for (const theme of ['light','dark']) {
          frame.style.width = width+'px';
          doc.documentElement.dataset.theme = theme;
          frame.getBoundingClientRect();
          const card = doc.querySelector('.attendance-clock'), heading = card.querySelector('h2');
          mark(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth+1, `${state} ${path} ${width}px ${theme}: no page overflow`);
          mark(heading.scrollWidth <= heading.clientWidth+1 && button().scrollWidth <= button().clientWidth+1,
            `${state} ${path} ${width}px ${theme}: heading and action fit`);
          mark(button().getBoundingClientRect().height >= 44 && card.getBoundingClientRect().width > 0,
            `${state} ${path} ${width}px ${theme}: visible touch-sized action`);
        }
      }
    }
    store(fixture);
    await visit('dashboard');
    const before = Date.now();
    button().click();
    await wait(() => button().textContent === 'Clock out','Preview clock-in did not save');
    mark(status() === 'Present','Preview clock-in immediately records Present');
    const saved = JSON.parse(localStorage.getItem(keys[0])).attendance.find(a => a.employeeId === 'emp-1' && a.date === today);
    mark(saved && saved.checkOut === null && Date.parse(saved.checkIn) >= before,'Preview saves actual browser timestamp, not a preset 9 AM time');
    await visit('attendance');
    button().click();
    await wait(() => button().textContent === 'Day completed','Preview clock-out did not save');
    mark(status() === 'Present' && button().disabled,'Preview clock-out retains Present and blocks a second session');
    const future = structuredClone(fixture);
    future.employees[0].startDate = addDays(today,1);
    store(future);await visit('dashboard');
    mark(button().disabled && button().textContent === 'Not started yet','Future starter cannot clock in from dashboard');
    const overnight = structuredClone(fixture);
    overnight.attendance.push({...record,date:addDays(today,-1),checkIn:new Date(midnight-1800000).toISOString()});
    store(overnight);await visit('dashboard');
    mark(status() === 'Not recorded' && button().textContent === 'Clock out','Earlier open record does not mark today Present');
    const stale = structuredClone(fixture);
    const old = new Date(now-25*3600000).toISOString();
    stale.attendance.push({...record,date:dateKey(old,fixture.settings.timezone),checkIn:old});
    store(stale);await visit('attendance');
    mark(button().disabled && button().textContent === 'Correction required','Stale record requires CEO correction');
  } catch (error) { report.failures.push(error.message); }
  finally {
    frame.remove();
    keys.forEach((key,i) => prior[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key,prior[i]));
    if (priorSession === null) sessionStorage.removeItem('ems.preview-session'); else sessionStorage.setItem('ems.preview-session',priorSession);
    report.running = false;
  }
  return {passed:report.results.length,...report};
}
