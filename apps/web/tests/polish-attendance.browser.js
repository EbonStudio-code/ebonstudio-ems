// Only the in-memory, DB-free fixture. Never use this on the normal app.
export async function runAttendanceChecks() {
  if (location.origin !== 'http://127.0.0.1:5187') throw new Error('Isolated UI fixture required.');
  const results=window.__attendancePolishChecks=[];
  const frame=document.querySelector('#review');
  const doc=()=>frame.contentDocument;
  const check=(name,condition)=>{results.push({name,passed:Boolean(condition)});if(!condition)throw new Error(name);};
  const wait=predicate=>new Promise((resolve,reject)=>{
    if(predicate()){resolve();return;}
    const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}});
    observer.observe(doc().documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Attendance state did not settle'));},10000);
  });
  const ready=()=>wait(()=>!doc().querySelector('.loading-skeleton'));
  const select=(selector,value)=>{
    const input=doc().querySelector(selector);input.value=value;
    input.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
  };
  await window.polish.show({page:'employee',theme:'dark',width:390,height:844,scenario:'empty'});
  check('Empty history has no table or pagination',!doc().querySelector('table,.pagination')&&!!doc().querySelector('.attendance-empty'));
  check('Mobile breadcrumb names the page',doc().querySelector('.breadcrumb strong').getBoundingClientRect().width>0);
  if (doc().visibilityState === 'visible') {
    const before=doc().querySelector('.attendance-live-time time').dateTime;
    await wait(()=>doc().querySelector('.attendance-live-time time').dateTime!==before);
    check('Display clock advances without a clock action',!doc().querySelector('.attendance-clock-times time')&&doc().querySelector('.attendance-clock button').textContent==='Clock in');
  } else results.push({name:'Live clock ticking',skipped:'Embedded frame is hidden; display timer intentionally pauses.'});
  await window.polish.show({page:'employee',theme:'light',width:390,height:844,scenario:'not-started'});
  const disabled=doc().querySelector('.attendance-clock button'),win=frame.contentWindow;
  check('Future starter action is disabled and neutral',disabled.disabled&&disabled.textContent==='Not started yet'&&win.getComputedStyle(disabled).backgroundColor===win.getComputedStyle(doc().querySelector('.attendance-empty')).backgroundColor);
  await window.polish.show({page:'employee',theme:'light',width:1440,height:900,scenario:'many'});
  check('Full month includes 28 synthetic days and 224 hours',doc().querySelector('.attendance-month').textContent.includes('28')&&doc().querySelector('.attendance-month').textContent.includes('224h 0m'));
  check('History is paginated separately at 20 rows',doc().querySelectorAll('tbody tr').length===20);
  doc().querySelector('[aria-label="Next page"]').click();
  await wait(()=>doc().querySelectorAll('tbody tr').length===8);await ready();
  check('Second history page retains complete monthly totals',doc().querySelector('.attendance-month').textContent.includes('224h 0m'));
  select('.attendance-filters label:last-child select','OPEN');
  await wait(()=>!!doc().querySelector('.attendance-empty'));await ready();
  check('Session filter changes history without narrowing monthly totals',doc().querySelector('.attendance-month').textContent.includes('224h 0m'));
  select('.attendance-filters label:first-child select','week');await ready();
  check('Week filter is available',doc().querySelector('.attendance-filters select').value==='week');
  select('.attendance-filters label:first-child select','custom');
  await wait(()=>doc().querySelectorAll('.attendance-filters input[type=date]').length===2);
  check('Custom range uses styled labelled date inputs',doc().querySelector('.attendance-filters input').closest('label').textContent.includes('From date'));
  const requests=await fetch('/__ui-fixture').then(r=>r.json());
  check('Monthly API read uses its allowed 100-row limit',requests.data.historyRequests.some(q=>q.includes('limit=100')&&!q.includes('state=')));
  await window.polish.show({page:'employee',theme:'dark',width:390,height:844,scenario:'ready'});
  const inside=await window.polish.clock();
  check('Clock-in confirms Present with a status toast',inside.role==='status'&&inside.toast.includes('Present')&&doc().querySelector('.attendance-clock-status').textContent==='Present');
  const outside=await window.polish.clock();
  check('Clock-out retains Present and disables another punch',outside.role==='status'&&doc().querySelector('.attendance-clock button').disabled&&doc().querySelector('.attendance-clock-status').textContent==='Present');
  check('Mobile records use visible stacked cards, not a clipped table',doc().querySelector('.attendance-days').getBoundingClientRect().width>0&&frame.contentWindow.getComputedStyle(doc().querySelector('.attendance-desktop')).display==='none');
  return results;
}
