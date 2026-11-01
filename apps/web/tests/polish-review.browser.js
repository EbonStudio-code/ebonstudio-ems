if (location.origin !== 'http://127.0.0.1:5187') throw new Error('Use only the isolated UI fixture on port 5187.');
const frame=document.querySelector('#review');
const reports=window.__polishReports=[];
function wait(doc,predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const observer=new MutationObserver(()=>{if(predicate()){observer.disconnect();clearTimeout(timer);resolve();}});
    observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
    const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Synthetic page did not become ready'));},15000);
  });
}
async function settle(doc) {
  await doc.fonts.ready;
  // The embedded pane can be hidden. Finish only the synthetic frame's finite entrances.
  for(const animation of doc.getAnimations()) if(animation.effect?.getTiming().iterations!==Infinity) animation.finish();
}
function contrast(a,b) {
  const lum=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
  const first=lum(a),second=lum(b);
  return (Math.max(first,second)+.05)/(Math.min(first,second)+.05);
}
function audit(doc) {
  const win=doc.defaultView,issues=[],pairs=new Map();
  for(const element of doc.querySelectorAll('body *')) {
    if(![...element.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const style=win.getComputedStyle(element),rect=element.getBoundingClientRect();
    if(!rect.width||!rect.height||style.visibility==='hidden'||element.closest('[aria-hidden=true],.sr-only'))continue;
    if(parseFloat(style.fontSize)<13)issues.push({type:'font-size',selector:element.className,size:style.fontSize});
    let parent=element,background='rgb(255, 255, 255)';
    while(parent){const bg=win.getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent'){background=bg;break;}parent=parent.parentElement;}
    const key=style.color+'/'+background;
    const ratio=contrast(style.color,background);
    pairs.set(key,{foreground:style.color,background,ratio:Number(ratio.toFixed(2))});
    const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
    if(ratio<(large?3:4.5)&&!element.closest(':disabled'))issues.push({type:'contrast',selector:element.className,ratio:Number(ratio.toFixed(2)),text:element.textContent.trim().slice(0,50)});
  }
  const stat=doc.querySelector('.stat-value');
  return {issues,contrastPairs:[...pairs.values()],pageOverflow:doc.documentElement.scrollWidth>win.innerWidth+1,
    minTextPx:13,statFont:stat?win.getComputedStyle(stat).fontFamily:null,
    statNumerals:stat?win.getComputedStyle(stat).fontVariantNumeric:null,
    dateCopies:doc.querySelectorAll('.today-label,.workday-strip time').length,
    tableOverflow:[...doc.querySelectorAll('.table-wrap')].some(t=>t.scrollWidth>t.clientWidth+1),
    themeLabel:doc.querySelector('.theme-toggle')?.getAttribute('aria-label'),
    removedFiller:!doc.querySelector('.workspace-label,.sidebar-monogram,.studio-intro-topline')};
}
window.polish={
  inspect() { return audit(frame.contentDocument); },
  async navigatePreview(path) {
    if (!path.startsWith('/preview/')) throw new Error('Preview routes only.');
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Preview navigation timeout')),15000);
      frame.onload=()=>{clearTimeout(timer);resolve();};frame.src=path;
    });
    const doc=frame.contentDocument;
    await wait(doc,()=>!!doc.querySelector('h1')&&!doc.querySelector('.loading-skeleton'));
    await settle(doc);
    return {path,heading:doc.querySelector('h1').textContent,...audit(doc)};
  },
  async show({page='ceo',theme='dark',width=1440,height=900,scenario='ready',preview=false}={}) {
    await fetch('/__ui-fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:page==='ceo'?'CEO':'EMPLOYEE',scenario})});
    localStorage.setItem('ems.theme',theme);
    if(preview) {
      const {createDemoData}=await import('/src/core/seed.ts');
      const data=createDemoData();
      localStorage.setItem('ems.frontend-demo.v1',JSON.stringify(data));
      sessionStorage.setItem('ems.preview-session',JSON.stringify({role:page==='ceo'?'CEO':'Employee',employeeId:'emp-1'}));
    }
    for(const element of [document.documentElement,document.body,frame]){element.style.width=width+'px';element.style.height=height+'px';}
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Frame navigation timeout')),15000);
      frame.onload=()=>{clearTimeout(timer);resolve();};
      frame.src=(preview?'/preview':'')+(page==='ceo'?'/ceo/dashboard':'/employee/attendance');
    });
    const doc=frame.contentDocument;
    await wait(doc,()=>doc.querySelector(page==='ceo'?'.stat-value':'.attendance-clock')&&!doc.querySelector('.loading-skeleton'));
    await settle(doc);
    const report={page,theme,width,height,scenario,preview,...audit(doc)};
    reports.push(report);
    return report;
  },
  async clock() {
    const doc=frame.contentDocument,button=doc.querySelector('.attendance-clock button');
    const next=button.textContent === 'Clock in' ? 'Clock out' : 'Day completed';
    doc.querySelector('.toast button')?.click();
    button.click();await wait(doc,()=>doc.querySelector('.attendance-clock button')?.textContent===next&&!!doc.querySelector('.toast'));await settle(doc);
    return {toast:doc.querySelector('.toast').textContent.trim(),role:doc.querySelector('.toast').getAttribute('role'),...audit(doc)};
  },
  async toggle() {
    const doc=frame.contentDocument;
    doc.querySelector('.theme-toggle').click();await wait(doc,()=>doc.documentElement.dataset.theme!==reports.at(-1).theme);
    return {theme:doc.documentElement.dataset.theme,label:doc.querySelector('.theme-toggle').getAttribute('aria-label')};
  },
};
