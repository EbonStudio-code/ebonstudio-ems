// Run on /employee/leave at the DB-free polish fixture, never the normal app.
// Reset /__ui-fixture to {role:'EMPLOYEE'} before opening the page.
export async function runLeaveCancelChecks() {
  if (location.origin !== 'http://127.0.0.1:5188' || location.pathname !== '/employee/leave') {
    throw new Error('Isolated Leave UI fixture required.');
  }
  const results=window.__leaveCancelChecks=[];
  const check=(name,condition,details)=>results.push({name,passed:Boolean(condition),...(details ? {details} : {})});
  const wait=predicate=>new Promise((resolve,reject)=>{
    if(predicate()){resolve();return;}
    const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}});
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Leave dialog did not settle'));},10000);
  });
  const dialog=()=>document.querySelector('dialog[open]');
  const button=(text,root=document)=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
  const opener=()=>button('Request leave');
  const requests=async()=> {
    const response=await fetch('/__ui-fixture');
    if(!response.ok)throw new Error('Fixture inspection failed.');
    const {data}=await response.json();
    if(!data.synthetic)throw new Error('Synthetic fixture required.');
    return data.leaveRequests;
  };
  const open=async()=>{
    if(document.querySelector('dialog'))throw new Error('Expected Leave dialog to be unmounted.');
    opener().focus();opener().click();
    await wait(()=>!!dialog()?.querySelector('[name="reason"]'));
  };
  const preview=async()=>{
    await open();
    const form=dialog().querySelector('form');
    const date=new Date(form.elements.startDate.min+'T12:00:00Z');
    date.setUTCDate(date.getUTCDate()+7+(8-date.getUTCDay())%7);
    const workDate=date.toISOString().slice(0,10);
    for(const [name,value] of Object.entries({type:'Sick',startDate:workDate,endDate:workDate,reason:'Synthetic Cancel regression, do not save.'})) {
      const field=form.elements[name];field.value=value;
      field.dispatchEvent(new Event('input',{bubbles:true}));
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(!form.checkValidity())throw new Error('Synthetic Leave inputs are invalid.');
    button('Preview working dates',dialog()).click();
    await wait(()=>!!button('Submit leave request',dialog()||document)&&!dialog()?.querySelector('fieldset').disabled);
    check('Preview shows the selected working date',dialog().textContent.includes(workDate)&&!dialog().querySelector('[name="reason"]'));
  };
  const closePreview=async mode=>{
    if(mode==='Cancel')button('Cancel',dialog()).click();
    else if(mode==='Close button')dialog().querySelector('[aria-label="Close dialog"]').click();
    else dialog().dispatchEvent(new Event('cancel',{cancelable:true}));
    await wait(()=>!dialog()||!!dialog().querySelector('[name="startDate"]'));
    const remaining=dialog();
    check(`${mode} unmounts the preview dialog instead of showing a blank form`,!document.querySelector('dialog'),
      remaining ? {startDate:remaining.querySelector('[name="startDate"]')?.value,endDate:remaining.querySelector('[name="endDate"]')?.value,reason:remaining.querySelector('[name="reason"]')?.value} : undefined);
    results.push({name:`${mode} focus return`,observed:document.activeElement===opener(),
      note:'Programmatic observation only; native keyboard/focus-return acceptance is separate.'});
    // Allow pre-fix evidence to finish without leaving an unsaved dialog open.
    if(remaining){remaining.querySelector('[aria-label="Close dialog"]').click();await wait(()=>!document.querySelector('dialog'));}
  };
  await wait(()=>!!opener()&&!document.querySelector('.loading-skeleton'));
  if((await requests()).some(r=>r.method==='POST'))throw new Error('Reset the fixture before running Leave checks.');
  await open();
  button('Cancel',dialog()).click();
  await wait(()=>!document.querySelector('dialog'));
  check('Initial-form Cancel closes without previewing',!(await requests()).some(r=>r.method==='POST'));
  for(const mode of ['Cancel','Close button','Dialog cancel event','Cancel']) {
    await preview();
    await closePreview(mode);
  }
  await open();
  check('Explicit reopen starts a fresh request',!dialog().querySelector('[name="startDate"]').value&&!dialog().querySelector('[name="endDate"]').value&&!dialog().querySelector('[name="reason"]').value);
  button('Cancel',dialog()).click();
  await wait(()=>!document.querySelector('dialog'));
  const log=await requests();
  check('Four previews were exercised',log.filter(r=>r.method==='POST'&&r.path==='/leave/preview').length===4);
  check('No cancellation submitted or changed a leave record',!log.some(r=>r.method!=='GET'&&r.path!=='/leave/preview'));
  if(results.some(result=>result.passed===false))throw new Error('Leave Cancel regression failed; inspect window.__leaveCancelChecks.');
  return results;
}
