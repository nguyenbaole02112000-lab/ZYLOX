'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'fantasy-server-test-'));
const base='http://[::1]:18081';
const child=spawn(process.execPath,[path.join(root,'account-server.js')],{env:{...process.env,FANTASY_DATA_DIR:data,FANTASY_HOST:'::1',PORT:'18081'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',chunk=>{logs+=chunk});child.stderr.on('data',chunk=>{logs+=chunk});
async function request(route,method='GET',payload,cookie,user){
 const headers={Origin:base};if(payload!==undefined)headers['Content-Type']='application/json';if(cookie)headers.Cookie=cookie;if(user)headers['X-Zylox-Account']=user;
 return fetch(base+route,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
}
(async()=>{
 try{
  for(let i=0;i<50&&!logs.includes('Fantasy game running');i++){if(child.exitCode!==null)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100))}
  if(!logs.includes('Fantasy game running'))throw Error('Local test server did not start');
  const guest=await request('/api/account/guest','POST',{});assert.equal(guest.status,200);
  const account=(await guest.json()).account,cookie=guest.headers.get('set-cookie').split(';')[0];assert.equal(account.isGuest,true);
  const item={delta:1,operationId:'fixture-op'};
  assert.equal((await request('/api/progress/candy','POST',item,cookie,account.id)).status,200);
  assert.equal((await request('/api/progress/candy','POST',item,cookie,account.id)).status,200);
  const progress=await (await request('/api/progress','GET',undefined,cookie,account.id)).json();assert.equal(progress.progress.candy,1);
  for(const file of ['/online-ui.js','/online-runs.js','/game-replay.js','/admin.js'])assert.equal((await request(file)).status,200);
  console.log('Local account server passed: guest login, idempotent Candy and new script delivery');
 }finally{child.kill()}
})().catch(error=>{console.error(error);process.exitCode=1});
