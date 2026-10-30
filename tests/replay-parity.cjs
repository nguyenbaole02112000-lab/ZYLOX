const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'halloween.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const replay = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'game-replay.js'), 'utf8'), replay);
assert.notEqual(replay.BaoReplay.random(0)(),0,'zero seed must not produce a permanently constant random sequence');
assert.equal(replay.BaoReplay.ghostChance(1),.01);assert.equal(replay.BaoReplay.ghostChance(2),.02);assert.equal(replay.BaoReplay.ghostChance(50),.5);assert.equal(replay.BaoReplay.ghostChance(100),1);assert.equal(replay.BaoReplay.ghostChance(101),1);
assert.equal(replay.BaoReplay.ghostChance(1,3),.02);assert.equal(replay.BaoReplay.ghostChance(50,3),1);
let exercisedGhostCollection=false;

for (const entity of ['Bat', 'Witch', 'Ghost']) {
for (const fps of [60, 90, 120]) {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Extreme', 'Nightmare']) {
   for (const withGhost of entity==='Witch'&&difficulty==='Nightmare'?[false,true]:[false]) {
    const math = Object.create(Math);
    math.random = replay.BaoReplay.random(12345);
    let candy = 0;
    const ctx = new Proxy({
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} })
    }, { get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => (target[key] = value, true) });
    const canvas = { clientWidth: 960, clientHeight: 540, getContext: () => ctx, addEventListener() {} };
    const element = { style: {}, textContent: '', appendChild() {} };
    const localStorage = {
      getItem(key) { return key === 'zylox_physics_fps' ? String(fps) : key === 'zylox_diff' ? difficulty : key === 'zylox_entity' ? entity : null; },
      setItem() {}
    };
    const document = {
      getElementById(id) { return id === 'gameCanvas' ? canvas : element; },
      querySelector() { return element; }, addEventListener() {}, createElement() { return { style: {} }; }
    };
    const window = {
      addEventListener() {}, devicePixelRatio: 1, location: {},
      ZyloxAccount: { ready: true, getCandy: () => candy, getBest: () => 0, addCandy() { candy++; }, saveBest() {} }
    };
    const scope = vm.createContext({ document, window, localStorage, Math: math, performance: { now: () => 0 }, requestAnimationFrame() {}, Number, Array });
    vm.runInContext(game, scope);
    scope.effectSeed = replay.BaoReplay.random((12345^0x5bd1e995)>>>0);
    scope.ghostSeed=replay.BaoReplay.random((12345^0x31a63f09)>>>0);scope.eligibleGhost=withGhost;
    vm.runInContext('effectRandom=effectSeed;ghostRandom=ghostSeed;ghostEligible=eligibleGhost;resetGame();cr.vy=-10', scope);
    const flaps = [], resizes = [];
    let ticks = 0, dead = false;
    for (let tick = 0; tick < fps * 90; tick++) {
      if (tick === fps * 30 || tick === fps * 45) {
        canvas.clientWidth = tick === fps * 30 ? 720 : 960;
        resizes.push([tick, canvas.clientWidth]);
        vm.runInContext('resizeCanvas()', scope);
      }
      const shouldFlap = vm.runInContext('(()=>{const p=pipes.find(p=>p.x+60>cr.x);const target=p?p.topHeight+PG/2:270;return cr.y>target+12&&cr.vy>0})()', scope);
      if (shouldFlap) { flaps.push(tick); vm.runInContext('cr.vy=-10', scope); }
      vm.runInContext(`update(${60 / fps})`, scope);
      ticks = tick + 1;
      if (vm.runInContext("state==='gameover'", scope)) { dead = true; break; }
    }
    const score = vm.runInContext('score', scope);
    const result = replay.BaoReplay.simulate({ difficulty, fps, width: 960, seed: 12345, entity, map: 'Halloween',ghost_eligible:withGhost }, { mechanics: 4, ticks, flaps, resizes });
    assert.deepEqual({ score: result.score, candy: result.candy, dead: result.dead }, { score, candy, dead }, `${difficulty} ${fps} FPS`);
    assert.equal(result.ghostCollected,vm.runInContext('ghostCollected',scope),`Ghost collection ${fps} FPS`);
    if(withGhost&&result.ghostCollected)exercisedGhostCollection=true;
    if(withGhost){assert.ok(vm.runInContext('(()=>{gameplayRandom=()=>0;ghostRandom=()=>0;ghostEligible=true;ghostCollected=false;gapNumber=0;const p=makePipe(1,100);return p.ghost&&!p.candy})()',scope),'Ghost and Candy must not spawn in the same gap')}
    console.log(`${entity} / ${difficulty} / ${fps} FPS: ${ticks} ticks, ${score} score, ${candy} Candy verified`);
  }
  }
}
}

assert.ok(exercisedGhostCollection,'eligible Witch replay must actually collect a Ghost Token in this test');
assert.throws(() => replay.BaoReplay.simulate({ difficulty: 'Easy', fps: 60, width: 960, seed: 1, entity: 'Bat', map: 'Halloween' }, { ticks: 10, flaps: [15], resizes: [] }), /Invalid flap/);
