(function (root) {
  'use strict';
  const modes={Easy:{speed:4,gap:190,candy:.25},Medium:{speed:6,gap:175,candy:.30},Hard:{speed:8,gap:160,candy:.35},Extreme:{speed:10,gap:150,candy:.40},Nightmare:{speed:12,gap:140,candy:.50}};
  function random(seed) {
    let s=(seed>>>0)||0x6d2b79f5;
    return () => { s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296; };
  }
  function ghostChance(gapNumber,mechanics=4){return Math.max(0,Math.min(1,Number(gapNumber)*(mechanics===3?.02:.01)))}
  function simulate(challenge, payload) {
    const cfg=modes[challenge.difficulty],fps=Number(challenge.fps),step=60/fps;
    if(!cfg||![60,90,120].includes(fps)||!['Bat','Witch','Ghost'].includes(challenge.entity)||challenge.map!=='Halloween')throw Error('Unsupported game session');
    if(!payload||!Number.isSafeInteger(payload.ticks)||payload.ticks<1||payload.ticks>fps*3600)throw Error('Invalid replay length');
    if(!Array.isArray(payload.flaps)||!Array.isArray(payload.resizes)||payload.flaps.length>payload.ticks*2+2||payload.resizes.length>200)throw Error('Invalid replay events');
    const flaps=payload.flaps,resizes=payload.resizes;
    if(flaps.some((n,i)=>!Number.isSafeInteger(n)||n<0||n>=payload.ticks||(i&&n<flaps[i-1])))throw Error('Invalid flap events');
    if(resizes.some((e,i)=>!Array.isArray(e)||e.length!==2||!Number.isSafeInteger(e[0])||e[0]<0||e[0]>=payload.ticks||!Number.isFinite(e[1])||e[1]<160||e[1]>3840||(i&&e[0]<resizes[i-1][0])))throw Error('Invalid resize events');
    const next=random(challenge.seed),effect=random((challenge.seed^0x5bd1e995)>>>0),gap=cfg.gap,PW=60,PD=480,H=540;
    const ghostRandom=random((challenge.seed^0x31a63f09)>>>0),ghostEligible=(payload.mechanics===3||payload.mechanics===4)&&challenge.ghost_eligible===true&&challenge.entity==='Witch'&&challenge.difficulty==='Nightmare';
    let width=Number(challenge.width),frame=0,score=0,candy=0,dead=false,flapIndex=0,resizeIndex=0,gapNumber=0,ghostCollected=false;
    let player={x:120,y:H/2,r:14,vy:-10},pipes=[];
    const topFor=prev=>{let lo=60,hi=H-gap-60;if(prev!==undefined){lo=Math.max(lo,prev-50);hi=Math.min(hi,prev+220);if(lo>hi){lo=60;hi=H-gap-60}}return next()*(hi-lo)+lo};
    const make=(x,topHeight)=>{const candySpawn=next()<cfg.candy;gapNumber++;const ghost=ghostEligible&&!ghostCollected&&ghostRandom()<ghostChance(gapNumber,payload.mechanics);return {x,topHeight,scored:false,ghost,candy:candySpawn&&!ghost}};
    pipes.push(make(width,(H-gap)/2));
    let completedTicks=0;
    for(let tick=0;tick<payload.ticks;tick++) {
      while(resizeIndex<resizes.length&&resizes[resizeIndex][0]===tick){
        width=resizes[resizeIndex++][1];
        if(pipes.length){let last=pipes[pipes.length-1];while(last.x<width+PD){const top=topFor(last.topHeight);const p=make(last.x+PD,top);pipes.push(p);last=p;}}
      }
      while(flapIndex<flaps.length&&flaps[flapIndex]===tick){player.vy=-10;flapIndex++}
      frame+=step;
      player.y+=player.vy*step+.7*step*(step+1)/2;player.vy+=.7*step;
      const speed=cfg.speed+Math.min(score*.05,2.5)+Math.floor(frame/600)*.5;
      if(!pipes.length||pipes[pipes.length-1].x<=width-PD){const prev=pipes.length?pipes[pipes.length-1].topHeight:undefined;pipes.push(make(width,topFor(prev)))}
      for(const pipe of pipes){
        pipe.x-=speed*step;
        if(!pipe.scored&&player.x>pipe.x+PW){pipe.scored=true;score++}
        if(challenge.entity!=='Ghost'&&player.x+player.r>pipe.x&&player.x-player.r<pipe.x+PW&&(player.y-player.r<pipe.topHeight||player.y+player.r>pipe.topHeight+gap))dead=true;
        if(challenge.entity==='Ghost'&&Math.hypot(player.x-(pipe.x+PW/2),player.y-(pipe.topHeight+gap/2+60))<player.r+12)dead=true;
        if(!dead&&pipe.ghost&&!ghostCollected&&Math.hypot(player.x-(pipe.x+PW/2),player.y-(pipe.topHeight+gap/2))<player.r+12){pipe.ghost=false;ghostCollected=true}
        if(!dead&&pipe.candy&&Math.hypot(player.x-(pipe.x+PW/2),player.y-(pipe.topHeight+gap/2))<player.r+12){pipe.candy=false;const updated=payload.mechanics>=2;candy+=challenge.entity==='Witch'&&effect()<(updated?.5:.2)?(updated?3:2):1}
      }
      pipes=pipes.filter(pipe=>pipe.x+PW>0);
      if(player.y+player.r>H-60||player.y-player.r<0)dead=true;
      completedTicks=tick+1;
      if(dead&&completedTicks<payload.ticks)throw Error('Replay continues after collision');
    }
    return {ticks:completedTicks,score,candy,dead,ghostCollected};
  }
  root.BaoReplay={random,simulate,ghostChance};
})(globalThis);
