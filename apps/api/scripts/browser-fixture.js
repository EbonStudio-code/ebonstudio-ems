// Isolated synthetic browser testing only. Never loads .env or uses the user's database.
import express from 'express';
import { randomUUID } from 'node:crypto';
import { isolatedPostgres } from '../tests/helpers/postgres.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/core/config.js';
import { bootstrapCeo, redeem } from '../src/modules/identity/service.js';

const fixture=await isolatedPostgres();
const origin='http://127.0.0.1:5186';
const config={...loadConfig({APP_ORIGIN:origin,RATE_LIMIT_SECRET:'synthetic-browser-check-rate-key'}),cookieName:'ems.browser-check',testRateScale:100};
const email='browser-ceo@example.test';
const password='Synthetic browser passphrase 2026!';
const bootstrap=await bootstrapCeo(fixture.pool,'Browser CEO',email);
await redeem(fixture.pool,bootstrap.token,'INVITATION',password,{requestId:randomUUID()});
const messages=[];
const mailer={async send(message){messages.push(message);}};
const outer=express();
let stopping=false;
outer.use('/api/v1/__browser-test',(req,res,next)=>{
  if(req.get('host')!=='127.0.0.1:5186'||(req.get('origin')&&req.get('origin')!==origin))return res.status(403).end();
  res.set('Cache-Control','no-store');next();
});
outer.get('/api/v1/__browser-test/fixture',(req,res)=>res.json({email,password}));
outer.get('/api/v1/__browser-test/messages',(req,res)=>res.json(messages));
outer.post('/api/v1/__browser-test/expire',async(req,res)=>{
  await fixture.admin.query('DELETE FROM sessions');res.json({ok:true});
});
outer.post('/api/v1/__browser-test/stop',(req,res)=>{res.json({ok:true});void shutdown();});
outer.use(createApp({pool:fixture.pool,config,mailer}));
const server=outer.listen(3006,'127.0.0.1',()=>console.log('Synthetic browser API ready on loopback port 3006. Use only UI origin 5186.'));
async function shutdown(){
  if(stopping)return;stopping=true;
  await new Promise(resolve=>server.close(resolve));
  await fixture.close();console.log('Synthetic browser database stopped and removed.');
}
process.on('SIGTERM',()=>void shutdown());
process.on('SIGINT',()=>void shutdown());
