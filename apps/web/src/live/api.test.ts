import { describe, expect, it, vi } from 'vitest';
import { createApi, query, tokenFromFragment } from './api';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
describe('Connected API client',()=>{
  it('Uses cookie sessions, CSRF and no-store without bearer/browser storage',async()=>{
    const mock=vi.fn<typeof fetch>().mockResolvedValueOnce(json({data:{csrfToken:'initial'}})).mockResolvedValueOnce(json({data:{csrfToken:'rotated'}})).mockResolvedValueOnce(json({data:{id:'saved'}}));
    const api=createApi(mock,()=>{});
    await api.request('/auth/login','POST',{email:'synthetic@example.test',password:'synthetic-test-only'});
    await api.request('/tasks','POST',{title:'Task'});
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls[1][1]).toMatchObject({credentials:'same-origin',cache:'no-store',headers:{'X-CSRF-Token':'initial'}});
    expect(mock.mock.calls[2][1]).toMatchObject({headers:{'X-CSRF-Token':'rotated'}});
    expect(mock.mock.calls[1][1]?.headers).not.toHaveProperty('Authorization');
  });
  it('Does not retry an ambiguous create request',async()=>{
    const mock=vi.fn<typeof fetch>().mockResolvedValueOnce(json({data:{csrfToken:'token'}})).mockRejectedValueOnce(new Error('offline'));
    const api=createApi(mock,()=>{});
    await expect(api.request('/tasks','POST',{title:'Task'})).rejects.toThrow('may have been saved');
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('Expires private state on 401 but not ordinary invalid credentials',async()=>{
    const events=vi.fn();
    const mock=vi.fn<typeof fetch>().mockResolvedValueOnce(json({error:{code:'NOT_AUTHENTICATED',message:'Sign in'}},401));
    await expect(createApi(mock,events).request('/employees/me')).rejects.toMatchObject({status:401});
    expect(events).toHaveBeenCalledWith('ems:expired');
  });
  it('Rejects in-flight private responses after clearing an account',async()=>{
    let finish!:(value:Response)=>void;
    const mock=vi.fn<typeof fetch>().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const api=createApi(mock,()=>{});
    const result=api.request('/salary-slips');
    api.clear();finish(json({data:[{id:'private'}]}));
    await expect(result).rejects.toThrow('Account changed');
  });
  it('Discards a delayed response body after the account changes',async()=>{
    let finish!:(value:unknown)=>void;
    const body=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
    const mock=vi.fn<typeof fetch>().mockResolvedValue(Object.assign(json({}),{json:body}));
    const events=vi.fn(), api=createApi(mock,events);
    const result=api.request('/salary-slips');
    await vi.waitFor(()=>expect(body).toHaveBeenCalled());
    api.clear();finish({data:[{id:'private'}]});
    await expect(result).rejects.toThrow('Account changed');
    expect(events).not.toHaveBeenCalled();
  });
  it('Does not expire the new account when an old error body arrives',async()=>{
    let finish!:(value:unknown)=>void;
    const body=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
    const mock=vi.fn<typeof fetch>().mockResolvedValue(Object.assign(json({},401),{json:body}));
    const events=vi.fn(), api=createApi(mock,events);
    const result=api.request('/employees/me');
    await vi.waitFor(()=>expect(body).toHaveBeenCalled());
    api.clear();finish({error:{code:'NOT_AUTHENTICATED'}});
    await expect(result).rejects.toThrow('Account changed');
    expect(events).not.toHaveBeenCalled();
  });
  it('Stops a mutation before sending when its account changes during CSRF preparation',async()=>{
    const mock=vi.fn<typeof fetch>().mockResolvedValueOnce(json({data:{csrfToken:'initial'}})).mockResolvedValueOnce(json({data:{csrfToken:'rotated'}}));
    const api=createApi(mock,()=>{});
    await api.request('/auth/login','POST',{});
    const result=api.request('/tasks','POST',{title:'Do not send'});
    api.clear();
    await expect(result).rejects.toThrow('Account changed');
    expect(mock).toHaveBeenCalledTimes(2);
  });
  it('Leaves initial session 401 handling to the current provider lookup',async()=>{
    const events=vi.fn(), mock=vi.fn<typeof fetch>().mockResolvedValue(json({error:{code:'NOT_AUTHENTICATED'}},401));
    await expect(createApi(mock,events).request('/auth/session')).rejects.toMatchObject({status:401});
    expect(events).not.toHaveBeenCalled();
  });
  it('Ignores a late unauthorized PDF response from a previous account',async()=>{
    let finish!:(value:Response)=>void;
    const events=vi.fn(), mock=vi.fn<typeof fetch>().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const api=createApi(mock,events), result=api.download('synthetic-slip','statement.pdf');
    api.clear();finish(json({error:{code:'NOT_AUTHENTICATED'}},401));
    await expect(result).rejects.toThrow('Account changed');
    expect(events).not.toHaveBeenCalled();
  });
  it('Treats 204 as successful logout and exposes safe server conflicts',async()=>{
    const mock=vi.fn<typeof fetch>().mockResolvedValueOnce(json({data:{csrfToken:'token'}})).mockResolvedValueOnce(new Response(null,{status:204}))
      .mockResolvedValueOnce(json({error:{code:'VERSION_CONFLICT',message:'Reload before retrying'},requestId:'trace'},409));
    const api=createApi(mock,()=>{});
    expect((await api.request('/auth/logout','POST',{})).data).toBeUndefined();
    await expect(api.request('/tasks','POST',{})).rejects.toMatchObject({status:409,code:'VERSION_CONFLICT',requestId:'trace'});
  });
  it('Encodes only supplied query values, never SQL expressions',()=>{
    expect(query('/employees',{page:2,search:"A&B '",status:''})).toBe('/employees?page=2&search=A%26B+%27');
  });
  it('Accepts setup tokens only as bounded URL fragments',()=>{
    const token='a'.repeat(43);
    expect(tokenFromFragment('#token='+token)).toBe(token);
    expect(tokenFromFragment('?token='+token)).toBe('');
    expect(tokenFromFragment('#token=demo')).toBe('');
    expect(tokenFromFragment('#token='+'a'.repeat(1000))).toBe('');
  });
  it('Shares a single CSRF request during concurrent mutations',async()=>{
    const mock=vi.fn<typeof fetch>().mockImplementation(async path=>json(String(path).endsWith('/csrf')?{data:{csrfToken:'shared'}}:{data:{saved:true}}));
    const api=createApi(mock,()=>{});
    await Promise.all([api.request('/tasks/a/status','POST',{}),api.request('/tasks/b/status','POST',{})]);
    expect(mock.mock.calls.filter(([url])=>String(url).endsWith('/csrf'))).toHaveLength(1);
  });
});
