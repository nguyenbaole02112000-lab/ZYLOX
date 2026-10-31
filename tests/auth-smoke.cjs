const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mock=`
const player=()=>JSON.parse(localStorage.getItem('mock-player')||'null');
window.BaoCloud={
 profile:async()=>localStorage.getItem('mock-session')==='yes'?player():null,
 signup:async(username,email,password)=>{if(localStorage.getItem('mock-signup-error')==='yes')throw Error('{}');const u={id:'mock-id',username,displayName:username,email,isGuest:false};if(localStorage.getItem('mock-confirmation')==='yes')return {session:null,user:u};localStorage.setItem('mock-player',JSON.stringify(u));localStorage.setItem('mock-password',password);localStorage.setItem('mock-session','yes');return {session:{},user:u}},
 login:async(email,password)=>{if(player()?.email!==email||localStorage.getItem('mock-password')!==password)throw Error('Invalid credentials');localStorage.setItem('mock-session','yes')},
 logout:async()=>localStorage.removeItem('mock-session'),
 getProgress:async()=>({coin:25,candy:6,bestScores:{halloween_best_halloween_easy:4}}),
 rpc:async(name)=>name==='leaderboard'?{top:[],me:null}:name==='admin_state'?{is_admin:false,enabled:false}:{},
 client:{from:()=>({select:async()=>({data:[{entity_id:'Bat'}]})})}
};`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='test.github.io')return route.abort();
   if(url.pathname.endsWith('/supabase-client.js'))return route.fulfill({status:200,contentType:'application/javascript',body:mock});
   const filename=path.join(root,decodeURIComponent(url.pathname.replace(/^\//,''))||'index.html');
   if(!filename.startsWith(root)||!fs.existsSync(filename))return route.abort();
   return route.fulfill({status:200,contentType:path.extname(filename)==='.html'?'text/html':'application/javascript',body:fs.readFileSync(filename)});
  });
  await page.goto('https://test.github.io/index.html');
  await page.evaluate(()=>localStorage.setItem('mock-signup-error','yes'));
  await page.locator('[name=username]').fill('TestPlayer');await page.locator('[name=email]').fill('test@example.invalid');await page.locator('[name=password]').fill('testpass123');
  await page.getByRole('button',{name:'Sign Up',exact:true}).click();
  await page.getByText('The server did not respond. Please try again.').waitFor();
  assert.equal(await page.locator('[name=password]').inputValue(),'');
  await page.evaluate(()=>{localStorage.removeItem('mock-signup-error');localStorage.setItem('mock-confirmation','yes')});await page.locator('[name=password]').fill('testpass123');
  await page.getByRole('button',{name:'Sign Up',exact:true}).click();
  await page.getByText('Please confirm email link to log in the game',{exact:true}).waitFor();
  await page.getByRole('button',{name:'OK',exact:true}).click();
  assert.equal(await page.locator('[name=email]').inputValue(),'test@example.invalid');
  await page.getByRole('button',{name:'Create Account'}).click();
  await page.evaluate(()=>localStorage.removeItem('mock-confirmation'));
  await page.locator('[name=username]').fill('TestPlayer');await page.locator('[name=email]').fill('test@example.invalid');await page.locator('[name=password]').fill('testpass123');
  await page.getByRole('button',{name:'Sign Up',exact:true}).click();
  await page.waitForFunction(()=>window.ZyloxAccount.ready&&window.ZyloxAccount.isOnline);
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCoin()),25);
  await page.reload();await page.waitForFunction(()=>window.ZyloxAccount.ready&&window.ZyloxAccount.isOnline);
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCandy()),6);
  await page.evaluate(()=>window.ZyloxAccount.showAccount());await page.getByRole('button',{name:'Logout'}).click();
  await page.getByRole('button',{name:'Already have an account? Log In'}).click();
  await page.locator('[name=email]').fill('test@example.invalid');await page.locator('[name=password]').fill('testpass123');
  await page.getByRole('button',{name:'Log In',exact:true}).click();
  await page.waitForFunction(()=>window.ZyloxAccount.ready&&window.ZyloxAccount.isOnline);
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getBest('halloween_best_halloween_easy')),4);
  await page.evaluate(()=>window.ZyloxAccount.showAccount());await page.getByRole('button',{name:'Logout'}).click();
  await page.evaluate(()=>localStorage.setItem('zylox_offline_candy_test','250'));
  await page.getByRole('button',{name:'Play as Guest'}).click();
  await page.waitForFunction(()=>window.ZyloxAccount.ready&&window.ZyloxAccount.isOfflineGuest);
  await page.goto('https://test.github.io/setting.html');
  await page.waitForFunction(()=>window.ZyloxAccount.ready);
  await page.getByText('Shop',{exact:true}).click();await page.getByRole('button',{name:'One-Time Shop'}).click();
  await page.locator('#shopView .online-row').filter({hasText:'Witch'}).getByRole('button',{name:'Buy'}).click();
  await page.waitForFunction(()=>document.querySelector('#shopView').innerText.includes('0/0'));
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCandy()),50);
  await page.reload();await page.waitForFunction(()=>window.ZyloxAccount.ready&&window.BaoAdmin.state.owned.includes('Witch'));
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCandy()),50);
  await page.getByText('Inventory',{exact:true}).click();assert.match(await page.locator('#inventoryView').innerText(),/Candy\s+50/);assert.doesNotMatch(await page.locator('#inventoryView').innerText(),/Witch/);
  await page.locator('#inventoryView').getByRole('button',{name:'← Back'}).click();
  await page.getByText('Entity',{exact:true}).click();await page.locator('[data-entity="Witch"]').click();
  await page.locator('#equipBtn').click();assert.equal(await page.evaluate(()=>localStorage.getItem('zylox_entity')),'Witch');
  await page.evaluate(()=>localStorage.setItem('zylox_offline_candy_extra','500'));
  await page.locator('#entityView').getByRole('button',{name:'← Back'}).click();
  await page.getByText('Shop',{exact:true}).click();await page.getByRole('button',{name:'One-Time Shop'}).click();
  await page.locator('#shopView .online-row').filter({hasText:'Ghost Token'}).getByRole('button',{name:'Buy'}).click();
  await page.waitForFunction(()=>window.ZyloxAccount.guestGhostState().purchased);
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCandy()),50);
  await page.reload();await page.waitForFunction(()=>window.ZyloxAccount.ready);
  await page.getByText('Inventory',{exact:true}).click();await page.waitForSelector('#inventoryGhost:not([hidden])');
  await page.locator('#inventoryView').getByRole('button',{name:'← Back'}).click();
  await page.evaluate(()=>window.ZyloxAccount.findGuestGhost());
  await page.getByRole('button',{name:/Quests/}).click();await page.getByRole('button',{name:'Special'}).click();
  await page.getByRole('button',{name:'Claim',exact:true}).click();await page.waitForFunction(()=>window.BaoAdmin.state.owned.includes('Ghost'));
  await page.locator('#questView').getByRole('button',{name:'← Back'}).click();
  await page.getByText('Inventory',{exact:true}).click();assert.ok(await page.locator('#inventoryGhost').isHidden());
  await page.locator('#inventoryView').getByRole('button',{name:'← Back'}).click();
  await page.getByText('Shop',{exact:true}).click();
  const reverse=page.locator('#shopView .online-row').filter({hasText:'2 Coin'});
  await reverse.getByRole('spinbutton',{name:'Candy amount to exchange for Coin'}).fill('12');
  await reverse.getByRole('button',{name:'Exchange',exact:true}).click();
  await page.waitForFunction(()=>window.ZyloxAccount.getCoin()===24&&window.ZyloxAccount.getCandy()===38);
  await page.reload();await page.waitForFunction(()=>window.ZyloxAccount.ready);
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCoin()),24);
  assert.equal(await page.evaluate(()=>window.ZyloxAccount.getCandy()),38);
  await page.getByText('Shop',{exact:true}).click();
  const forward=page.locator('#shopView .online-row').filter({hasText:'5 Candy'});
  await forward.getByRole('spinbutton',{name:'Quantity for 5 Candy exchange'}).fill('2');
  await forward.getByRole('button',{name:'Exchange',exact:true}).click();
  await page.waitForFunction(()=>window.ZyloxAccount.getCoin()===4&&window.ZyloxAccount.getCandy()===48);
  assert.deepEqual(errors,[]);console.log('Mock auth smoke passed: signup, reload, logout, login and progress');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
