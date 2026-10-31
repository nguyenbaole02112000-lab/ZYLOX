(function (root) {
  'use strict';
  const radius = 12;
  function create(entity, map, height, random = Math.random) {
    if (entity !== 'Ghost' || map !== 'Halloween') return [];
    const low = 45, high = Math.max(low, height - 105);
    return [-270, -120, 30].map(dx => ({ dx, y: low + random() * (high - low) }));
  }
  function hits(player, pipe) {
    return (pipe.seals || []).some(seal => Math.hypot(player.x - (pipe.x + seal.dx), player.y - seal.y) < player.r + radius);
  }
  function draw(context, pipe) {
    for (const seal of pipe.seals || []) {
      context.save(); context.translate(pipe.x + seal.dx, seal.y);
      context.strokeStyle = '#ffb04c'; context.shadowColor = '#ff7d25'; context.shadowBlur = 14; context.lineWidth = 3;
      context.beginPath(); context.arc(0, 0, radius, 0, Math.PI * 2);
      context.moveTo(-8, 0); context.lineTo(8, 0); context.moveTo(0, -8); context.lineTo(0, 8);
      context.stroke(); context.restore();
    }
  }
  root.BaoGhostSeals = { create, hits, draw };
})(globalThis);
