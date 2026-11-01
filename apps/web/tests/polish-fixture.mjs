// UI-only synthetic fixture. No database, real account, mailer, or API proxy.
// Run from apps/web: node tests/polish-fixture.mjs
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 5187;
const timezone = 'Asia/Kolkata';
const day = () => new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let role = 'CEO', scenario = 'ready', punch = null;
let historyRequests = [];
let leaveRequests = [];
const person = () => ({
  id:'sample-employee',userId:'sample-user',fullName:'Sample employee',email:'employee@example.test',
  employeeCode:'SAMPLE-001',jobTitle:'Designer',department:'Studio',startDate:scenario === 'not-started' ? '2099-01-01' : '2020-01-01',
  phone:'',employmentStatus:'ACTIVE',accountStatus:'ACTIVE',version:0,
});
function record() {
  const localDay = day();
  return {id:'sample-attendance',employeeId:'sample-employee',workDate:localDay,
    checkInAt:new Date(localDay+'T09:00:00+05:30').toISOString(),checkOutAt:null,state:'OPEN',version:0,
    nonWorkingDayFlag:false,approvedLeaveFlag:false,currentApprovedLeaveOverlap:false,durationSeconds:null};
}
const plugin = {
  name:'isolated-ui-fixture',
  configureServer(server) {
    server.middlewares.use(async (req,res,next) => {
      if (!req.url?.startsWith('/api/') && !req.url?.startsWith('/__ui-fixture')) return next();
      if (req.headers.host !== `127.0.0.1:${port}`) {res.statusCode=403;res.end();return;}
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
      const url = new URL(req.url,`http://127.0.0.1:${port}`);
      const send = (data, pagination) => res.end(JSON.stringify({data,...(pagination ? {pagination} : {})}));
      if (url.pathname === '/__ui-fixture' && req.method === 'POST') {
        let raw='';for await (const chunk of req) raw+=chunk;
        const input=JSON.parse(raw);
        role=input.role === 'EMPLOYEE' ? 'EMPLOYEE' : 'CEO';
        scenario=input.scenario || 'ready';punch=null;historyRequests=[];leaveRequests=[];
        if (scenario === 'open' || scenario === 'complete') punch=record();
        if (scenario === 'complete') punch={...punch,state:'CLOSED',checkOutAt:new Date(day()+'T17:00:00+05:30').toISOString(),durationSeconds:28800,version:1};
        return send({synthetic:true,role,scenario});
      }
      if (url.pathname === '/__ui-fixture' && req.method === 'GET') return send({synthetic:true,historyRequests,leaveRequests});
      const path=url.pathname.replace('/api/v1','');
      if (path.startsWith('/leave/')) leaveRequests.push({method:req.method,path});
      if (path === '/leave/requests' && req.method === 'GET') return send([],{page:1,limit:20,total:0});
      if (path === '/leave/preview' && req.method === 'POST') {
        let raw='';for await (const chunk of req) raw+=chunk;
        const input=JSON.parse(raw);
        // One synthetic day for dialog tests, not a working-date rule implementation.
        return send({workingDatesSnapshot:[input.startDate],dayCount:1});
      }
      if (path === '/auth/session') return send({
        userId:role === 'CEO' ? 'sample-ceo' : 'sample-user',role,email:role === 'CEO' ? 'ceo@example.test' : 'employee@example.test',
        displayName:role === 'CEO' ? 'Studio owner' : 'Sample employee',employee:role === 'CEO' ? null : person(),
        enabledModules:['attendance','leave','tasks','complaints','holidays','salary-slips'],
        expiresAt:new Date(Date.now()+3600000).toISOString(),absoluteExpiresAt:new Date(Date.now()+7200000).toISOString(),
      });
      if (path === '/company') return send({displayName:'Ebon Studio',legalName:'',statementAddress:'',timezone,
        workingWeekdays:[1,2,3,4,5],currencyCode:'INR',currencyMinorUnit:2,leaveTypes:['Annual','Sick'],
        salaryPublicationEnabled:false,salaryJurisdiction:'',version:0});
      if (path === '/dashboard') return send({
        date:day(),timezone,workingDay:false,employees:{activeCount:1},
        attendance:{checkedIn:1,currentlyOpen:1,staleOpen:0,notCheckedIn:0,notCheckedInEmployees:[]},
        leave:{pending:0,approvedToday:0,upcoming:[],nextApproved:null},
        tasks:{unfinished:1,overdue:0,work:[{id:'sample-task',title:'Review the weekly plan',state:'TODO',dueDate:null}]},
        complaints:{unresolved:0,open:0,inReview:0,resolved:0,closed:0},
        holidays:[],salarySlips:{drafts:0,published:0,latestPublished:null},
      });
      if (path === '/attendance/me/current') return send({
        openRecord:punch?.state === 'OPEN' ? punch : null,todayRecord:punch,
        nextAction:scenario === 'not-started' ? 'NOT_STARTED' : punch ? punch.state === 'OPEN' ? 'CHECK_OUT' : 'COMPLETE' : 'CHECK_IN',
      });
      if (path === '/attendance/me') {
        historyRequests.push(url.search);
        const previous = new Date(Date.parse(day()+'T12:00:00Z')-86400000).toISOString().slice(0,10);
        const closed = date => ({...record(),id:'sample-'+date,workDate:date,checkInAt:date+'T03:30:00.000Z',checkOutAt:date+'T11:30:00.000Z',state:'CLOSED',durationSeconds:28800});
        let history=scenario === 'empty' || scenario === 'not-started' ? [] : [closed(previous),...(punch ? [punch] : [])];
        // Synthetic future dates deliberately stress full-month totals (>20 rows).
        if (scenario === 'many') history=Array.from({length:28},(_,i)=>closed(day().slice(0,8)+String(i+1).padStart(2,'0')));
        const from=url.searchParams.get('from'),to=url.searchParams.get('to'),state=url.searchParams.get('state');
        history=history.filter(r=>(!from||r.workDate>=from)&&(!to||r.workDate<=to)&&(!state||r.state===state)).sort((a,b)=>b.workDate.localeCompare(a.workDate));
        const page=Number(url.searchParams.get('page')||1),limit=Math.min(100,Number(url.searchParams.get('limit')||20));
        return send(history.slice((page-1)*limit,page*limit),{page,limit,total:history.length});
      }
      if (path === '/auth/csrf') return send({csrfToken:'synthetic-ui-token'});
      if (path === '/attendance/check-in' && req.method === 'POST') {
        punch={...record(),checkInAt:new Date().toISOString()};return send(punch);
      }
      if (path === '/attendance/check-out' && req.method === 'POST' && punch) {
        punch={...punch,state:'CLOSED',checkOutAt:new Date().toISOString(),version:1,durationSeconds:Math.floor((Date.now()-Date.parse(punch.checkInAt))/1000)};return send(punch);
      }
      res.statusCode=404;res.end(JSON.stringify({error:{code:'SYNTHETIC_ONLY',message:'This UI fixture does not provide that endpoint.'}}));
    });
  },
};
const server=await createServer({configFile:false,root,plugins:[plugin,react()],
  cacheDir:'../../tmp/vite-polish-phase1',
  server:{host:'127.0.0.1',port,strictPort:true},
  optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','react-router-dom','lucide-react','zod']},
});
await server.listen();server.printUrls();
