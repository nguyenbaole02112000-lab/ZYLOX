(function () {
  'use strict';
  const preferenceKey = 'bao_fullscreen_session';
  const lobbyButton = document.getElementById('fullscreenToggle');
  let leaving = false;
  let lockedOrientation = false;
  let noticeTimer;
  const style = document.createElement('style');
  style.textContent = '.fullscreen-resume,.fullscreen-status{position:fixed;left:50%;transform:translateX(-50%);z-index:90000;border:1px solid #b794f6;border-radius:8px;background:#34214e;color:#ffe276;padding:8px 14px;font:700 14px Segoe UI,sans-serif;box-shadow:0 0 15px #7850aa88}.fullscreen-resume{bottom:12px;cursor:pointer}.fullscreen-status{top:12px;text-align:center}.fullscreen-resume[hidden],.fullscreen-status[hidden]{display:none}';
  document.head.appendChild(style);
  const status = document.createElement('div');
  status.className = 'fullscreen-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  document.body.appendChild(status);

  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'fullscreen-resume';
  resume.textContent = 'Tap to resume fullscreen';
  resume.hidden = true;
  document.body.appendChild(resume);

  function desired() {
    try { return sessionStorage.getItem(preferenceKey) === 'on'; } catch (_) { return false; }
  }
  function setDesired(value) {
    try { sessionStorage.setItem(preferenceKey, value ? 'on' : 'off'); } catch (_) {}
  }
  function message(text) {
    clearTimeout(noticeTimer);
    status.textContent = text;
    status.hidden = false;
    noticeTimer = setTimeout(() => { status.hidden = true; }, 5000);
  }
  function update() {
    const active = Boolean(document.fullscreenElement);
    if (lobbyButton) {
      lobbyButton.textContent = 'Fullscreen Mode: ' + (active ? 'ON' : 'OFF');
      lobbyButton.setAttribute('aria-pressed', String(active));
    }
    resume.textContent = active ? 'Fullscreen Mode: ON' : 'Tap to resume fullscreen';
    resume.hidden = Boolean(lobbyButton) || (!active && !desired());
  }
  async function enter() {
    if (!document.documentElement.requestFullscreen) {
      setDesired(false);
      update();
      message('Fullscreen is not supported in this browser.');
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      setDesired(true);
      update();
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        try {
          await screen.orientation.lock('landscape');
          lockedOrientation = true;
        } catch (_) {
          if (window.matchMedia('(orientation: portrait)').matches) message('Rotate your device for landscape mode.');
        }
      } else if (window.matchMedia('(orientation: portrait)').matches) {
        message('Rotate your device for landscape mode.');
      }
    } catch (_) {
      setDesired(false);
      update();
      message('Unable to enter fullscreen. Please try again.');
    }
  }
  async function toggle() {
    if (!document.fullscreenElement) return enter();
    setDesired(false);
    try { await document.exitFullscreen(); } catch (_) { message('Unable to exit fullscreen.'); }
    update();
  }
  lobbyButton?.addEventListener('click', toggle);
  resume.addEventListener('click', toggle);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !leaving) {
      setDesired(false);
      if (lockedOrientation && screen.orientation?.unlock) screen.orientation.unlock();
      lockedOrientation = false;
    }
    update();
  });
  window.addEventListener('pagehide', () => { leaving = true; });
  update();
})();
