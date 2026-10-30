const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8080/index.html?auth=cloud');
  await page.getByRole('button',{name:'Sign Up',exact:true}).waitFor();
  const result=await page.evaluate(async()=>{
   const board=await BaoCloud.client.rpc('leaderboard',{map_key:'Halloween',difficulty_key:'Easy'});
   const start=await BaoCloud.client.rpc('start_game',{map_key:'Halloween',difficulty_key:'Easy',entity_key:'Bat',fps:60,width_value:960});
   const edge=await fetch('https://ssookklwziszwbigatpw.supabase.co/functions/v1/verify-run',{method:'POST',headers:{apikey:'sb_publishable_6E2DNaA6ENIBAUKmtXZxFg_ajRyvuoz','content-type':'application/json'},body:'{}'});
   return {boardError:board.error?.message,board:board.data,startError:!!start.error,edgeStatus:edge.status};
  });
  assert.equal(result.boardError,undefined);assert.ok(Array.isArray(result.board.top));
  assert.equal(result.startError,true);assert.equal(result.edgeStatus,401);
  await page.getByRole('button',{name:'Play as Guest'}).click();await page.waitForFunction(()=>ZyloxAccount.ready&&ZyloxAccount.account.isGuest);
  await page.reload();await page.waitForFunction(()=>ZyloxAccount.ready&&ZyloxAccount.account.isGuest);
  assert.deepEqual(errors,[]);
  console.log('Live public API passed: leaderboard read, unauthenticated game and Edge denied, guest reload');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
