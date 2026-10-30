const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const contents=fs.readFileSync(path.resolve(__dirname,'../online-runs.js'),'utf8');
const records={},timers=[],sent=[];let failing=true,refreshFail=false,refreshes=0,synced=0;
const localStorage=new Proxy({getItem:key=>records[key]??null,setItem:(key,value)=>{records[key]=String(value)},removeItem:key=>{delete records[key]}},
 {ownKeys:()=>Reflect.ownKeys(records),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true}),get:(target,key)=>target[key]});
const status={style:{},textContent:'',hidden:true};
const document={getElementById:()=>status,createElement:()=>status,body:{appendChild(){}},addEventListener(){}};
const window={ZyloxAccount:{isOnline:true,account:{id:'owner-1'},refresh:async()=>{refreshes++;return !refreshFail}},BaoRunSynced:()=>{synced++},
 BaoCloud:{verifyRun:async(id,replay)=>{sent.push({id,replay});if(failing)throw Error('offline');return {accepted:true}}},addEventListener(){}};
const scope=vm.createContext({window,document,localStorage,setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 vm.runInContext(contents,scope);await flush();
 const run={id:'run-1',owner:'owner-1',admin:false,replay:{ticks:10,flaps:[1,10],resizes:[[4,960],[10,720]]}};
 window.BaoRuns.save(run);await flush();
 const key='baofantasy_verified_run_owner-1_run-1';
 assert.ok(records[key],'failed network request must keep replay');
 const stored=JSON.parse(records[key]);assert.deepEqual(stored.replay.flaps,[1]);assert.deepEqual(stored.replay.resizes,[[4,960]]);
 assert.match(status.textContent,/waiting to sync/i);
 window.ZyloxAccount.account.id='other';failing=false;await window.BaoRuns.sync();
 assert.ok(records[key],'other accounts cannot consume pending replay');
 window.ZyloxAccount.account.id='owner-1';refreshFail=true;await window.BaoRuns.sync();
 assert.ok(records[key],'verified replay must remain until wallet refresh succeeds');assert.equal(synced,0);
 refreshFail=false;await window.BaoRuns.sync();
 assert.equal(records[key],undefined,'successful verification clears only its own saved snapshot');
 assert.ok(refreshes>0);assert.equal(synced,1);assert.equal(sent.at(-1).id,'run-1');
 failing=true;
 for(const mechanics of [3,4]){
   const next={id:'run-'+mechanics,owner:'owner-1',admin:false,replay:{mechanics,ticks:10,flaps:[],resizes:[]}};
   window.BaoRuns.save(next);await flush();
   assert.equal(JSON.parse(records['baofantasy_verified_run_owner-1_run-'+mechanics]).replay.mechanics,mechanics,'replay version must be preserved');
 }
 console.log('Run sync passed: retry, account isolation and replay preservation');
})().catch(error=>{console.error(error);process.exitCode=1});
