(() => {
  'use strict';
  const cloud=window.BaoCloud;
  const style=document.createElement('style');
  style.textContent=`
    .coin-balance{position:absolute;top:3.5cqw;right:11cqw;z-index:10;padding:.6cqw 1.2cqw;border:.15cqw solid #d6aa42;border-radius:99cqw;color:#ffe287;background:rgba(10,6,18,.8);font:bold 1.5cqw Cinzel,serif;white-space:nowrap}
    .leaderboard-preview{position:absolute;top:18cqw;left:3cqw;width:21cqw;max-height:30cqw;z-index:10;display:flex;flex-direction:column;gap:.4cqw;padding:.8cqw;border:.15cqw solid #6b4fa0;border-radius:.8cqw;background:rgba(20,10,36,.9);color:#e0c8ff;font-size:1.1cqw}
    .leaderboard-open{padding:.2cqw;border:0;background:transparent;color:#f7d51d;font:bold 1.3cqw Cinzel,serif;cursor:pointer;text-align:left}.leaderboard-preview p{color:#bda9dc;font-size:1cqw}.leaderboard-preview-list{min-height:0;overflow-y:auto;overscroll-behavior:contain;cursor:pointer;scrollbar-width:thin;scrollbar-color:#8a5cff transparent}.leaderboard-preview-list .leaderboard-row{grid-template-columns:2.3cqw minmax(0,1fr) 2.6cqw;padding:.45cqw .1cqw}
    .leaderboard-overlay{position:absolute;inset:0;z-index:120;background:rgba(10,6,18,.9);display:flex;align-items:center;justify-content:center}.leaderboard-overlay[hidden]{display:none}
    .leaderboard{width:55cqw;max-height:48cqw;display:flex;flex-direction:column;gap:.7cqw;border:.2cqw solid #6b4fa0;border-radius:1cqw;background:#1b1032;color:#e0c8ff;padding:1.5cqw;font-size:1.4cqw;box-shadow:0 0 3cqw rgba(138,92,255,.4)}
    .leaderboard h2{font:900 2cqw Cinzel,serif;color:#f7d51d;text-align:center}.leaderboard p{text-align:center}.leaderboard-list{overflow-y:auto;min-height:0;max-height:30cqw}.leaderboard-row{display:grid;grid-template-columns:4cqw minmax(0,1fr) 5cqw;gap:.5cqw;align-items:center;padding:.7cqw;border-bottom:1px solid rgba(183,148,246,.15)}
    .leaderboard-close{align-self:center;padding:.6cqw 1.3cqw;border:1px solid #8a5cff;border-radius:8px;background:#382258;color:#fff;font-weight:bold;cursor:pointer}
    .leaderboard-rewards{color:#ffe287;text-align:center;font-size:.9em}.leaderboard-reset{color:#cbb3eb;text-align:center;font-size:.85em}
    .leaderboard-row span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.leaderboard-row span:last-child{text-align:right}.leaderboard-me{color:#ffe287}
    .online-view{position:absolute;inset:4px 25px 8px;display:none;flex-direction:column;gap:7px;z-index:3;color:#e0c8ff;min-height:0;animation:fadeIn .3s ease}
    .online-view.show{display:flex}.online-heading{font:900 clamp(13px,2vw,20px) Cinzel,serif;color:#f7d51d;text-align:center}
    .online-tabs,.online-footer,.online-balances{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}.online-footer{justify-content:space-between}
    .online-tab,.online-action{border:1px solid #8a5cff;border-radius:7px;padding:6px 12px;color:#e0c8ff;background:rgba(42,26,74,.8);font-weight:bold;cursor:pointer}.online-tab.active,.online-action:not(:disabled){border-color:#f7d51d;color:#fff}.online-action:disabled{opacity:.45;cursor:not-allowed}
    .online-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px}.online-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid #6b4fa0;border-radius:8px;background:rgba(20,10,36,.85)}
    .online-row strong,.online-row small{display:block}.online-row small{color:#b8a8d6;margin-top:3px}.online-row progress{width:100%;height:7px;accent-color:#f7d51d}.online-reward{color:#ffe287;font-size:12px;margin-bottom:4px}.online-status{text-align:center;min-height:1em;font-size:12px;color:#e0c8ff}
    .online-reset{font-size:12px;color:#cbb3eb}.coin-pop{animation:coinPop .6s ease}@keyframes coinPop{50%{transform:scale(1.25);color:#fff}}
    .shop-coin{position:absolute;top:0;right:0;padding:5px 10px;border:1px solid #d6aa42;border-radius:99px;color:#ffe287;background:rgba(10,6,18,.8);font:bold 13px Cinzel,serif;white-space:nowrap}
    .shop-purchase{display:flex;align-items:center;gap:6px}.shop-quantity{display:flex;align-items:center;gap:4px;color:#cbb3eb;font-size:12px}.shop-quantity input{width:52px;padding:5px;border:1px solid #8a5cff;border-radius:6px;background:#0a0612;color:#fff;font:inherit}.shop-quantity input:disabled{opacity:.55}
    .quest-layout{display:flex;flex:1;min-height:0;gap:8px}.quest-layout .online-list{flex:1}.quest-filter{display:flex;flex-direction:column;gap:5px;min-width:92px}.quest-filter .online-tab{padding:6px;text-align:left}.quest-filter-label{font-size:11px;color:#bda9dc;text-transform:uppercase;letter-spacing:.08em}
    .special-quest{display:flex;flex-direction:column;gap:6px}.special-title{border:0;background:transparent;color:#e0c8ff;font-weight:800;text-align:left;cursor:pointer}.special-child{padding:8px;border-top:1px solid rgba(183,148,246,.25);color:#d3c5ea;font-size:12px}.special-check{color:#74e3a4;font-weight:bold}.special-claimed{opacity:.55}
    @media(max-width:600px){.leaderboard{width:70cqw;font-size:10px}.leaderboard h2{font-size:12px}.leaderboard-row{grid-template-columns:25px minmax(0,1fr) 35px}.leaderboard-preview{width:28cqw;font-size:9px}.leaderboard-preview p{font-size:8px}.leaderboard-preview-list .leaderboard-row{grid-template-columns:18px minmax(0,1fr) 22px}.leaderboard-open{font-size:9px}.coin-balance{font-size:10px}.online-view{inset:2px 12px 5px;gap:3px}.online-row{padding:5px}.online-action,.online-tab{padding:4px 8px}.online-status,.online-reset{font-size:10px}.shop-coin{font-size:10px;padding:3px 7px}}
  `;
  document.head.appendChild(style);
  const isOnline=()=>!!window.ZyloxAccount?.isOnline;
  const elem=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
  const action=(text,fn)=>{const b=elem('button','online-action',text);b.type='button';b.addEventListener('click',fn);return b};
  const message=error=>error?.message||'Unable to load data. Please try again.';

  if(document.getElementById('lobby')){
    const container=document.querySelector('.gc');
    const coins=elem('div','coin-balance','🪙 0');coins.setAttribute('aria-label','Coins');container.appendChild(coins);
    const preview=elem('section','leaderboard-preview');preview.setAttribute('aria-label','Leaderboard preview');
    const open=action('🏆 Leaderboard',()=>{overlay.hidden=false;loadBoard()});open.className='leaderboard-open';
    const previewSubtitle=elem('p','',''),previewRows=elem('div','leaderboard-preview-list');previewRows.tabIndex=0;previewRows.setAttribute('aria-label','Leaderboard preview, scroll to browse');
    previewRows.addEventListener('click',event=>{if(event.target.closest('.leaderboard-row'))open.click()});
    const previewRewards=elem('div','leaderboard-rewards',''),previewReset=elem('div','leaderboard-reset','');
    preview.append(open,previewSubtitle,previewRows,previewRewards,previewReset);container.appendChild(preview);
    const overlay=elem('div','leaderboard-overlay');overlay.hidden=true;
    const panel=elem('section','leaderboard');panel.setAttribute('aria-label','Leaderboard');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    panel.append(elem('h2','','🏆 Leaderboard'));
    const subtitle=elem('p','',''),rows=elem('div','leaderboard-list',''),rewards=elem('div','leaderboard-rewards',''),reset=elem('div','leaderboard-reset','');const close=action('← Back',()=>{overlay.hidden=true;open.focus()});close.className='leaderboard-close';panel.append(subtitle,rows,rewards,reset,close);overlay.appendChild(panel);container.appendChild(overlay);
    let request=0,boardTimer=0;
    function startBoardClock(data){
      clearInterval(boardTimer);const remaining=Date.parse(data.reset_at)-Date.parse(data.server_time),start=performance.now();
      if(!Number.isFinite(remaining)){reset.textContent=previewReset.textContent='';return}
      let ended=false;const update=()=>{const seconds=Math.max(0,Math.floor((remaining-(performance.now()-start))/1000)),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),s=seconds%60;
        reset.textContent=previewReset.textContent=`Reset after: ${days}d ${hours}h ${minutes}m ${s}s`;
        if(!seconds&&!ended){ended=true;clearInterval(boardTimer);setTimeout(loadBoard,1500)}};update();if(!ended)boardTimer=setInterval(update,1000);
    }
    async function loadBoard(){
      const seq=++request,map=document.getElementById('mapTitle').textContent,difficulty=document.getElementById('diffName').textContent;
      subtitle.textContent=previewSubtitle.textContent=`${map} · ${difficulty}`;rows.textContent=previewRows.textContent='Loading...';
      if(!cloud){rows.textContent=previewRows.textContent='Leaderboard unavailable.';return}
      try{
        const actualMap=map.toLowerCase()==='halloween'?'Halloween':map;
        const data=await cloud.rpc('leaderboard',{map_key:actualMap,difficulty_key:difficulty});
        if(seq!==request)return;
        if(Array.isArray(data?.rewards)&&data.rewards.length===3)rewards.textContent=previewRewards.textContent=`🥇 ${data.rewards[0]} · 🥈 ${data.rewards[1]} · 🥉 ${data.rewards[2]} Coin`;
        startBoardClock(data);
        for(const target of [rows,previewRows]){
          target.replaceChildren();
          if(!data?.top?.length){target.textContent='No scores yet.';continue}
          data.top.forEach(item=>{const row=elem('div','leaderboard-row');row.append(elem('span','',`#${item.rank}`),elem('span','',item.username),elem('span','',String(item.score)));target.appendChild(row)});
          if(data.me){const mine=elem('div','leaderboard-row leaderboard-me');mine.append(elem('span','',`#${data.me.rank}`),elem('span','','You'),elem('span','',String(data.me.score)));target.appendChild(mine)}
        }
      }catch(error){if(seq===request)rows.textContent=previewRows.textContent=message(error)}
    }
    const updateCoins=()=>{coins.textContent=`🪙 ${Number(window.ZyloxAccount?.getCoin()||0).toLocaleString()}`};
    document.addEventListener('zylox-progress-updated',updateCoins);
    document.addEventListener('zylox-account-ready',()=>{updateCoins();loadBoard()});
    const observer=new MutationObserver(loadBoard);
    observer.observe(document.getElementById('mapTitle'),{childList:true,characterData:true,subtree:true});
    observer.observe(document.getElementById('diffName'),{childList:true,characterData:true,subtree:true});
    setInterval(()=>{if(!document.hidden&&isOnline())window.ZyloxAccount?.refresh()},60000);
    updateCoins();loadBoard();
  }

  if(!document.getElementById('settingsBox'))return;
  const main=document.querySelector('.main-view'),tabs=document.getElementById('tabList'),title=document.getElementById('mainTitle'),box=document.getElementById('settingsBox');
  const questView=elem('section','online-view');questView.id='questView';questView.setAttribute('aria-label','Quests');
  const shopView=elem('section','online-view');shopView.id='shopView';shopView.setAttribute('aria-label','Shop');main.append(questView,shopView);
  const originalClose=window.closeAllViews;
  window.closeAllViews=()=>{viewGeneration++;stopClock();questView.classList.remove('show');shopView.classList.remove('show');originalClose()};
  const entityTab=[...tabs.querySelectorAll('.tab')].find(el=>el.querySelector('.tab-name')?.textContent.trim()==='Entity');
  if(entityTab){const q=elem('button','tab');q.type='button';q.innerHTML='<span class="tab-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/><path d="M7 3v15a3 3 0 0 0-3 0M10 8h6M10 12h6M10 16h4"/></svg></span><span class="tab-name">Quests</span><span class="tab-arrow">▸</span>';q.addEventListener('click',()=>openPanel('quests'));entityTab.after(q)}
  const shopTab=[...tabs.querySelectorAll('.tab')].find(el=>el.querySelector('.tab-name')?.textContent.trim()==='Shop');
  if(shopTab){shopTab.setAttribute('role','button');shopTab.tabIndex=0;shopTab.addEventListener('click',()=>openPanel('shop'));shopTab.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPanel('shop')}})}
  let viewGeneration=0, countdownTimer=0, period='daily', shopSection='daily',questFilter='all',ghostExpanded=false;
  function stopClock(){if(countdownTimer)clearInterval(countdownTimer);countdownTimer=0}
  function countdown(target,serverTime,resetAt,onEnd){
    stopClock();const remainingAtStart=Math.max(0,Date.parse(resetAt)-Date.parse(serverTime)),started=performance.now();let ended=false;
    const update=()=>{const left=Math.max(0,remainingAtStart-(performance.now()-started));const seconds=Math.floor(left/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),s=seconds%60;
      target.textContent=days?`Reset in ${days}d ${hours}h ${minutes}m`:`Reset in ${hours}h ${minutes}m ${s}s`;
      if(!left&&!ended){ended=true;stopClock();onEnd()}};
    update();if(!ended)countdownTimer=setInterval(update,1000);
  }
  function openPanel(which){
    stopClock();window.closeAllViews();tabs.style.display='none';box.classList.add('entity-mode');
    title.textContent=which==='shop'?'⚜ Shop ⚜':'⚜ Quests ⚜';
    const view=which==='shop'?shopView:questView;view.classList.add('show');
    if(which==='shop'){shopSection='daily';showShop()}else{period='daily';questFilter='all';showQuests()}
  }
  function baseView(view,heading){
    view.replaceChildren();view.appendChild(elem('div','online-heading',heading));
    const list=elem('div','online-list');view.appendChild(list);
    const status=elem('div','online-status','');status.setAttribute('aria-live','polite');view.appendChild(status);
    const footer=elem('div','online-footer');view.appendChild(footer);
    return {list,status,footer};
  }
  function backButton(){return action('← Back',()=>{stopClock();window.closeAllViews()})}
  function requireLogin(view,titleText){
    const ui=baseView(view,titleText);ui.list.appendChild(elem('p','','Sign in with a registered account to use this feature. Guest progress stays on this browser.'));ui.footer.appendChild(backButton());return ui;
  }
  async function showShop(){
    const seq=++viewGeneration;stopClock();
    const guest=!!window.ZyloxAccount?.isOfflineGuest;
    if(!isOnline()&&!guest){requireLogin(shopView,'Shop');return}
    const selected=shopSection,ui=baseView(shopView,'');ui.list.textContent='Loading...';ui.footer.appendChild(backButton());
    const coins=elem('div','shop-coin',`🪙 ${Number(window.ZyloxAccount.getCoin()||0).toLocaleString()}`);coins.setAttribute('aria-label','Coins');shopView.appendChild(coins);
    const tabRow=elem('div','online-tabs');shopView.insertBefore(tabRow,ui.list);
    for(const [key,label] of [['daily','Daily Shop'],['one-time','One-Time Shop']]){const tab=action(label,()=>{shopSection=key;showShop()});tab.className='online-tab'+(selected===key?' active':'');tabRow.appendChild(tab)}
    try{
      const now=Date.now(),nextDay=Math.floor((now+7*3600000)/86400000)*86400000+86400000-7*3600000;
      const data=guest?{coin:0,candy:window.ZyloxAccount.getCandy(),items:[{id:'candy_5',candy_amount:5,coin_price:10,daily_limit:10,purchased:0}],server_time:new Date(now).toISOString(),reset_at:new Date(nextDay).toISOString()}:await cloud.rpc('shop_state');if(seq!==viewGeneration||!shopView.classList.contains('show'))return;
      ui.list.replaceChildren();
      coins.textContent=`🪙 ${Number(data.coin||0).toLocaleString()}`;
      if(selected==='daily'){
        if(!data.items?.length)ui.list.appendChild(elem('p','','No items available today.'));
        for(const item of data.items||[]){
          const row=elem('div','online-row'),details=elem('div');details.append(elem('strong','',`🍬 ${item.candy_amount} Candy`),elem('small','',`🪙 ${item.coin_price} Coin · ${Math.max(0,item.daily_limit-item.purchased)} / ${item.daily_limit} remaining today`));
          const key=`baofantasy_bulk_pending_${window.ZyloxAccount.account.id}_${item.id}`;
          let pending=null;try{pending=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}
          const group=elem('div','shop-purchase'),label=elem('label','shop-quantity','Qty');
          const quantity=elem('input');quantity.type='number';quantity.min='1';quantity.max=String(Math.max(1,item.daily_limit-item.purchased));quantity.step='1';quantity.value=String(pending?.quantity||1);quantity.disabled=guest||!!pending;quantity.setAttribute('aria-label',`Quantity for ${item.candy_amount} Candy exchange`);label.appendChild(quantity);
          const total=elem('small');const updateTotal=()=>{const n=quantity.valueAsNumber;total.textContent=Number.isInteger(n)&&n>0?`Total: ${n*item.coin_price} Coin → ${n*item.candy_amount} Candy`:''};quantity.addEventListener('input',updateTotal);updateTotal();details.appendChild(total);
          const button=action('Exchange',async()=>{
            button.disabled=true;ui.status.textContent='Processing...';
            if(!pending){
              const count=quantity.valueAsNumber;
              if(!Number.isInteger(count)||count<1||count>item.daily_limit-item.purchased||count*item.coin_price>Number(data.coin)){ui.status.textContent='Enter a quantity within your Coins and the daily limit.';button.disabled=false;return}
              if(!crypto.randomUUID){ui.status.textContent='Secure random IDs are unavailable.';button.disabled=false;return}
              pending={id:crypto.randomUUID(),quantity:count};localStorage.setItem(key,JSON.stringify(pending));quantity.disabled=true;
            }
            try{const result=await cloud.rpc('exchange_candy_bulk',{item_key:item.id,quantity:pending.quantity,operation_id:pending.id});localStorage.removeItem(key);if(result&&Number.isFinite(Number(result.coin)))coins.textContent=`🪙 ${Number(result.coin).toLocaleString()}`;await window.ZyloxAccount.refresh();if(shopView.classList.contains('show')&&shopSection===selected)showShop()}
            catch(error){if(/daily limit|not enough|unavailable|invalid exchange quantity/i.test(message(error))){localStorage.removeItem(key);pending=null;quantity.disabled=false}if(shopView.classList.contains('show')&&shopSection===selected){ui.status.textContent=message(error);button.disabled=false}}
          });
          button.disabled=guest||(!pending&&(Number(data.coin)<item.coin_price||item.purchased>=item.daily_limit));
          if(guest)details.appendChild(elem('small','','Sign in to earn Coins and exchange.'));
          group.append(label,button);row.append(details,group);ui.list.appendChild(row);
        }
        const reset=elem('span','online-reset');ui.footer.prepend(reset);countdown(reset,data.server_time,data.reset_at,showShop);
      }else{
        const ownedResult=guest?{data:window.ZyloxAccount.guestOwnsWitch()?[{entity_id:'Witch'}]:[]}:await cloud.client.from('player_entities').select('entity_id');
        if(ownedResult.error)throw ownedResult.error;
        if(seq!==viewGeneration||!shopView.classList.contains('show'))return;
        const owned=(ownedResult.data||[]).some(item=>item.entity_id==='Witch');
        const row=elem('div','online-row'),details=elem('div');details.append(elem('strong','','Witch'),elem('small','',`🍬 200 Candy · ${owned?'0/0':'1/1'} remaining`));
        const group=elem('div','shop-purchase'),label=elem('label','shop-quantity','Qty'),quantity=elem('input');quantity.type='number';quantity.min='1';quantity.max='1';quantity.step='1';quantity.value='1';quantity.disabled=owned;quantity.setAttribute('aria-label','Quantity for Witch');label.appendChild(quantity);
        const button=action('Buy',async()=>{
          if(quantity.valueAsNumber!==1){ui.status.textContent='Witch can only be purchased once.';return}
          button.disabled=true;ui.status.textContent='Processing...';
          try{if(guest)window.ZyloxAccount.purchaseGuestWitch();else await cloud.rpc('purchase_witch');await window.ZyloxAccount.refresh();await window.BaoAdmin?.refresh();if(shopView.classList.contains('show')&&shopSection===selected)showShop()}
          catch(error){ui.status.textContent=message(error);button.disabled=false}
        });
        button.disabled=owned||Number(data.candy)<200;group.append(label,button);row.append(details,group);ui.list.appendChild(row);
        const ghost=guest?window.ZyloxAccount.guestGhostState():await cloud.rpc('ghost_state');
        if(seq!==viewGeneration||!shopView.classList.contains('show'))return;
        const ghostRow=elem('div','online-row'),ghostDetails=elem('div');
        ghostDetails.append(elem('strong','','👻 Ghost Token'),elem('small','',`🍬 500 Candy · ${ghost.purchased||ghost.owned?'0/0':'1/1'} remaining`));
        const ghostGroup=elem('div','shop-purchase'),ghostLabel=elem('label','shop-quantity','Qty'),ghostQty=elem('input');ghostQty.type='number';ghostQty.min='1';ghostQty.max='1';ghostQty.step='1';ghostQty.value='1';ghostQty.disabled=!!(ghost.purchased||ghost.owned);ghostQty.setAttribute('aria-label','Quantity for Ghost Token');ghostLabel.appendChild(ghostQty);
        const ghostBuy=action('Buy',async()=>{
          if(ghostQty.valueAsNumber!==1){ui.status.textContent='Ghost Token can only be purchased once.';return}
          ghostBuy.disabled=true;ui.status.textContent='Processing...';
          try{if(guest)window.ZyloxAccount.purchaseGuestGhost();else await cloud.rpc('purchase_ghost_token');await window.ZyloxAccount.refresh();if(shopView.classList.contains('show')&&shopSection===selected)showShop()}
          catch(error){if(shopView.classList.contains('show')&&shopSection===selected){ui.status.textContent=message(error);ghostBuy.disabled=false}}
        });
        ghostBuy.disabled=!!(ghost.purchased||ghost.owned)||Number(data.candy)<500;ghostGroup.append(ghostLabel,ghostBuy);ghostRow.append(ghostDetails,ghostGroup);ui.list.appendChild(ghostRow);
      }
    }catch(error){if(seq===viewGeneration){ui.list.textContent='';ui.status.textContent=message(error)}}
  }
  async function showQuests(){
    const seq=++viewGeneration;stopClock();const selectedPeriod=period;
    const guest=!!window.ZyloxAccount?.isOfflineGuest;
    if(!isOnline()&&!guest){requireLogin(questView,'Quests');return}
    const ui=baseView(questView,'Quests');const tabRow=elem('div','online-tabs');questView.insertBefore(tabRow,ui.list);
    for(const value of ['daily','weekly','special']){const tab=action(value[0].toUpperCase()+value.slice(1),()=>{period=value;showQuests()});tab.className='online-tab'+(period===value?' active':'');tabRow.appendChild(tab)}
    const layout=elem('div','quest-layout'),filters=elem('div','quest-filter');filters.appendChild(elem('span','quest-filter-label','Filter'));
    for(const [value,label] of [['all','All'],['unclaimed','Unclaimed'],['claimed','Claimed']]){const tab=action(label,()=>{questFilter=value;showQuests()});tab.className='online-tab'+(questFilter===value?' active':'');filters.appendChild(tab)}
    questView.insertBefore(layout,ui.list);layout.append(filters,ui.list);
    ui.footer.appendChild(backButton());
    if(period==='special'){
      ui.list.textContent='Loading...';
      try{
        const ghost=guest?window.ZyloxAccount.guestGhostState():await cloud.rpc('ghost_state');
        if(seq!==viewGeneration||!questView.classList.contains('show'))return;
        ui.list.replaceChildren();
        if((questFilter==='claimed'&&!ghost.claimed)||(questFilter==='unclaimed'&&ghost.claimed)){ui.list.appendChild(elem('p','','No quests in this filter.'));return}
        const card=elem('div','online-row special-quest'+(ghost.claimed?' special-claimed':'')),top=elem('div','online-row'),details=elem('div');
        const titleButton=action(`${ghostExpanded?'▾':'▸'} Mythical Ghost Quest`,()=>{ghostExpanded=!ghostExpanded;child.hidden=!ghostExpanded;titleButton.textContent=`${ghostExpanded?'▾':'▸'} Mythical Ghost Quest`;titleButton.setAttribute('aria-expanded',String(ghostExpanded))});titleButton.className='special-title';titleButton.setAttribute('aria-expanded',String(ghostExpanded));
        details.append(titleButton,elem('small','',`Progress: ${ghost.found?1:0}/1 · ${ghost.claimed?'Claimed':ghost.found?'Completed':'In Progress'}`),elem('small','online-reward','Reward: Ghost'));
        const claim=action(ghost.claimed?'Claimed':'Claim',async()=>{
          claim.disabled=true;ui.status.textContent='Claiming...';
          try{if(guest)window.ZyloxAccount.claimGuestGhost();else await cloud.rpc('claim_ghost_quest');await window.ZyloxAccount.refresh();await window.BaoAdmin?.refresh();if(questView.classList.contains('show')&&period==='special')showQuests()}
          catch(error){ui.status.textContent=message(error);claim.disabled=false}
        });claim.disabled=!!ghost.claimed||!ghost.found;
        top.append(details,claim);const child=elem('div','special-child');child.hidden=!ghostExpanded;
        const mark=elem('span',ghost.found?'special-check':'',ghost.found?'✓ ':'○ ');child.append(mark,document.createTextNode(`Collect Ghost Token as Witch in Nightmare · ${ghost.found?1:0}/1`));
        if(!ghost.purchased)child.appendChild(elem('small','','Purchase Ghost Token in One-Time Shop first.'));
        card.append(top,child);ui.list.appendChild(card);
      }catch(error){if(seq===viewGeneration){ui.list.textContent='';ui.status.textContent=message(error)}}
      return;
    }
    if(guest){ui.list.textContent='Sign in with a registered account to use Daily and Weekly Quests.';return}
    ui.list.textContent='Loading...';
    try{
      const data=await cloud.rpc('quest_state',{period_name:period});if(seq!==viewGeneration||!questView.classList.contains('show'))return;
      ui.list.replaceChildren();
      const visible=(data.quests||[]).filter(quest=>questFilter==='all'||(questFilter==='claimed' ? quest.claimed : !quest.claimed));
      if(!visible.length)ui.list.appendChild(elem('p','','No quests in this filter.'));
      for(const quest of visible){
        const row=elem('div','online-row'),details=elem('div');const icon={easy:'🌱',medium:'⚡',hard:'🔥',summary:'🏆'}[quest.difficulty]||'📜';details.appendChild(elem('strong','',`${icon} ${quest.title}`));
        const label=elem('small','',`${quest.progress} / ${quest.target} · ${quest.claimed?'Claimed':quest.progress>=quest.target?'Completed':'In Progress'}`);details.appendChild(label);
        const progress=elem('progress');progress.max=quest.target;progress.value=quest.progress;progress.setAttribute('aria-label',quest.title);details.appendChild(progress);
        const right=elem('div'),reward=elem('div','online-reward',`🪙 ${quest.reward} Coin`);right.appendChild(reward);
        const button=action(quest.claimed?'Claimed':'Claim',async()=>{button.disabled=true;ui.status.textContent='Claiming...';try{await cloud.rpc('claim_quests',{period_name:selectedPeriod,chosen_id:quest.id});await window.ZyloxAccount.refresh();if(questView.classList.contains('show')&&period===selectedPeriod)showQuests()}catch(error){ui.status.textContent=message(error);button.disabled=false}});
        button.disabled=quest.claimed||quest.progress<quest.target;right.appendChild(button);row.append(details,right);ui.list.appendChild(row);
      }
      const reset=elem('span','online-reset');ui.footer.prepend(reset);countdown(reset,data.server_time,data.reset_at,showQuests);
      const all=action('Claim All',async()=>{all.disabled=true;ui.status.textContent='Claiming...';try{const result=await cloud.rpc('claim_quests',{period_name:selectedPeriod,chosen_id:null});await window.ZyloxAccount.refresh();if(questView.classList.contains('show')&&period===selectedPeriod)showQuests();if(result.reward_received>0)questView.classList.add('coin-pop');setTimeout(()=>questView.classList.remove('coin-pop'),600)}catch(error){ui.status.textContent=message(error);all.disabled=false}});
      all.disabled=!(data.quests||[]).some(q=>!q.claimed&&q.progress>=q.target);ui.footer.appendChild(all);
    }catch(error){if(seq===viewGeneration){ui.list.textContent='';ui.status.textContent=message(error)}}
  }
})();
