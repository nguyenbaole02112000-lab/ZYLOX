(() => {
  const definitions = {
    Bat: { rarity: 'Common', maps: 'HALLOWEEN', passive: 'Night Only', locked: false },
    Witch: { rarity: 'Epic', maps: 'HALLOWEEN', passive: 'Day & Night\n50% Chance for 3× Candy', locked: true },
    Ghost: { rarity: 'Mythical', maps: 'HALLOWEEN', passive: 'Phase Through Terrain\nNight Only\nSeal Vulnerability', locked: true }
  };
  let selected = 'Bat';
  const model = document.getElementById('batModelCanvas');
  const ctx = model.getContext('2d');
  const equip = document.getElementById('equipBtn');
  const passive = document.querySelector('.e-passive-content');
  const map = document.querySelector('.e-map-item');
  const name = document.querySelector('.e-model-name');
  passive.style.whiteSpace = 'pre-line';

  function draw(c, entity, offset=0) {
    if(entity==='Bat'){drawBatBody(c,0,0);drawBatWings(c,0,0)}
    else if(entity==='Witch')BaoEntityArt.witch(c,offset);
    else BaoEntityArt.ghost(c,offset);
  }
  function icon(id, entity) {
    const canvas=document.getElementById(id),c=canvas.getContext('2d');
    c.clearRect(0,0,100,100);c.save();c.translate(50,50);c.scale(1.2,1.2);draw(c,entity);c.restore();
  }
  icon('witchIconCanvas','Witch');icon('ghostIconCanvas','Ghost');
  function refresh() {
    const item=definitions[selected];
    const unlocked=(window.BaoAdmin?.state.owned||['Bat']).includes(selected);
    const usable=unlocked||!!window.BaoAdmin?.state.enabled;
    name.textContent=selected;
    document.getElementById('entityRarity').textContent=item.rarity+' · '+(unlocked?'Unlocked':'Locked'+(usable?' · Admin Trial':''));
    passive.textContent=item.passive;map.dataset.label=item.maps;
    document.querySelectorAll('[data-entity]').forEach(slot=>slot.classList.toggle('active',slot.dataset.entity===selected));
    equip.disabled=!usable;
    equip.classList.toggle('equipped',usable && localStorage.getItem('zylox_entity')===selected);
    equip.textContent=!usable?'Locked':localStorage.getItem('zylox_entity')===selected?'Equipped':'Equip';
    document.querySelectorAll('[data-entity]').forEach(slot=>{const lock=slot.querySelector('.lock-mark');if(lock)lock.hidden=(window.BaoAdmin?.state.owned||['Bat']).includes(slot.dataset.entity)});
  }
  function choose(event) { selected=event.currentTarget.dataset.entity;refresh(); }
  document.querySelectorAll('[data-entity]').forEach(slot=>{
    slot.addEventListener('click',choose);
    slot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(event)}});
  });
  window.updateEquipBtn=refresh;
  window.equipEntity=()=>{if(!(window.BaoAdmin?.state.owned||['Bat']).includes(selected)&&!window.BaoAdmin?.state.enabled)return;localStorage.setItem('zylox_entity',selected);refresh()};
  document.addEventListener('bao-admin-updated',refresh);
  function animate(now) {
    if(document.getElementById('entityView').classList.contains('show')) {
      ctx.clearRect(0,0,model.width,model.height);ctx.save();ctx.translate(200,200);ctx.scale(.8,.8);
      draw(ctx,selected,selected==='Bat'?0:Math.sin(now/600)*3);ctx.restore();
    }
    requestAnimationFrame(animate);
  }
  refresh();requestAnimationFrame(animate);
})();
