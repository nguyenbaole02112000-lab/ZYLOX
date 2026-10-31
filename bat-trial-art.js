(function (root) {
  'use strict';
  const pictures = {};
  const scale = 0.0462;
  const origin = { x: 880, y: 1290 };
  const frames = {
    up: { url: 'bat-up.webp', x: 50, y: 30, width: 1370, height: 1530 },
    down: { url: 'bat-down.webp', x: 320, y: 1081, width: 1170, height: 1480 }
  };
  function load(name, frame) {
    const image = new Image();
    image.onload = () => {
      const surface = document.createElement('canvas');
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, surface.width, surface.height);
      for (let i = 0; i < data.data.length; i += 4) {
        const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
        if (data.data[i + 3] && r > 65 && b > 95 && r > g * 1.2 && b > g * 1.2) {
          data.data[i] = 146; data.data[i + 1] = 65; data.data[i + 2] = 226;
        }
      }
      context.putImageData(data, 0, 0);
      pictures[name] = surface;
      if (pictures.up && pictures.down) document.dispatchEvent(new Event('bao-trial-bat-ready'));
    };
    image.src = frame.url;
  }
  Object.entries(frames).forEach(([name, frame]) => load(name, frame));
  root.BaoTrialBat = {
    draw(context, wingsUp) {
      const name = wingsUp ? 'up' : 'down';
      const frame = frames[name], picture = pictures[name];
      if (!picture) return false;
      context.drawImage(picture, (frame.x - origin.x) * scale, (frame.y - origin.y) * scale,
        frame.width * scale, frame.height * scale);
      return true;
    }
  };
})(globalThis);
