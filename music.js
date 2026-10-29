(() => {
  const key = 'zylox_music';
  const bundled = [{ id: 'bundled:amen-break', name: 'Amen Break', source: 'bundled', url: 'assets/music/amen-break.mp3' }];
  const audio = new Audio();
  audio.loop = true;
  const custom = new Map();
  const listeners = new Set();
  let config = null, objectUrl = null, status = '', pendingSeek = false, waitingForGesture = false;
  let revision = 0, trackRevision = 0, playbackRevision = 0;
  let writeQueue = Promise.resolve();

  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved.name === 'string' && saved.name) {
      config = { ...saved, id: saved.id || 'custom:legacy' };
    }
  } catch (_) {}

  function getTracks() {
    return bundled.map(({ id, name, source }) => ({ id, name, source }))
      .concat(Array.from(custom, ([id, file]) => ({ id, name: file.name, source: 'custom' })));
  }
  function getState() {
    return { name: config?.name || null, selectedId: config?.id || 'none', playing: !!config && !audio.paused, status, tracks: getTracks() };
  }
  function notify() { listeners.forEach(fn => fn(getState())); }
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
  async function loadCustomTracks() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readonly');
      const request = tx.objectStore('tracks').openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const id = cursor.key === 'selected' ? 'custom:legacy' : cursor.key;
        if (typeof id === 'string' && id.startsWith('custom:') && cursor.value?.name && !custom.has(id)) {
          custom.set(id, cursor.value);
        }
        cursor.continue();
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  function queueWrite(operation) {
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => {});
    return result;
  }
  function setTrack(source, position) {
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    const track = ++trackRevision;
    pendingSeek = Number.isFinite(position) && position > 0;
    if (typeof source === 'string') audio.src = source;
    else { objectUrl = URL.createObjectURL(source); audio.src = objectUrl; }
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
  function clear() {
    ++revision; ++trackRevision; ++playbackRevision;
    config = null; waitingForGesture = false; pendingSeek = false;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    localStorage.removeItem(key);
    status = '';
    notify();
  }
  function selectTrack(id) {
    if (id === 'none') { clear(); return; }
    const builtin = bundled.find(track => track.id === id);
    const file = custom.get(id);
    if (!builtin && !file) { status = 'Soundtrack is unavailable.'; notify(); return; }
    ++revision; ++playbackRevision;
    const track = builtin || { id, name: file.name };
    config = { id, name: track.name, position: 0, playing: true };
    waitingForGesture = false;
    status = '';
    setTrack(builtin ? builtin.url : file, 0);
    persist(); notify();
    play();
  }
  async function select(file) {
    if (!file || !/\.mp3$/i.test(file.name)) { status = 'Please choose an MP3 file.'; notify(); return; }
    const id = 'custom:' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
    custom.set(id, file);
    selectTrack(id);
    try {
      await queueWrite(() => trackTransaction('readwrite', store => store.put(file, id)));
    } catch (_) {
      status = 'Unable to save this soundtrack in the browser.';
      notify();
    }
  }
  function toggle() {
    if (!config) return;
    if (audio.paused) play();
    else {
      ++playbackRevision;
      config.playing = false; waitingForGesture = false;
      audio.pause(); persist(); status = ''; notify();
    }
  }
  function resumeOnGesture() { if (waitingForGesture && config?.playing) play(); }
  audio.addEventListener('timeupdate', persist);
  audio.addEventListener('play', notify);
  audio.addEventListener('pause', notify);
  audio.addEventListener('error', () => { status = 'Unable to play this MP3 file.'; notify(); });
  window.addEventListener('pagehide', persist);
  document.addEventListener('pointerdown', resumeOnGesture);
  document.addEventListener('keydown', resumeOnGesture);
  window.ZyloxMusic = { getState, select, selectTrack, clear, toggle, subscribe(fn) { listeners.add(fn); fn(getState()); } };

  const restoration = revision;
  const savedBuiltin = config && bundled.find(track => track.id === config.id);
  if (savedBuiltin) {
    setTrack(savedBuiltin.url, Number(config.position) || 0);
    if (config.playing) play();
  }
  loadCustomTracks().then(() => {
    if (restoration === revision && config && !savedBuiltin) {
      const file = custom.get(config.id);
      if (file) {
        setTrack(file, Number(config.position) || 0);
        if (config.playing) play();
      } else {
        config = null;
        localStorage.removeItem(key);
      }
    }
    notify();
  }).catch(() => {
    if (restoration === revision && config && !savedBuiltin) {
      status = 'Unable to load the saved soundtrack.';
    }
    notify();
  });
})();
