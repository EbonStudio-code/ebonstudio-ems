if(location.origin!=='http://127.0.0.1:5188')throw Error('Use only the Ebon UI fixture on port 5188.');
const frame=document.querySelector('#review');
const reports=[];
const wait=(doc,predicate)=>new Promise((resolve,reject)=>{
  if(predicate())return resolve();
  const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}});
  observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,characterData:true});
  const timer=setTimeout(()=>{observer.disconnect();reject(Error('Synthetic UI did not settle'));},15000);
});
const check=(name,passed,details)=>{reports.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});};
function inspect(doc) {
  const win=doc.defaultView,visible=el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
  const touch=[...doc.querySelectorAll('.icon-button,.theme-toggle,.pagination .button,.button[aria-label]')].filter(visible)
    .map(el=>({label:el.getAttribute('aria-label'),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
  const fonts=[...doc.querySelectorAll('main *')].filter(el=>visible(el)&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(el=>parseFloat(win.getComputedStyle(el).fontSize));
  return {width:win.innerWidth,overflow:doc.documentElement.scrollWidth>win.innerWidth+1,touch,
    minFont:fonts.length?Math.min(...fonts):null,panels:[...doc.querySelectorAll('.dashboard-panels > .card h2')].map(e=>e.textContent),
    firstPanelTop:doc.querySelector('.dashboard-panels')?.getBoundingClientRect().top,
    firstTaskTop:doc.querySelector('.task-summary')?.getBoundingClientRect().top,
    clockActionTop:doc.querySelector('.attendance-clock button')?.getBoundingClientRect().top,
    sidebarVisible:visible(doc.querySelector('.sidebar')),theme:doc.documentElement.dataset.theme};
}
async function show(options={}) {
  const settings={role:'CEO',theme:'dark',scenario:'ready',width:390,height:844,...options};
  window.__refinementOptions=settings;
  frame.style.width=settings.width+'px';frame.style.height=settings.height+'px';
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Frame failed to load')),20000);
    frame.onload=()=>{clearTimeout(timer);resolve();};
    frame.src='/tests/refinement-frame.html?run='+Date.now();
  });
  const doc=frame.contentDocument;
  await wait(doc,()=>doc.querySelector('h1')&&(settings.scenario.endsWith('loading')?
    doc.querySelector('.loading-skeleton'):!doc.querySelector('.loading-skeleton')));
  await doc.fonts.ready;
  for(const animation of doc.getAnimations())if(animation.effect?.getTiming().iterations!==Infinity)animation.finish();
  return inspect(doc);
}
async function layouts(themes=['dark','light']) {
  reports.length=0;
  const sizes=[{width:1440,height:900},{width:390,height:844},{width:320,height:740}];
  for(const theme of themes)for(const role of ['CEO','EMPLOYEE'])for(const scenario of ['ready','populated','empty'])for(const size of sizes) {
    const result=await show({theme,role,scenario,...size});
    const name=[role,scenario,theme,size.width].join(' ');
    check(name+' layout',!result.overflow&&result.minFont>=13,result);
    check(name+' navigation',result.sidebarVisible===(size.width>950)&&result.theme===theme);
    if(size.width<=950)check(name+' touch targets',result.touch.every(t=>t.width>=43.9&&t.height>=43.9));
    if(role==='CEO'&&scenario==='populated')check(name+' attention order',result.panels.slice(0,3).join('|')==='Leave Approvals|Work in Focus|Attendance Corrections');
    if(role==='EMPLOYEE'&&scenario==='ready')check(name+' useful first screen',result.clockActionTop<size.height&&result.firstTaskTop<size.height,result);
    if(scenario==='empty')check(name+' quiet summaries',!frame.contentDocument.querySelector('.dashboard-attention')&&!!frame.contentDocument.querySelector('.dashboard-quiet'));
  }
  for(const theme of themes)for(const scenario of ['loading','error','disabled','clock-error','clock-loading']) {
    const role=scenario.startsWith('clock-')?'EMPLOYEE':'CEO';
    await show({theme,role,scenario});
    const doc=frame.contentDocument;
    if(scenario==='error'||scenario==='loading') {
      check(theme+' '+scenario+' distinct state',!!doc.querySelector(scenario==='error'?'[role=alert]':'.loading-skeleton')&&
        !doc.querySelector('.stat-value,.dashboard-quiet,.dashboard-panels'));
    } else if(scenario==='disabled')check(theme+' disabled modules',!doc.querySelector('a[href$="/tasks"],a[href$="/leave"],a[href$="/attendance"],a[href$="/salary-slips"]'));
    else check(theme+' '+scenario+' no fake clock action',!!doc.querySelector(scenario==='clock-error'?'[role=alert]':'.loading-skeleton')&&!doc.querySelector('.attendance-clock button'));
  }
  for(const preview of [false,true])for(const role of ['CEO','EMPLOYEE'])for(const theme of themes) {
    const result=await show({preview,role,theme,scenario:'empty'});
    check(`${preview?'preview':'live'} ${role} ${theme} smoke`,!result.overflow);
  }
  return reports;
}
async function dialogs() {
  await show({role:'EMPLOYEE',path:'/employee/leave',scenario:'preview-busy'});
  const doc=frame.contentDocument,win=frame.contentWindow;
  const button=(text,root=doc)=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
  const dialog=()=>doc.querySelector('dialog[open]');
  const opener=button('Request leave');
  const open=async()=>{opener.focus();opener.click();await wait(doc,()=>!!dialog());};
  await open();
  check('Live dialog has an accessible name',!!doc.getElementById(dialog().getAttribute('aria-labelledby')));
  check('Mobile close target',parseFloat(win.getComputedStyle(dialog().querySelector('.icon-button')).minWidth)>=44);
  const form=dialog().querySelector('form');
  for(const [name,value] of Object.entries({startDate:form.elements.startDate.min,endDate:form.elements.endDate.min,reason:'Synthetic preview only'})){
    form.elements[name].value=value;form.elements[name].dispatchEvent(new win.Event('input',{bubbles:true}));
  }
  button('Preview working dates').click();
  await wait(doc,()=>!!dialog()?.querySelector('fieldset:disabled')&&dialog().querySelector('[aria-label="Close dialog"]').disabled&&doc.documentElement.dataset.fixturePending);
  const before=win.__refinementFixture.requests.filter(r=>r.path==='/leave/preview').length;
  dialog().dispatchEvent(new win.Event('cancel',{cancelable:true}));
  check('Busy dialog rejects dismissal',!!dialog()&&dialog().querySelector('[aria-label="Close dialog"]').disabled&&button('Cancel').matches(':disabled'));
  dialog().querySelector('form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  check('Busy form rejects duplicate submission',win.__refinementFixture.requests.filter(r=>r.path==='/leave/preview').length===before);
  win.__refinementFixture.release();
  await wait(doc,()=>!!button('Submit leave request')&&!dialog().querySelector('fieldset').disabled);
  button('Cancel').click();
  await wait(doc,()=>!doc.querySelector('dialog'));
  check('Leave preview Cancel unmounts rather than reopening the form',!doc.querySelector('dialog'));
  reports.push({name:'Live dialog focus return (programmatic only)',observed:doc.activeElement===opener});
  for(const mode of ['close','cancel']) {
    await open();
    if(mode==='close')dialog().querySelector('[aria-label="Close dialog"]').click();
    else dialog().dispatchEvent(new win.Event('cancel',{cancelable:true}));
    await wait(doc,()=>!doc.querySelector('dialog'));
    check('Live '+mode+' dismisses dialog',!dialog());
  }
  await open();
  check('Explicit Leave reopen is fresh',!dialog().querySelector('[name=startDate]').value&&!dialog().querySelector('[name=reason]').value);
  button('Cancel').click();
  check('No leave records were submitted',!win.__refinementFixture.requests.some(r=>r.path==='/leave/requests'&&r.method!=='GET'));
  await show({preview:true,role:'EMPLOYEE',path:'/preview/employee/leave',scenario:'empty'});
  const previewDoc=frame.contentDocument;
  const previewOpener=[...previewDoc.querySelectorAll('button')].find(b=>b.textContent==='Request leave');
  previewOpener.focus();previewOpener.click();
  await wait(previewDoc,()=>!!previewDoc.querySelector('dialog[open]'));
  previewDoc.querySelector('[aria-label="Close dialog"]').click();
  await wait(previewDoc,()=>!previewDoc.querySelector('dialog'));
  check('Preview dialog dismissal',!previewDoc.querySelector('dialog'));
  reports.push({name:'Preview dialog focus return (programmatic only)',observed:previewDoc.activeElement===previewOpener});
  for(const scenario of ['not-started','stale','complete']) {
    await show({role:'EMPLOYEE',scenario});
    check(scenario+' attendance remains disabled',frame.contentDocument.querySelector('.attendance-clock button').disabled);
  }
  await show({role:'EMPLOYEE',scenario:'clock-busy'});
  const clockDoc=frame.contentDocument,clockWin=frame.contentWindow;
  clockDoc.querySelector('.attendance-clock button').click();
  await wait(clockDoc,()=>!!clockDoc.querySelector('.attendance-clock fieldset:disabled')&&clockDoc.documentElement.dataset.fixturePending);
  clockDoc.querySelector('.attendance-clock form').dispatchEvent(new clockWin.Event('submit',{bubbles:true,cancelable:true}));
  check('Clock-in prevents duplicate submission',clockWin.__refinementFixture.requests.filter(r=>r.path==='/attendance/check-in').length===1);
  clockWin.__refinementFixture.release();
  await wait(clockDoc,()=>clockDoc.querySelector('.attendance-clock button')?.textContent==='Clock out');
  check('Clock-in completes with notification',!!clockDoc.querySelector('.toast[role=status]'));
  return reports;
}
window.refinement={show,inspect:()=>inspect(frame.contentDocument),layouts,dialogs,reports,
  async run(){await layouts();await dialogs();return {checks:reports.filter(r=>'passed'in r).length,failures:reports.filter(r=>r.passed===false),observations:reports.filter(r=>'observed'in r)};}};
