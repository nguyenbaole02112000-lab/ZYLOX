(function (root) {
  'use strict';
  const image = new Image();
  image.onload = () => document.dispatchEvent(new Event('bao-trial-witch-ready'));
  image.src = 'witch-horizontal.png';
  root.BaoTrialWitch = {
    draw(context, offset = 0) {
      if (!image.complete || !image.naturalWidth) return false;
      context.save();
      context.translate(0, offset);
      context.scale(1.5, 1.5);
      context.drawImage(image, 27, 244, 1199, 701, -49, -25, 80.333, 46.967);
      context.restore();
      return true;
    }
  };
})(globalThis);
