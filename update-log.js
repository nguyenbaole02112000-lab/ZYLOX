(() => {
  'use strict';
  const updates = [
    { id: 1, title: 'Update 1', entries: [
      ['New Entities', 'Bat, Witch, Ghost'],
      ['New Map', 'Halloween'],
      ['New Music', 'Amen Break']
    ] }
  ].sort((a, b) => b.id - a.id);
  const latest = updates[0];
  const overlay = document.getElementById('updateLogOverlay');
  const list = document.getElementById('updateLogList');
  const detail = document.getElementById('updateLogDetail');
  const openButton = document.getElementById('updateLogOpen');
  const closeButton = document.getElementById('updateLogClose');
  let accountKey = null;

  function selectUpdate(update) {
    list.querySelectorAll('button').forEach(button => {
      const selected = Number(button.dataset.id) === update.id;
      button.setAttribute('aria-current', selected ? 'true' : 'false');
      button.classList.toggle('active', selected);
    });
    detail.replaceChildren();
    const title = document.createElement('h2'); title.textContent = update.title;
    const items = document.createElement('ul');
    for (const [label, value] of update.entries) {
      const item = document.createElement('li');
      const strong = document.createElement('strong'); strong.textContent = label + ': ';
      item.append(strong, document.createTextNode(value)); items.appendChild(item);
    }
    detail.append(title, items);
  }
  for (const update of updates) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'update-log-item'; button.dataset.id = update.id;
    button.textContent = update.title; button.addEventListener('click', () => selectUpdate(update));
    list.appendChild(button);
  }
  function open() { selectUpdate(latest); overlay.hidden = false; closeButton.focus(); }
  function close() {
    if (accountKey) { try { localStorage.setItem(accountKey, String(latest.id)); } catch (_) {} }
    overlay.hidden = true; openButton.focus();
  }
  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) { event.preventDefault(); close(); }
  });
  function onAccountReady(account) {
    if (!account?.id) return;
    accountKey = 'bao_update_log_seen_' + account.id;
    let seen = 0;
    try { seen = Number(localStorage.getItem(accountKey)) || 0; } catch (_) {}
    if (seen < latest.id) open();
  }
  document.addEventListener('zylox-account-ready', event => onAccountReady(event.detail));
  if (window.ZyloxAccount?.ready) onAccountReady(window.ZyloxAccount.account);
})();
