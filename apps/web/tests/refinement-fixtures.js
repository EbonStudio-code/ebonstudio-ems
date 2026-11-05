// Browser-only fixtures. All API calls and storage writes stay in this disposable frame.
export async function installFixtures({role='CEO',scenario='populated',theme='dark',path,preview=false}={}) {
  if (location.origin !== 'http://127.0.0.1:5188' || location.pathname !== '/tests/refinement-frame.html') {
    throw new Error('Refinement fixtures require the isolated Ebon UI server on port 5188.');
  }
  const storage = () => {
    const values = new Map();
    return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),
      removeItem:key=>values.delete(key),clear:()=>values.clear(),key:index=>[...values.keys()][index]??null,
      get length(){return values.size;}};
  };
  Object.defineProperty(window,'localStorage',{value:storage()});
  Object.defineProperty(window,'sessionStorage',{value:storage()});
  localStorage.setItem('ems.theme',theme);
  const timezone='Asia/Kolkata';
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const shift=offset=>new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
  const populated=scenario==='populated';
  const employee={id:'synthetic-employee',userId:'synthetic-user',fullName:'aLEX McKay',email:'employee@example.test',
    employeeCode:'SYN-001',jobTitle:'Designer',department:'Studio',startDate:'2020-01-01',phone:'',
    employmentStatus:'ACTIVE',accountStatus:'ACTIVE',version:0};
  const modules=scenario==='disabled' ? [] : ['attendance','leave','tasks','complaints','holidays','salary-slips'];
  const currentRecord={id:'synthetic-attendance',employeeId:employee.id,workDate:day,checkInAt:day+'T03:30:00Z',
    checkOutAt:null,state:'OPEN',version:0,durationSeconds:null,nonWorkingDayFlag:false,approvedLeaveFlag:false};
  let punch=scenario==='open' || scenario==='complete' ? {...currentRecord} : null;
  if(scenario==='complete') punch={...punch,state:'CLOSED',checkOutAt:day+'T11:30:00Z',durationSeconds:28800};
  if(scenario==='stale') punch={...currentRecord,workDate:shift(-2),checkInAt:shift(-2)+'T03:30:00Z'};
  const requestLog=[],pending=[];
  window.__refinementFixture={requests:requestLog,release:()=>{
    pending.splice(0).forEach(resolve=>resolve());
    delete document.documentElement.dataset.fixturePending;
  }};
  const wait=signal=>new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException('Aborted','AbortError'));
    if(signal?.aborted)return abort();
    signal?.addEventListener('abort',abort,{once:true});
    pending.push(()=>{signal?.removeEventListener('abort',abort);resolve();});
    document.documentElement.dataset.fixturePending='true';
  });
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.origin);
    if(url.origin!==location.origin)throw Error('External request blocked by synthetic fixture');
    const route=url.pathname.replace('/api/v1','');
    requestLog.push({path:route,method:options.method||'GET'});
    const send=(data,pagination)=>new Response(JSON.stringify({data,...(pagination?{pagination}:{})}),{status:200,headers:{'Content-Type':'application/json'}});
    const error=message=>new Response(JSON.stringify({error:{code:'SYNTHETIC_UNAVAILABLE',message}}),{status:503,headers:{'Content-Type':'application/json'}});
    if(route==='/__ui-fixture')return send({synthetic:true,leaveRequests:requestLog.filter(r=>r.path.startsWith('/leave/'))});
    if(route==='/auth/session')return send({userId:role==='CEO'?'synthetic-ceo':employee.userId,role,email:'person@example.test',
      displayName:role==='CEO'?'Studio Owner':employee.fullName,employee:role==='CEO'?null:employee,enabledModules:modules,
      expiresAt:new Date(Date.now()+3600000).toISOString(),absoluteExpiresAt:new Date(Date.now()+7200000).toISOString()});
    if(route==='/company')return send({displayName:'Ebon Studio',legalName:'Synthetic Studio',statementAddress:'Synthetic address',
      timezone,workingWeekdays:[1,2,3,4,5],currencyCode:'INR',currencyMinorUnit:2,leaveTypes:['Annual','Sick'],
      salaryPublicationEnabled:false,salaryJurisdiction:'',version:0});
    if(route==='/auth/csrf')return send({csrfToken:'synthetic-only'});
    if(route==='/dashboard') {
      if(scenario==='loading')await wait(options.signal);
      if(scenario==='error')return error('Dashboard could not be loaded. Try again.');
      const common={date:day,timezone,workingDay:true,...(role==='CEO'?{employees:{activeCount:12}}:{})};
      if(scenario==='disabled')return send(common);
      return send({...common,
        attendance:role==='CEO'?{checkedIn:9,currentlyOpen:populated?11:9,staleOpen:populated?2:0,notCheckedIn:3,
          notCheckedInEmployees:[employee,{id:'second',fullName:'Robin Example'},{id:'third',fullName:'Sam Example'}]}:punch?[punch]:[],
        tasks:{unfinished:scenario==='empty'?0:populated?6:1,overdue:populated?2:0,work:scenario==='empty'?[]:[
          {id:'task-1',title:'iOS and API v2: review eBay',state:'TODO',dueDate:populated?shift(-2):null},
          ...(populated?[{id:'task-2',title:'Prepare the studio handover and client review notes',state:'IN_PROGRESS',dueDate:shift(-1)},
            {id:'task-3',title:'Review '+ 'averylongunbrokenclientreference'.repeat(4),state:'TODO',dueDate:shift(3)}]:[])]},
        leave:{pending:populated?3:0,approvedToday:populated?1:0,nextApproved:null,upcoming:populated?
          [{id:'leave-1',startDate:shift(2),endDate:shift(3),state:'PENDING'},{id:'leave-2',startDate:shift(5),endDate:shift(5),state:'APPROVED'}]:[]},
        holidays:populated?[{id:'holiday-1',name:'Studio recharge day',date:shift(8)}]:[],
        complaints:{unresolved:populated?2:0,open:populated?2:0,inReview:0,resolved:0,closed:0},
        salarySlips:{drafts:role==='CEO'&&populated?2:0,published:populated?10:0,latestPublished:populated?{id:'slip-1',period:day.slice(0,7),revision:1}:null}});
    }
    if(route==='/attendance/me/current') {
      if(scenario==='clock-error')return error('Attendance could not be loaded. Try again.');
      if(scenario==='clock-loading')await wait(options.signal);
      return send({openRecord:punch?.state==='OPEN'?punch:null,todayRecord:scenario==='stale'?null:punch,
        nextAction:scenario==='not-started'?'NOT_STARTED':scenario==='stale'?'CEO_CORRECTION_REQUIRED':punch?punch.state==='OPEN'?'CHECK_OUT':'COMPLETE':'CHECK_IN'});
    }
    if(route==='/attendance/check-in') {
      if(scenario==='clock-busy')await wait(options.signal);
      punch={...currentRecord};return send(punch);
    }
    if(route==='/attendance/check-out') {punch={...punch,state:'CLOSED',checkOutAt:day+'T11:30:00Z',durationSeconds:28800};return send(punch);}
    if(route==='/attendance/me') {
      if(scenario==='error')return error('Attendance history could not be loaded. Try again.');
      return send(punch?[punch]:[],{page:1,limit:Number(url.searchParams.get('limit')||20),total:punch?1:0});
    }
    if(route==='/leave/preview') {
      if(scenario==='preview-busy')await wait(options.signal);
      if(scenario==='preview-error')return error('Could not preview leave. Try again.');
      const input=JSON.parse(options.body);
      return send({workingDatesSnapshot:[input.startDate],dayCount:1});
    }
    if(['/leave/requests','/salary-slips','/employees','/tasks'].includes(route)&&(!options.method||options.method==='GET'))return send([],{page:1,limit:20,total:0});
    throw Error('Unprovided synthetic endpoint: '+route);
  };
  if(preview) {
    const {createDemoData}=await import('/src/core/seed.ts');
    const data=createDemoData();
    if(scenario==='empty') { data.tasks=[];data.leaves=[];data.holidays=[];data.slips=[];data.complaints=[];data.attendance=[]; }
    localStorage.setItem('ems.frontend-demo.v1',JSON.stringify(data));
    sessionStorage.setItem('ems.preview-session',JSON.stringify({role:role==='CEO'?'CEO':'Employee',employeeId:'emp-1'}));
  }
  history.replaceState(null,'',path||`${preview?'/preview':''}/${role==='CEO'?'ceo':'employee'}/dashboard`);
}
