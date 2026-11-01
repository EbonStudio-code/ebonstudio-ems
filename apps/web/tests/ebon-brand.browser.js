// Isolated synthetic origins only. Uses an iframe because the desktop pane owns its viewport.
export async function runEbonBrandChecks() {
  if (!['http://127.0.0.1:5184', 'http://127.0.0.1:5186'].includes(location.origin)) {
    throw new Error('Brand checks must not run against the normal workspace.');
  }
  const connected = location.port === '5186';
  const report = window.__ebonChecks = { running: true, mode: connected ? 'connected' : 'preview', results: [], failures: [] };
  const frame = document.createElement('iframe');
  frame.title = 'Ebon Studio isolated layout checks';
  frame.style.cssText = 'position:fixed;inset:0;width:1440px;height:1000px;border:0;z-index:10000;background:white';
  document.body.append(frame);
  let doc;
  const prefix = connected ? '' : '/preview';
  const mark = (ok, name) => {
    (ok ? report.results : report.failures).push(name);
  };
  function wait(predicate, name) {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error(name)); }, 12000);
      const observer = new MutationObserver(() => {
        if (predicate()) { clearTimeout(timer); observer.disconnect(); resolve(); }
      });
      observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  }
  async function visit(path, selector = 'main h1') {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Navigation failed: ${path}`)), 12000);
      frame.onload = () => { clearTimeout(timer); resolve(); };
      frame.src = location.origin + prefix + path;
    });
    doc = frame.contentDocument;
    await wait(() => doc.querySelector(selector), `Missing page: ${path}`);
    await wait(() => !doc.body.textContent.includes('Loading records'), `Records still loading: ${path}`);
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(image => image.decode().catch(() => {})));
    let animationTimeout;
    try {
      await Promise.race([
        Promise.allSettled(doc.getAnimations().filter(animation => Number.isFinite(animation.effect?.getTiming().iterations)).map(animation => animation.finished)),
        new Promise((_, reject) => { animationTimeout = setTimeout(() => reject(new Error(`Entrance animation did not settle: ${path}`)), 3000); }),
      ]);
    } finally { clearTimeout(animationTimeout); }
  }
  function click(label) {
    const button = [...doc.querySelectorAll('button')].find(el => el.textContent.trim() === label || el.getAttribute('aria-label') === label);
    if (!button) throw new Error(`Missing button: ${label}`);
    button.click();
  }
  function fill(name, value) {
    const input = doc.querySelector(`input[name="${name}"]`);
    Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new doc.defaultView.Event('input', {bubbles:true}));
  }
  function contrast(foreground, background) {
    const luminance = rgb => {
      const [r,g,b] = rgb.map(v => {const c = v/255; return c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4;});
      return .2126*r + .7152*g + .0722*b;
    };
    const a=luminance(foreground), b=luminance(background);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  }
  function checkLayout(label, width, theme) {
    const win=doc.defaultView, style=el=>win.getComputedStyle(el);
    mark(doc.documentElement.scrollWidth <= width+1, `${label}: no page overflow`);
    mark(doc.title.includes('Ebon Studio EMS'), `${label}: branded page title`);
    mark(doc.documentElement.dataset.theme === theme, `${label}: ${theme} preference retained`);
    mark(style(doc.documentElement).color === (theme==='dark'?'rgb(245, 243, 239)':'rgb(36, 35, 39)'), `${label}: readable root text`);
    mark(style(doc.documentElement).getPropertyValue('--gold').trim()==='#c9a227', `${label}: original gold preserved`);
    mark(style(doc.documentElement).getPropertyValue('--canvas').trim()===(theme==='dark'?'#0e0e10':'#f5f3ef'), `${label}: original canvas preserved`);
    mark([...doc.querySelectorAll('h1,.stat-value')].every(el=>el.scrollWidth<=el.clientWidth+1), `${label}: headings and figures fit`);
    mark([...doc.querySelectorAll('.card,.stat-card,.studio-intro,.auth-card')].filter(el=>el.getClientRects().length).every(el=>Number(style(el).opacity)===1), `${label}: content visible after entrance`);
    mark(style(doc.body).fontFamily.startsWith('"Plus Jakarta Sans"'), `${label}: body uses the local typeface`);
    const heading=doc.querySelector('h1');
    mark(Boolean(heading && style(heading).fontFamily.startsWith('"Space Grotesk"') && Number(style(heading).fontWeight)>=650), `${label}: distinct bold display heading`);
    mark([...doc.fonts].some(font=>font.family==='Space Grotesk'&&font.status==='loaded')&&[...doc.fonts].some(font=>font.family==='Plus Jakarta Sans'&&font.status==='loaded'), `${label}: actual font files decoded`);
    const logo=doc.querySelector('.brand-logo');
    mark(Boolean(logo?.complete && logo.naturalWidth && logo.alt==='Ebon Studio'), `${label}: original logo loads`);
    const selectors=['.muted','.text-link','.button.primary','.nav-item.active','.sidebar .nav-label','.field > span','.preview-pill','.stat-caption'];
    for (const selector of selectors) {
      const el=doc.querySelector(selector);
      if(!el || !el.getClientRects().length)continue;
      const foreground=style(el).color.match(/[\d.]+/g).slice(0,3).map(Number);
      let parent=el, background;
      while(parent) {
        const values=style(parent).backgroundColor.match(/[\d.]+/g)?.map(Number);
        if(values && (values.length===3 || values[3]===1)){background=values.slice(0,3);break;}
        parent=parent.parentElement;
      }
      const ratio=contrast(foreground,background||[255,255,255]);
      mark(ratio>=4.5,`${label}: ${selector} contrast ${ratio.toFixed(2)}:1`);
    }
  }
  try {
    let fixture, employeeEmail;
    if(connected) {
      fixture=await fetch('/api/v1/__browser-test/fixture').then(r=>r.json());
      const messages=await fetch('/api/v1/__browser-test/messages').then(r=>r.json());
      employeeEmail=messages.findLast(m=>m.purpose==='INVITATION')?.email;
      if(!employeeEmail)throw new Error('Run connected.browser.js first to create synthetic employee');
    }
    for(const role of ['CEO','Employee']) {
      if(connected) {
        await fetch('/api/v1/__browser-test/expire',{method:'POST'});
        await visit('/login','input[name=email]');
        fill('email',role==='CEO'?fixture.email:employeeEmail);fill('password',fixture.password);
        click('Sign in');
        await wait(()=>doc.querySelector('.live-workspace'),'Synthetic login failed');
      } else {
        sessionStorage.setItem('ems.preview-session',JSON.stringify({role,employeeId:'emp-1'}));
      }
      const base=role==='CEO'?'/ceo':'/employee';
      const pages=['dashboard',role==='CEO'?'employees':'profile','attendance','leave','tasks','complaints','holidays','salary-slips','security',...(role==='CEO'?['settings','audit']:[])];
      for(const [width,theme] of [[1440,'light'],[900,'dark'],[360,'light'],[360,'dark']]) {
        frame.style.width=`${width}px`;
        localStorage.setItem('ems.theme',theme);
        for(const page of (width===900 || (width===360&&theme==='light') ? ['dashboard'] : pages)) {
          await visit(`${base}/${page}`);
          if(page==='dashboard')await wait(()=>doc.querySelector('.stat-card'),'Dashboard data did not render');
          checkLayout(`${role} ${page} ${width}px ${theme}`,width,theme);
        }
        if(width===360) {
          click('Open navigation');
          await wait(()=>doc.querySelector('dialog[open]'),'Mobile navigation missing');
          const dialog=doc.querySelector('dialog'), rect=dialog.getBoundingClientRect();
          mark(rect.left>=0 && rect.right<=width+1,'Mobile navigation fits the viewport');
          mark(Boolean(dialog.querySelector('nav[aria-label="Main navigation"] a.active')),'Mobile navigation indicates the active page');
          click('Close navigation');
          await wait(()=>!doc.querySelector('dialog[open]'),'Navigation did not close');
        }
      }
    }
    if(connected)await fetch('/api/v1/__browser-test/expire',{method:'POST'});
    else sessionStorage.removeItem('ems.preview-session');
    for(const [width,theme] of [[1440,'light'],[1440,'dark'],[360,'light'],[360,'dark']]) {
      frame.style.width=`${width}px`;localStorage.setItem('ems.theme',theme);
      await visit('/login','.auth-card h1');
      checkLayout(`Login ${width}px ${theme}`,width,theme);
      click(theme==='dark'?'Switch to light theme':'Switch to dark theme');
      await wait(()=>doc.documentElement.dataset.theme!==theme,'Theme toggle did not respond');
      mark(localStorage.getItem('ems.theme')===doc.documentElement.dataset.theme,'Theme toggle persists its new preference');
    }
  } catch(error) {
    report.failures.push(error.message);
  } finally {
    report.running=false;
    frame.remove();
  }
  return {passed:report.results.length,failures:report.failures};
}
