(() => {
  const key = 'zylox_music';
  const audio = new Audio();
  audio.loop = true;
  let config = null;
  let objectUrl = null;
  let status = '';
  let waitingForGesture = false;
  let pendingSeek = false;
  let revision = 0;
  let trackRevision = 0;
  let playbackRevision = 0;
  let writeQueue = Promise.resolve();
  const listeners = new Set();

  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved.name === 'string' && saved.name) config = saved;
  } catch (_) {}

  function notify() { listeners.forEach(fn => fn(getState())); }
  function getState() { return { name: config?.name || null, playing: !!config && !audio.paused, status }; }
  function persist() {
    if (!config) return;
    if (!pendingSeek && audio.src && Number.isFinite(audio.currentTime)) config.position = audio.currentTime;
    localStorage.setItem(key, JSON.stringify(config));
  }
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('zylox_music', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('tracks');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function trackTransaction(mode, operation) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', mode);
      const request = operation(tx.objectStore('tracks'));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  function queueWrite(operation) {
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => {});
    return result;
  }
  function setTrack(file, position) {
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    const track = ++trackRevision;
    pendingSeek = Number.isFinite(position) && position > 0;
    audio.src = objectUrl;
    audio.addEventListener('loadedmetadata', () => {
      if (track !== trackRevision) return;
      const duration = audio.duration;
      if (pendingSeek) audio.currentTime = Number.isFinite(duration) && duration > 0 ? position % duration : position;
      pendingSeek = false;
    }, { once: true });
  }
  async function play() {
    if (!config || !audio.src) return;
    const playback = ++playbackRevision;
    config.playing = true;
    persist();
    try {
      await audio.play();
      if (playback !== playbackRevision) return;
      waitingForGesture = false;
      status = '';
    } catch (_) {
      if (playback !== playbackRevision) return;
      waitingForGesture = true;
      status = 'Click Play to resume the soundtrack.';
    }
    notify();
  }
  async function select(file) {
    if (!file || !/\.mp3$/i.test(file.name)) {
      status = 'Please choose an MP3 file.';
      notify();
      return;
    }
    const selection = ++revision;
    ++playbackRevision;
    try {
      await queueWrite(() => trackTransaction('readwrite', store => store.put(file, 'selected')));
      if (selection !== revision) return;
      config = { name: file.name, position: 0, playing: true };
      setTrack(file, 0);
      persist();
      status = '';
      notify();
      await play();
    } catch (_) {
      if (selection !== revision) return;
      status = 'Unable to save the soundtrack in this browser.';
      notify();
    }
  }
  async function clear() {
    ++revision;
    ++trackRevision;
    ++playbackRevision;
    config = null;
    waitingForGesture = false;
    pendingSeek = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    localStorage.removeItem(key);
    status = '';
    notify();
    try { await queueWrite(() => trackTransaction('readwrite', store => store.delete('selected'))); } catch (_) {}
  }
  function toggle() {
    if (!config) return;
    if (audio.paused) play();
    else {
      ++playbackRevision;
      config.playing = false;
      waitingForGesture = false;
      audio.pause();
      persist();
      status = '';
      notify();
    }
  }
  function resumeOnGesture() {
    if (waitingForGesture && config?.playing) play();
  }
  audio.addEventListener('timeupdate', persist);
  audio.addEventListener('play', notify);
  audio.addEventListener('pause', notify);
  audio.addEventListener('error', () => { status = 'Unable to play this MP3 file.'; notify(); });
  window.addEventListener('pagehide', persist);
  document.addEventListener('pointerdown', resumeOnGesture);
  document.addEventListener('keydown', resumeOnGesture);
  window.ZyloxMusic = { getState, select, clear, toggle, subscribe(fn) { listeners.add(fn); fn(getState()); } };

  if (config) {
    const restoration = revision;
    trackTransaction('readonly', store => store.get('selected')).then(file => {
      if (restoration !== revision) return;
      if (!file) {
        config = null;
        localStorage.removeItem(key);
        status = '';
        notify();
        return;
      }
      setTrack(file, Number(config.position) || 0);
      if (config.playing) play();
      else notify();
    }).catch(() => {
      if (restoration !== revision) return;
      status = 'Unable to load the saved soundtrack.';
      notify();
    });
  }
})();
