import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Attendance from './Attendance';

const mock=vi.hoisted(()=>({paths:[] as (string|null)[],ceo:false,total:0,error:undefined as unknown}));
vi.mock('./AttendanceClockControl',()=>({default:()=> <div>Clock control</div>}));
vi.mock('./state',()=>({
  useSession:()=>({ceo:mock.ceo,base:mock.ceo?'/ceo':'/employee',company:{timezone:'Asia/Kolkata'},refresh:()=>{},notify:()=>{}}),
  useResource:(path:string|null)=>{
    mock.paths.push(path);
    if (!path) return {loading:false};
    if(path.includes('limit=100')&&mock.error) return {loading:false,error:mock.error};
    return {loading:false,result:{data:[],pagination:{page:1,limit:path.includes('limit=100')?100:20,total:path.includes('limit=100')?mock.total:0}}};
  },
}));
const render=()=>renderToStaticMarkup(<MemoryRouter><Attendance /></MemoryRouter>);
beforeEach(()=>{mock.paths=[];mock.ceo=false;mock.total=0;mock.error=undefined;});
describe('live attendance history',()=>{
  it('requests a complete, unfiltered month separately from the 20-row history',()=>{
    render();
    const month=mock.paths.find(p=>p?.includes('limit=100'))!;
    expect(month).toContain('/attendance/me?');
    expect(month).toContain('from=');expect(month).toContain('to=');expect(month).not.toContain('state=');
    expect(mock.paths.some(p=>p?.includes('limit=20'))).toBe(true);
  });
  it('never treats an incomplete month response as a complete summary',()=>{
    mock.total=31;
    const html=render();
    expect(html).toContain('The full month could not be loaded');
    expect(html).not.toContain('Days present');
  });
  it('does not replace failed monthly totals with zero',()=>{
    mock.error=new Error('Synthetic summary failure');
    const html=render();
    expect(html).toContain('Synthetic summary failure');
    expect(html).not.toContain('Days present');
  });
  it('shows a true empty month with friendly copy and no empty table',()=>{
    const html=render();
    expect(html).toContain('Times are shown in India time.');
    expect(html).toContain('Days present');expect(html).not.toContain('<table');
    expect(html).not.toMatch(/no payroll|server time|One daily session/);
  });
  it('does not request personal monthly totals for the CEO',()=>{
    mock.ceo=true;render();
    expect(mock.paths.some(p=>p?.includes('/attendance/me'))).toBe(false);
  });
});
