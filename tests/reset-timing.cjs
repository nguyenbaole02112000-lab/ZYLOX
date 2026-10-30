const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'halloween.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const replayScope={};vm.runInNewContext(fs.readFileSync(path.join(root,'game-replay.js'),'utf8'),replayScope);
let now=0;const saves=[],messages=[];
const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},
 {get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>(target[key]=value,true)});
const canvas={clientWidth:960,clientHeight:540,getContext:()=>ctx,addEventListener(){}};
const elem={style:{},textContent:'',appendChild(){}};
const document={getElementById:id=>id==='gameCanvas'?canvas:elem,querySelector:()=>elem,addEventListener(){},createElement:()=>({style:{}})};
const localStorage={getItem:key=>key==='zylox_entity'?'Bat':null,setItem(){}};
const window={devicePixelRatio:1,location:{},addEventListener(){},BaoReplay:replayScope.BaoReplay,
 ZyloxAccount:{ready:true,isOnline:true,account:{id:'fixture'},getCandy:()=>0,getBest:()=>0,addCandy(){},saveBest(){}},
 BaoCloud:{rpc:async()=>({id:'run',seed:12345,admin_mode:false,started_at:'2026-01-01T16:59:55Z',server_time:'2026-01-01T16:59:55Z',quest_cutoff_at:'2026-01-01T17:00:00Z'})},
 BaoRuns:{save(run){saves.push(JSON.parse(JSON.stringify(run)))},notice(text){messages.push(text)}}};
const scope=vm.createContext({document,window,localStorage,Math,performance:{now:()=>now},requestAnimationFrame(){},Number,Array});
(async()=>{
 vm.runInContext(source,scope);await vm.runInContext('beginGame()',scope);
 vm.runInContext('flap();flap();flap()',scope);
 assert.equal(vm.runInContext('onlineRun.replay.flaps.length',scope),1,'multiple inputs in one tick must not invalidate replay');
 for(let i=0;i<300;i++){
  now+=1000/60;
  if(vm.runInContext("state==='playing'&&cr.y>282&&cr.vy>0",scope))vm.runInContext('flap()',scope);
  vm.runInContext(`gameLoop(${now})`,scope);
 }
 assert.equal(vm.runInContext('state',scope),'ready');
 assert.ok(saves.length>0,'must persist progress at reset');
 assert.ok(saves.at(-1).replay.ticks<=300,'must stop before server cutoff');
 assert.ok(messages.some(text=>text.includes('reset soon')));
 console.log('Reset timing passed: server deadline stops the run and saves its replay');
})().catch(error=>{console.error(error);process.exitCode=1});
