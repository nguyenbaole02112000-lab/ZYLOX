(() => {
  let account = null, ready = false, overlay, message, queue = [], syncing = false, serverProgress = { candy: 0, bestScores: {} };
  const api = async (path, method = 'GET', body) => {
    let response;
    const headers = body === undefined ? {} : { 'Content-Type': 'application/json' };
    if (account && (path.startsWith('/api/progress') || ['/api/account/logout','/api/account/password','/api/account/display-name'].includes(path))) headers['X-Zylox-Account'] = String(account.id);
    try { response = await fetch(path, { method, credentials: 'same-origin', headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); }
    catch (_) { throw new Error('Cannot reach the account server. Start the game server and open the game through its URL.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Account request failed. Please try again.');
    return result;
  };
  const pendingPrefix = () => 'zylox_pending_v2_' + account.id + '_';
  const newId = () => globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
  function readQueue() {
    const prefix = pendingPrefix();
    return Object.keys(localStorage).filter(key => key.startsWith(prefix)).sort().flatMap(key => {
      try { const item = JSON.parse(localStorage.getItem(key)); return item && item.id && (item.type === 'candy' || item.type === 'best') ? [item] : []; }
      catch (_) { return []; }
    });
  }
  function enqueue(item) {
    item.id ||= newId();
    localStorage.setItem(pendingPrefix() + item.id, JSON.stringify(item));
    queue = readQueue();
  }
  function mergeProgress(progress) {
    if (!progress) return;
    if (!serverProgress.bestScores || typeof serverProgress.bestScores !== 'object' || Array.isArray(serverProgress.bestScores)) serverProgress.bestScores = {};
    serverProgress.candy = Math.max(Number(serverProgress.candy) || 0, Number(progress.candy) || 0);
    for (const [key, value] of Object.entries(progress.bestScores || {})) serverProgress.bestScores[key] = Math.max(Number(serverProgress.bestScores[key]) || 0, Number(value) || 0);
  }
  async function refreshProgress() {
    if (!account || !ready) return;
    const owner = account.id;
    try {
      const result = await api('/api/progress');
      if (!account || account.id !== owner) return;
      mergeProgress(result.progress); queue = readQueue(); renderProgress(); syncQueue();
    } catch (_) {}
  }
  const escapeText = text => String(text || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getCandy() { return Math.max(0, Number(serverProgress.candy) || 0) + queue.filter(item => item.type === 'candy').reduce((sum, item) => sum + (item.delta || 1), 0); }
  function getBest(key) {
    const best = { ...(serverProgress.bestScores || {}) };
    queue.filter(item => item.type === 'best').forEach(item => { best[item.key] = Math.max(Number(best[item.key]) || 0, item.value); });
    return Number(best[key]) || 0;
  }
  function renderProgress() {
    document.dispatchEvent(new CustomEvent('zylox-progress-updated'));
  }
  async function syncQueue() {
    if (!account || syncing || !queue.length) return;
    syncing = true;
    const owner = account.id;
    try {
      while (account && account.id === owner && queue.length) {
        const item = queue[0];
        const result = item.type === 'candy'
          ? await api('/api/progress/candy', 'POST', { delta: item.delta || 1, operationId: item.id })
          : await api('/api/progress/best', 'POST', { key: item.key, value: item.value });
        if (!account || account.id !== owner) break;
        mergeProgress(result.progress);
        localStorage.removeItem(pendingPrefix() + item.id);
        queue = readQueue(); renderProgress();
      }
    } catch (_) {
      if (account && account.id === owner) {
        const warning = document.getElementById('accountSyncWarning');
        if (warning) warning.textContent = 'Progress is saved on this device and will sync when the server is available.';
      }
    } finally {
      syncing = false;
      if (account && queue.length) setTimeout(syncQueue, 15000);
    }
  }
  function addCandy() {
    if (!ready || !account) return;
    enqueue({ type: 'candy', id: newId() }); renderProgress(); syncQueue();
  }
  function saveBest(key, value) {
    if (!ready || !account || !key.startsWith('halloween_best_')) return;
    enqueue({ type: 'best', id: newId(), key, value }); renderProgress(); syncQueue();
  }
  async function activate(user) {
    ready = false;
    account = user;
    queue = readQueue();
    const result = await api('/api/progress');
    serverProgress = { candy: 0, bestScores: {} };
    mergeProgress(result.progress);
    renderProgress();
    const candy = Number(localStorage.getItem('zylox_candy'));
    const oldCandy = Number.isSafeInteger(candy) && candy > 0 ? candy : 0;
    const oldScores = Object.keys(localStorage).filter(key => /^halloween_best_[a-z0-9_]{1,80}$/.test(key)).map(key => [key, Number(localStorage.getItem(key))]).filter(([, value]) => Number.isSafeInteger(value) && value > 0 && value <= 1000000000);
    if ((oldCandy || oldScores.length) && !localStorage.getItem('zylox_legacy_migration_owner') && !localStorage.getItem('zylox_legacy_skipped_' + account.id)) {
      showMigration(oldCandy, oldScores);
    } else finishActivation();
  }
  function finishActivation() {
    ready = true; overlay.hidden = true;
    document.dispatchEvent(new CustomEvent('zylox-account-ready', { detail: account }));
    syncQueue();
  }
  function showMigration(oldCandy, oldScores) {
    overlay.hidden = false;
    const tooMany = oldCandy > 10000000;
    overlay.querySelector('.account-card').innerHTML = `<h2>Previous Progress</h2><p class="account-note">This browser has ${oldCandy} Candy and ${oldScores.length} saved best score(s). Import them into this account? Candy will be added and the higher best scores kept. The old browser data will remain here.</p>${tooMany ? '<p class="account-note">More than 10 million Candy cannot be imported automatically.</p>' : ''}<div class="account-actions"><button type="button" id="importProgress" ${tooMany ? 'disabled' : ''}>Import Progress</button><button type="button" id="skipProgress">Keep Separate</button></div>`;
    overlay.querySelector('#importProgress').onclick = () => {
      const migrationId = localStorage.getItem('zylox_legacy_migration_id') || newId();
      localStorage.setItem('zylox_legacy_migration_id', migrationId);
      let remaining = oldCandy;
      let chunk = 0;
      while (remaining > 0) {
        const delta = Math.min(100000, remaining);
        enqueue({ type: 'candy', id: migrationId + ':' + chunk++, delta }); remaining -= delta;
      }
      oldScores.forEach(([key, value], index) => enqueue({ type: 'best', id: migrationId + ':best:' + index, key, value }));
      localStorage.setItem('zylox_legacy_migration_owner', String(account.id));
      renderProgress(); finishActivation();
    };
    overlay.querySelector('#skipProgress').onclick = () => {
      localStorage.setItem('zylox_legacy_skipped_' + account.id, 'true');
      finishActivation();
    };
  }
  function setMessage(text) { message.textContent = text || ''; }
  function showAuth(mode = 'signup') {
    ready = false; overlay.hidden = false;
    const isLogin = mode === 'login';
    overlay.querySelector('.account-card').innerHTML = `<h2>${isLogin ? 'Log In' : 'Create Account'}</h2><form id="authForm"><label>Username<input name="username" autocomplete="username" required maxlength="32"></label><label>Password<input name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="8" maxlength="128"></label><button type="submit">${isLogin ? 'Log In' : 'Sign Up'}</button></form><button type="button" id="switchAuth">${isLogin ? 'Create Account' : 'Already have an account? Log In'}</button><button type="button" id="guestAuth">Play as Guest</button><p class="account-note">Guest progress is tied to the IPv6 address seen by the server and can be accessed by others sharing that address.</p><p class="account-message" role="status"></p>`;
    message = overlay.querySelector('.account-message');
    overlay.querySelector('#switchAuth').onclick = () => showAuth(isLogin ? 'signup' : 'login');
    overlay.querySelector('#guestAuth').onclick = async () => {
      setMessage('Connecting...');
      try { const result = await api('/api/account/guest', 'POST', {}); await activate(result.account); }
      catch (error) { setMessage(error.message); }
    };
    overlay.querySelector('#authForm').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget, username = form.elements.username.value.trim(), password = form.elements.password.value;
      setMessage('Connecting...');
      try { const result = await api(isLogin ? '/api/account/login' : '/api/account/signup', 'POST', { username, password }); form.reset(); await activate(result.account); }
      catch (error) { form.elements.password.value = ''; setMessage(error.message); }
    };
  }
  function showAccount() {
    if (!ready || !account) return;
    overlay.hidden = false;
    overlay.querySelector('.account-card').innerHTML = `<h2>Account</h2><p class="account-note">Signed in as ${escapeText(account.username || account.displayName)}</p><form id="displayForm"><label>Display name<input name="displayName" required maxlength="32" value="${escapeText(account.displayName)}"></label><button>Save Display Name</button></form>${account.isGuest ? '<p class="account-note">Guest accounts do not have a password.</p>' : '<form id="passwordForm"><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>New password<input name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><button>Reset Password</button></form>'}<p id="accountSyncWarning" class="account-note"></p><p class="account-message" role="status"></p><div class="account-actions"><button type="button" id="closeAccount">Back</button><button type="button" id="logoutAccount">Logout</button></div>`;
    message = overlay.querySelector('.account-message');
    overlay.querySelector('#closeAccount').onclick = () => { overlay.hidden = true; };
    overlay.querySelector('#displayForm').onsubmit = async event => {
      event.preventDefault();
      try { const result = await api('/api/account/display-name', 'PATCH', { displayName: event.currentTarget.elements.displayName.value.trim() }); account = result.account; setMessage('Display name updated.'); }
      catch (error) { setMessage(error.message); }
    };
    const passwordForm = overlay.querySelector('#passwordForm');
    if (passwordForm) passwordForm.onsubmit = async event => {
      event.preventDefault(); const form = event.currentTarget;
      try { await api('/api/account/password', 'POST', { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }); form.reset(); setMessage('Password updated.'); }
      catch (error) { form.reset(); setMessage(error.message); }
    };
    overlay.querySelector('#logoutAccount').onclick = async () => {
      try {
        if (queue.length) { await syncQueue(); if (queue.length) { setMessage('Progress has not synced. Reconnect before logging out.'); return; } }
        await api('/api/account/logout', 'POST', {});
        account = null; ready = false; queue = []; serverProgress = { candy: 0, bestScores: {} };
        showAuth();
      } catch (error) { setMessage(error.message); }
    };
  }
  window.ZyloxAccount = { get ready() { return ready; }, get account() { return account; }, showAccount, addCandy, saveBest, getCandy, getBest };
  const style = document.createElement('style');
  style.textContent = `.account-overlay{position:fixed;inset:0;z-index:99999;background:rgba(10,6,18,.96);display:flex;align-items:center;justify-content:center;color:#e0c8ff;font-family:'Segoe UI',sans-serif}.account-overlay[hidden]{display:none}.account-card{width:min(90vw,420px);max-height:90vh;overflow:auto;padding:22px;border:2px solid #6b4fa0;border-radius:14px;background:#1b1032;box-shadow:0 0 30px #6b4fa0}.account-card h2{text-align:center;color:#f7d51d;font-family:Cinzel,serif;margin:0 0 14px}.account-card form{display:grid;gap:8px;margin:10px 0}.account-card label{display:grid;gap:4px;font-weight:600;font-size:14px}.account-card input{padding:8px;border:1px solid #8a5cff;border-radius:6px;background:#0a0612;color:white;font:inherit}.account-card button{padding:8px 12px;border:1px solid #b794f6;border-radius:7px;background:#6b4fa0;color:#fff;cursor:pointer;font-weight:bold;margin:3px}.account-card>button{width:100%;margin:3px 0}.account-note,.account-message{font-size:12px;line-height:1.35;color:#d9c8ee}.account-message{color:#ffcd7a;min-height:1em}.account-actions{display:flex;justify-content:space-between}`;
  document.head.appendChild(style);
  overlay = document.createElement('div'); overlay.className = 'account-overlay'; overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
  overlay.innerHTML = '<div class="account-card"><h2>Connecting...</h2><p class="account-message" role="status"></p></div>';
  document.body.appendChild(overlay); message = overlay.querySelector('.account-message');
  window.addEventListener('online', () => { syncQueue(); refreshProgress(); });
  window.addEventListener('focus', refreshProgress);
  window.addEventListener('storage', event => {
    if (account && event.key && event.key.startsWith(pendingPrefix())) {
      queue = readQueue(); renderProgress(); syncQueue();
      if (event.newValue === null) refreshProgress();
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProgress(); });
  api('/api/account/me').then(result => result.account ? activate(result.account) : showAuth()).catch(error => { showAuth(); setMessage(error.message); });
})();
