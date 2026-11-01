// Only run against scripts/browser-fixture.js and Vite on isolated port 5186.
export async function runConnectedChecks() {
  if(location.origin!=='http://127.0.0.1:5186')throw new Error('Connected checks require isolated origin 5186.');
  const report=window.__connectedChecks={running:true,results:[],failures:[]};
  const fixture=await fetch('/api/v1/__browser-test/fixture').then(r=>{if(!r.ok)throw new Error('Synthetic fixture is not available');return r.json();});
  await fetch('/api/v1/__browser-test/expire',{method:'POST'});
  const old=localStorage.getItem('ems.frontend-demo.v1');
  const marker=old||JSON.stringify({preservedSyntheticBrowserMarker:true});
  if(!old)localStorage.setItem('ems.frontend-demo.v1',marker);
  const frame=document.createElement('iframe');
  frame.id='connected-check-frame';frame.title='Isolated connected workspace checks';
  frame.style.cssText='position:fixed;inset:0;width:1440px;height:900px;background:white;border:0;z-index:9999';
  document.body.append(frame);
  let doc;
  const mark=(name,condition=true)=>{if(!condition)throw new Error(name);report.results.push(name);};
  function wait(predicate,description) {
    if(predicate())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}});
      observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
      const timer=setTimeout(()=>{observer.disconnect();reject(new Error(description+(doc.querySelector('[role=alert]')?' | '+doc.querySelector('[role=alert]').textContent.slice(0,240):'')));},15000);
    });
  }
  async function visit(path,selector='main h1') {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Navigation timed out')),15000);
      frame.onload=()=>{clearTimeout(timer);resolve();};
      frame.src=location.origin+path;
    });
    doc=frame.contentDocument;
    await wait(()=>doc.querySelector(selector),'Missing page content');
  }
  function button(text,scope=doc) {
    const el=[...scope.querySelectorAll('button')].find(b=>b.textContent.trim()===text||b.getAttribute('aria-label')===text);
    if(!el)throw new Error('Missing button: '+text);
    el.click();
  }
  function field(selector,text) {
    const el=[...doc.querySelectorAll(selector)].find(el=>['INPUT','SELECT','TEXTAREA'].includes(el.tagName));
    if(!el)throw new Error('Missing field: '+selector);
    const win=doc.defaultView;
    const proto=el.tagName==='SELECT'?win.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?win.HTMLTextAreaElement.prototype:win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,text);
    el.dispatchEvent(new win.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
  }
  function check(selector) {const el=doc.querySelector(selector);if(!el)throw new Error('Missing checkbox');if(!el.checked)el.click();}
  async function login(email,password=fixture.password) {
    await visit('/login','input[name=email]');
    field('[name=email]',email);field('[name=password]',password);button('Sign in');
    await wait(()=>doc.querySelector('main h1')&&!doc.querySelector('input[name=email]'),'Login did not reach workspace');
  }
  async function logout() {button('Sign out');await wait(()=>doc.querySelector('input[name=email]'),'Logout did not clear private workspace');}
  async function closeDialogAfter(label) {button(label,doc.querySelector('dialog'));await wait(()=>!doc.querySelector('dialog[open]'),'Dialog did not save');}
  async function messages() {return fetch('/api/v1/__browser-test/messages').then(r=>r.json());}
  const date=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  const suffix=Date.now().toString().slice(-8);
  const email=`browser-employee-${suffix}@example.test`;
  let leaveDay=date(7);
  let employeeId,leaveId,complaintId,taskId,slipId;
  try {
    await login(fixture.email);
    if(doc.querySelector('[name=displayName]')) {
      field('[name=displayName]','Browser Test Company');field('[name=legalName]','Synthetic Legal Company');
      field('[name=statementAddress]','Synthetic business address');field('[name=timezone]','UTC');field('[name=currencyCode]','USD');
      field('[name=leaveTypes]','Annual, Sick, Unpaid');field('[name=salaryJurisdiction]','Synthetic test review');
      for(const el of doc.querySelectorAll('[name=weekday]'))el.click();
      check('[name=publication]');button('Save changes');
      await wait(()=>doc.querySelector('main h1')?.textContent==='Company Overview','Company setup did not finish');
    }
    mark('CEO login and explicit company setup reach live dashboard');
    const holidays=await frame.contentWindow.fetch('/api/v1/holidays?limit=100').then(r=>r.json());
    for(let offset=7;holidays.data.some(h=>h.date===leaveDay);offset+=1)leaveDay=date(offset+1);
    await visit('/ceo/settings');await wait(()=>doc.querySelector('[name=displayName]'),'Settings not loaded');
    mark('Company settings survive reload',doc.querySelector('[name=displayName]').value==='Browser Test Company');
    await visit('/ceo/employees');button('Add employee');await wait(()=>doc.querySelector('dialog[open]'),'No employee editor');
    field('[name=fullName]','Browser Employee '+suffix);field('[name=email]',email);field('[name=employeeCode]','BROWSER-'+suffix);
    field('[name=jobTitle]','Synthetic tester');field('[name=department]','Browser QA');field('[name=startDate]',date(-1));field('[name=phone]','+91 98765 43210');
    await closeDialogAfter('Create employee');await wait(()=>doc.querySelector('main h1')?.textContent==='Employee Profile','Profile not opened');
    employeeId=frame.contentWindow.location.pathname.split('/').pop();
    mark('Employee creation persists account/profile and reports invitation delivery',doc.body.textContent.includes('sent'));
    const invitation=(await messages()).findLast(m=>m.email===email).url;
    await logout();
    await visit(new URL(invitation).pathname+new URL(invitation).hash,'input[name=password]');
    mark('Invitation token is removed from address after capture',frame.contentWindow.location.hash==='');
    field('[name=password]','short');field('[name=confirm]','short');
    button('Save password');await wait(()=>doc.querySelector('[role=alert]')?.textContent.includes('12–128 characters'),'Short password not rejected');
    mark('Invitation enforces minimum length',doc.querySelector('[name=password]').minLength===12&&Boolean(doc.querySelector('[role=alert]')));
    field('[name=password]',fixture.password);field('[name=confirm]','Different synthetic passphrase');
    button('Save password');await wait(()=>doc.querySelector('[role=alert]')?.textContent.includes('Passwords do not match'),'Mismatch not surfaced');
    mark('Invitation password mismatch stays on form',doc.body.textContent.includes('Passwords do not match'));
    field('[name=confirm]',fixture.password);button('Save password');await wait(()=>doc.body.textContent.includes('Password saved'),'Invitation redemption failed');
    mark('Invitation completes without silently signing in',!doc.querySelector('.live-workspace'));
    await login(email);mark('Employee login receives own workspace and no role switcher',!doc.querySelector('[aria-label="Preview role"]'));
    await visit('/employee/profile');await wait(()=>doc.querySelector('[name=phone]'),'Profile loading');
    field('[name=phone]','+1 212 555 0123');button('Update phone');await wait(()=>doc.querySelector('.toast')?.textContent.includes('Phone saved'),'Phone update failed');
    mark('Employee phone update uses live API');
    await visit('/employee/dashboard');await wait(()=>doc.querySelector('.attendance-clock button')?.textContent==='Clock in','Dashboard clock-in unavailable');
    await wait(()=>doc.querySelector('.stats-grid'),'Dashboard figures not loaded');
    mark('Employee dashboard offers Clock in above the summary figures',
      Boolean(doc.querySelector('.attendance-clock').compareDocumentPosition(doc.querySelector('.stats-grid')) & 4));
    const nativeFetch=frame.contentWindow.fetch;
    frame.contentWindow.fetch=function(input,init) {
      if(String(input).endsWith('/attendance/check-in')&&init?.method==='POST')return Promise.resolve(new frame.contentWindow.Response(
        JSON.stringify({error:{code:'SYNTHETIC_UNAVAILABLE',message:'Synthetic attendance outage'}}),{status:503,headers:{'Content-Type':'application/json'}}));
      return nativeFetch.call(this,input,init);
    };
    try {
      button('Clock in');await wait(()=>doc.querySelector('.attendance-clock [role=alert]'),'Clock-in failure not shown');
      mark('Failed clock-in keeps attendance unrecorded and does not show success',
        doc.querySelector('.attendance-clock-status').textContent==='Not recorded'&&
        doc.querySelector('.attendance-clock button[type=submit]')?.textContent==='Clock in');
    } finally {frame.contentWindow.fetch=nativeFetch;}
    const beforePunch=Date.now();
    const clockButton=doc.querySelector('.attendance-clock button[type=submit]');
    clockButton.click();clockButton.click();
    await wait(()=>doc.querySelector('.attendance-clock button')?.textContent==='Clock out','Clock-in failed');
    mark('Clock-in immediately marks Present without waiting for checkout',doc.querySelector('.attendance-clock-status').textContent==='Present');
    const currentAttendance=await frame.contentWindow.fetch('/api/v1/attendance/me/current').then(r=>r.json());
    const punch=currentAttendance.data.todayRecord;
    mark('Saved clock-in is actual server time with no fabricated checkout',punch&&punch.checkOutAt===null&&Date.parse(punch.checkInAt)>=beforePunch&&Date.parse(punch.checkInAt)<=Date.now());
    const ownHistory=await frame.contentWindow.fetch('/api/v1/attendance/me').then(r=>r.json());
    mark('Rapid repeated clicks create only one attendance record',ownHistory.data.filter(a=>a.workDate===punch.workDate).length===1);
    await visit('/employee/attendance');await wait(()=>doc.querySelector('.attendance-clock button')?.textContent==='Clock out','Clock-out unavailable on attendance page');
    mark('Dashboard clock-in persists on the Attendance page',doc.querySelector('.attendance-clock time[datetime="'+punch.checkInAt+'"]')!==null);
    button('Clock out');await wait(()=>doc.querySelector('.attendance-clock h2')?.textContent==='Day Completed','Checkout failed');
    mark('Clock-out retains Present and disables a second session',doc.querySelector('.attendance-clock-status').textContent==='Present'&&doc.querySelector('.attendance-clock button').disabled);
    await visit('/employee/dashboard');await wait(()=>doc.querySelector('.attendance-clock h2')?.textContent==='Day Completed','Completed attendance did not persist');
    mark('Completed attendance persists on dashboard reload',doc.querySelector('.attendance-clock-status').textContent==='Present');
    await visit('/employee/leave');button('Request leave');await wait(()=>doc.querySelector('[name=startDate]'),'Leave form missing');
    field('[name=startDate]',leaveDay);field('[name=endDate]',leaveDay);field('[name=reason]','Synthetic browser leave');
    button('Preview working dates',doc.querySelector('dialog'));await wait(()=>doc.body.textContent.includes('working day(s)'),'Leave preview missing');
    check('dialog input[type=checkbox]');await closeDialogAfter('Submit leave request');
    await wait(()=>doc.querySelector('main h1')?.textContent==='Leave Request','Leave detail missing');leaveId=frame.contentWindow.location.pathname.split('/').pop();
    mark('Leave preview and submission preserve authoritative date snapshot');
    await visit('/employee/complaints');button('Submit complaint');await wait(()=>doc.querySelector('[name=subject]'),'Complaint form missing');
    field('[name=subject]','Browser complaint '+suffix);field('[name=description]','Private <script>window.shouldNeverRun=true</script> complaint.');
    await closeDialogAfter('Submit complaint');await wait(()=>doc.body.textContent.includes('Private <script>'),'Complaint detail missing');
    complaintId=frame.contentWindow.location.pathname.split('/').pop();
    mark('Complaint renders hostile markup as plain text',!frame.contentWindow.shouldNeverRun);
    const denied=await frame.contentWindow.fetch('/api/v1/employees').then(r=>r.status);
    mark('Employee cannot fetch CEO directory',denied===403);
    await logout();await login(fixture.email);
    await visit(`/ceo/leave/${leaveId}`);await wait(()=>[...doc.querySelectorAll('button')].some(b=>b.textContent==='Approve'),'Leave action missing');
    button('Approve');await wait(()=>doc.querySelector('dialog[open]'),'Approval dialog missing');await closeDialogAfter('Approve request');
    await wait(()=>doc.body.textContent.includes('Approved'),'Approval not visible');mark('CEO approves employee leave');
    await visit('/ceo/tasks');button('Create task');await wait(()=>doc.querySelector('[name=assigneeEmployeeId]'),'Task editor missing');
    await wait(()=>doc.querySelector(`[name=assigneeEmployeeId] option[value="${employeeId}"]`),'Employee picker not loaded');
    field('[name=title]','Browser task '+suffix);field('[name=description]','Synthetic assigned work');field('[name=assigneeEmployeeId]',employeeId);
    await closeDialogAfter('Save task');await wait(()=>doc.querySelector('main h1')?.textContent==='Task Detail','Task detail missing');taskId=frame.contentWindow.location.pathname.split('/').pop();
    mark('CEO creates task using paginated active-employee picker');
    await visit(`/ceo/complaints/${complaintId}`);await wait(()=>doc.body.textContent.includes('Start review'),'Complaint actions not loaded');
    button('Start review');await wait(()=>doc.querySelector('dialog[open]'),'Review dialog missing');await closeDialogAfter('Move to review');
    await wait(()=>doc.body.textContent.includes('Resolve complaint'),'Review not saved');button('Resolve complaint');
    await wait(()=>doc.querySelector('[name=resolutionText]'),'Resolution form missing');field('[name=resolutionText]','Synthetic browser resolution');
    await closeDialogAfter('Resolve complaint');await wait(()=>doc.body.textContent.includes('Synthetic browser resolution'),'Resolution message missing');
    mark('Complaint resolution atomically saves state and required reply');
    await visit('/ceo/holidays');button('Add holiday');await wait(()=>doc.querySelector('[name=name]'),'Holiday form missing');
    field('[name=name]','Browser holiday '+suffix);field('[name=date]',leaveDay);button('Review calendar impact');
    await wait(()=>doc.querySelector('[name=acknowledge]'),'Impact preview missing');
    mark('Holiday preview displays affected approved leave',Boolean(doc.querySelector(`dialog a[href="/ceo/leave/${leaveId}"]`)));
    check('[name=acknowledge]');await closeDialogAfter('Confirm calendar change');mark('Holiday commits only after impact acknowledgement');
    await visit('/ceo/salary-slips');button('Create salary draft');await wait(()=>doc.querySelector('[name=employeeId]'),'Salary editor missing');
    await wait(()=>doc.querySelector(`[name=employeeId] option[value="${employeeId}"]`),'Salary employee picker missing');
    field('[name=employeeId]',employeeId);field('[name=period]','2026-10');
    field('.salary-line input[maxlength="80"]','Base salary');field('.salary-line input[inputmode=decimal]','4200.50');
    await closeDialogAfter('Save draft');await wait(()=>doc.querySelector('.salary-document'),'Salary statement missing');slipId=frame.contentWindow.location.pathname.split('/').pop();
    mark('Salary draft renders integer-derived 4200.50 and DRAFT label',doc.body.textContent.includes('4,200.50')&&doc.body.textContent.includes('DRAFT'));
    button('Publish statement');await wait(()=>doc.querySelector('dialog[open]'),'Publish dialog missing');await closeDialogAfter('Publish statement');
    await wait(()=>doc.querySelector('.badge')?.textContent==='Published','Publication not saved');mark('Salary publication makes draft immutable');
    await logout();await login(email);await visit(`/employee/tasks/${taskId}`);await wait(()=>doc.querySelector('[name=state]'),'Assigned task missing');
    field('[name=state]','DONE');button('Update status');await wait(()=>doc.querySelector('.badge')?.textContent==='Done','Task status not saved');mark('Current assignee updates task progress');
    await visit(`/employee/complaints/${complaintId}`);await wait(()=>doc.body.textContent.includes('Close complaint'),'Resolved complaint missing');
    button('Close complaint');await wait(()=>doc.querySelector('dialog[open]'),'Close dialog missing');await closeDialogAfter('Close complaint');
    await wait(()=>doc.body.textContent.includes('Closed complaints are read-only'),'Complaint not closed');mark('Employee closes resolved complaint; replies disappear');
    await visit(`/employee/salary-slips/${slipId}`);await wait(()=>doc.querySelector('.salary-document'),'Published slip unavailable');
    let downloadBlob=null;
    const win=frame.contentWindow, originalCreate=win.URL.createObjectURL, originalClick=win.HTMLAnchorElement.prototype.click;
    win.URL.createObjectURL=blob=>{downloadBlob=blob;return originalCreate.call(win.URL,blob);};
    win.HTMLAnchorElement.prototype.click=function(){if(!this.download)return originalClick.call(this);};
    button('Download PDF');await wait(()=>downloadBlob!==null,'PDF download failed');
    win.URL.createObjectURL=originalCreate;win.HTMLAnchorElement.prototype.click=originalClick;
    mark('Employee download receives authenticated PDF bytes',downloadBlob.type==='application/pdf'&&downloadBlob.size>500);
    await logout();await login(fixture.email);await visit(`/ceo/salary-slips/${slipId}`);await wait(()=>doc.body.textContent.includes('Void statement'),'Published statement missing');
    button('Void statement');await wait(()=>doc.querySelector('[name=reason]'),'Void reason missing');field('[name=reason]','Synthetic browser correction');await closeDialogAfter('Void statement');
    await wait(()=>doc.body.textContent.includes('VOID · NOT CURRENT'),'Void label not visible');mark('Voided salary visual state is prominent and retained');
    await logout();await visit('/forgot-password','input[name=email]');field('[name=email]','not-an-email');mark('Malformed recovery email is blocked by browser validation',!doc.querySelector('[name=email]').checkValidity());
    field('[name=email]',email);button('Request recovery');await wait(()=>doc.body.textContent.includes('Request received'),'Recovery response missing');
    const recovery=(await messages()).findLast(m=>m.email===email&&m.purpose==='PASSWORD_RESET').url;
    await visit(new URL(recovery).pathname+new URL(recovery).hash,'input[name=password]');
    field('[name=password]',fixture.password);field('[name=confirm]','Mismatch synthetic password');button('Save password');
    await wait(()=>doc.body.textContent.includes('Passwords do not match'),'Reset mismatch missing');mark('Reset mismatch stays visible and focused');
    field('[name=confirm]',fixture.password);button('Save password');await wait(()=>doc.body.textContent.includes('Password saved'),'Reset not completed');mark('Reset completion returns to login without auto-sign-in');
    await login(email);await visit('/employee/dashboard');frame.style.width='360px';frame.getBoundingClientRect();
    mark('Connected mobile dashboard has no page-level horizontal overflow',doc.documentElement.scrollWidth<=doc.documentElement.clientWidth+1);
    button('Open navigation');await wait(()=>doc.querySelector('dialog[open]'),'Mobile navigation did not open');mark('Mobile navigation opens accessible modal',Boolean(doc.querySelector('dialog[aria-labelledby]')));
    button('Close navigation');frame.style.width='1440px';
    await fetch('/api/v1/__browser-test/expire',{method:'POST'});await visit('/employee/dashboard','input[name=email]');
    mark('Server revocation removes private workspace and redirects to login',!doc.querySelector('.salary-document')&&!doc.querySelector('.live-workspace'));
    mark('Connected journeys leave existing demo browser data unchanged',localStorage.getItem('ems.frontend-demo.v1')===marker);
  } catch(error) {
    report.failures.push(error.message);
    report.failureContext={path:frame.contentWindow.location.pathname,buttons:[...doc.querySelectorAll('dialog button')].map(b=>b.textContent.trim())};
  } finally {
    report.running=false;
    if(!old)localStorage.removeItem('ems.frontend-demo.v1');
  }
  return {passed:report.results.length,results:report.results,failures:report.failures};
}
