(function(root){
  'use strict';
  let state={is_admin:false,enabled:false,owned:['Bat']};
  const panel=document.getElementById('lobby');
  let button;
  if(panel){
    button=document.createElement('button');button.type='button';button.hidden=true;
    button.style.cssText='position:absolute;top:1%;left:50%;transform:translateX(-50%);z-index:50;background:#382258;color:#f8dc7c;border:1px solid #b794f6;border-radius:8px;padding:5px 12px;font-weight:bold;cursor:pointer;pointer-events:auto';
    panel.appendChild(button);
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try{const result=await root.BaoCloud.rpc('set_admin_mode',{desired:!state.enabled});state={...state,...result};changed()}
      catch(error){alert(error.message||'Admin mode could not be changed.')}
      finally{button.disabled=false}
    });
  }
  function changed(){
    if(button){button.hidden=!state.is_admin;button.textContent=`Admin Mode: ${state.enabled?'ON':'OFF'}`}
    const selected=localStorage.getItem('zylox_entity');
    if(selected&&!state.enabled&&!state.owned.includes(selected))localStorage.setItem('zylox_entity','Bat');
    document.dispatchEvent(new CustomEvent('bao-admin-updated'));
  }
  async function refresh(){
    state={is_admin:false,enabled:false,owned:['Bat']};
    if(root.ZyloxAccount?.isOfflineGuest && root.ZyloxAccount.guestOwnsWitch())state.owned.push('Witch');
    if(root.ZyloxAccount?.isOnline){
      try{
        const [admin,owned]=await Promise.all([root.BaoCloud.rpc('admin_state'),root.BaoCloud.client.from('player_entities').select('entity_id')]);
        if(owned.error)throw owned.error;
        state={...admin,owned:(owned.data||[]).map(x=>x.entity_id)};
      }catch(_){state={is_admin:false,enabled:false,owned:['Bat']}}
    }
    changed();
  }
  root.BaoAdmin={get state(){return state},refresh};
  document.addEventListener('zylox-account-ready',refresh);
  if(root.ZyloxAccount?.ready)refresh();
})(window);
