(function (root) {
  'use strict';
  const prefix = 'baofantasy_verified_run_';
  let syncing = false, retryTimer = 0;
  const currentOwner = () => root.ZyloxAccount?.isOnline && root.ZyloxAccount.account?.id;
  function notice(message) {
    let el = document.getElementById('onlineRunStatus');
    if (!el) {
      el = document.createElement('div'); el.id = 'onlineRunStatus';
      el.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:500;color:#ffe287;background:#1b1032;padding:6px;border-radius:6px;font:12px sans-serif;max-width:65vw';
      document.body.appendChild(el);
    }
    el.textContent = message; el.hidden = !message;
  }
  function save(run) {
    if (!run || run.admin || run.replay.ticks < 1) return;
    const snapshot = { ...run, replay: { mechanics: run.replay.mechanics === 3 ? 3 : 2, ticks: run.replay.ticks,
      flaps: run.replay.flaps.filter(tick => tick < run.replay.ticks),
      resizes: run.replay.resizes.filter(event => event[0] < run.replay.ticks) } };
    try { localStorage.setItem(prefix + run.owner + '_' + run.id, JSON.stringify(snapshot)); }
    catch (_) { notice('Progress could not be saved on this device.'); return; }
    sync();
  }
  async function sync() {
    retryTimer = 0;
    const owner = currentOwner();
    if (!owner || syncing || !root.BaoCloud) return;
    syncing = true;
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix + owner + '_'));
      for (const key of keys) {
        if (currentOwner() !== owner) break;
        const saved = localStorage.getItem(key);
        let run; try { run = JSON.parse(saved); } catch (_) { continue; }
        if (!run?.id || run.owner !== owner || !run.replay) continue;
        await root.BaoCloud.verifyRun(run.id, run.replay);
        if (currentOwner() !== owner) break;
        if (await root.ZyloxAccount.refresh() === false) throw Error('Progress refresh failed');
        if (currentOwner() !== owner) break;
        root.BaoRunSynced?.(run);
        if (localStorage.getItem(key) === saved) localStorage.removeItem(key);
      }
      await root.ZyloxAccount.refresh();
      notice('');
    } catch (_) {
      notice('Game progress is waiting to sync.');
      clearTimeout(retryTimer); retryTimer = setTimeout(sync, 15000);
    } finally { syncing = false; }
    if (currentOwner() === owner && Object.keys(localStorage).some(key => key.startsWith(prefix + owner + '_')) && !retryTimer) setTimeout(sync, 0);
  }
  document.addEventListener('zylox-account-ready', sync);
  root.addEventListener('online', sync);
  root.addEventListener('focus', sync);
  root.BaoRuns = { save, sync, notice };
  if (currentOwner()) sync();
})(window);
