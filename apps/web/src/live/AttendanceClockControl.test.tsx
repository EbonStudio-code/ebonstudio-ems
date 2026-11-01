import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AttendanceClockControl, { submitClockAction } from './AttendanceClockControl';
import type { Attendance, CurrentAttendance } from './types';

const mock = vi.hoisted(() => ({
  request: vi.fn(), resource: vi.fn(), ceo:false, enabled:true,
  current:{nextAction:'CHECK_IN',openRecord:null,todayRecord:null} as CurrentAttendance,
  loading:false, error:undefined as unknown,
}));
vi.mock('./api', async importOriginal => ({...await importOriginal<typeof import('./api')>(),api:{request:mock.request}}));
vi.mock('./state', () => ({
  useSession: () => ({ceo:mock.ceo,session:{enabledModules:mock.enabled ? ['attendance'] : []},
    company:{timezone:'Asia/Kolkata'},base:'/employee',refresh:vi.fn(),notify:vi.fn()}),
  useResource: (path: string | null) => {mock.resource(path);return {result:mock.loading || mock.error ? undefined : {data:mock.current},loading:mock.loading,error:mock.error};},
}));
const render = () => renderToStaticMarkup(<MemoryRouter><AttendanceClockControl history /></MemoryRouter>);
const row = {id:'attendance-1',version:4,workDate:'2026-11-02',checkInAt:'2026-11-02T03:30:12Z',checkOutAt:null,state:'OPEN'} as Attendance;
beforeEach(() => {
  mock.request.mockReset();mock.resource.mockClear();
  mock.ceo=false;mock.enabled=true;mock.loading=false;mock.error=undefined;
  mock.current={nextAction:'CHECK_IN',openRecord:null,todayRecord:null};
});

describe('live employee clock control', () => {
  it('loads current server state and offers clock-in without a time input', () => {
    const html=render();
    expect(mock.resource).toHaveBeenCalledWith('/attendance/me/current');
    expect(html).toContain('>Clock in</button>');
    expect(html).not.toContain('<input');
    expect(html).toContain('View attendance history');
  });
  it.each(['loading','error'])('offers no action while %s', mode => {
    mock.loading=mode==='loading';mock.error=mode==='error' ? new Error('Synthetic failure') : undefined;
    expect(render()).not.toContain('>Clock in</button>');
  });
  it.each(['ceo','disabled'])('does not fetch current attendance for %s', mode => {
    mock.ceo=mode==='ceo';mock.enabled=mode!=='disabled';
    expect(render()).toBe('');
    expect(mock.resource).toHaveBeenCalledWith(null);
  });
  it('sends no client timestamp or chosen employee with clock-in', async () => {
    await submitClockAction(mock.current);
    expect(mock.request).toHaveBeenCalledExactlyOnceWith('/attendance/check-in','POST',{});
  });
  it('sends the owning open record and its version with clock-out', async () => {
    await submitClockAction({nextAction:'CHECK_OUT',openRecord:row,todayRecord:row});
    expect(mock.request).toHaveBeenCalledExactlyOnceWith('/attendance/check-out','POST',{attendanceId:'attendance-1',version:4});
  });
  it.each(['NOT_STARTED','CEO_CORRECTION_REQUIRED','COMPLETE','UNKNOWN','CHECK_OUT'])('does not submit blocked state %s', async nextAction => {
    await expect(submitClockAction({nextAction,openRecord:null,todayRecord:null})).rejects.toThrow('Refresh');
    expect(mock.request).not.toHaveBeenCalled();
  });
  it('does not mask a rejected server request as success', async () => {
    mock.request.mockRejectedValueOnce(new Error('Synthetic offline failure'));
    await expect(submitClockAction(mock.current)).rejects.toThrow('Synthetic offline failure');
  });
});
