(function (root) {
  'use strict';
  function ghost(c, offset = 0) {
    c.save(); c.translate(0, offset); c.shadowColor='#c2edff';c.shadowBlur=10;
    const g=c.createLinearGradient(0,-25,0,24);g.addColorStop(0,'#f4ffff');g.addColorStop(1,'#9fb5dc');
    c.fillStyle=g;c.strokeStyle='#a1d8ff';c.lineWidth=2;
    c.beginPath();c.moveTo(-16,16);c.lineTo(-16,-6);c.bezierCurveTo(-16,-29,16,-29,16,-6);c.lineTo(16,17);c.quadraticCurveTo(11,11,7,17);c.quadraticCurveTo(3,11,0,17);c.quadraticCurveTo(-5,11,-9,17);c.quadraticCurveTo(-13,11,-16,16);c.closePath();c.fill();c.stroke();
    c.shadowBlur=0;c.fillStyle='#282442';c.beginPath();c.ellipse(2,-5,2.5,4,0,0,Math.PI*2);c.ellipse(11,-5,1.8,3.7,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(7,4,2,3,0,0,Math.PI*2);c.fill();c.restore();
  }
  function witch(c, offset = 0) {
    if(root.BaoTrialWitch?.draw(c,offset)) return;
    c.save();c.translate(0,offset);c.shadowColor='#bc83ff';c.shadowBlur=9;
    c.strokeStyle='#bc8b4a';c.lineWidth=3;c.beginPath();c.moveTo(-23,13);c.lineTo(21,8);c.stroke();
    c.fillStyle='#d6ad68';c.beginPath();c.moveTo(-25,8);c.lineTo(-38,7);c.lineTo(-35,19);c.lineTo(-23,15);c.closePath();c.fill();
    c.fillStyle='#542f80';c.strokeStyle='#ad80e4';c.lineWidth=2;c.beginPath();c.moveTo(-12,-6);c.quadraticCurveTo(-17,9,-5,13);c.lineTo(9,11);c.lineTo(7,-6);c.closePath();c.fill();c.stroke();
    c.fillStyle='#ead4bc';c.beginPath();c.arc(0,-11,8,0,Math.PI*2);c.fill();
    c.fillStyle='#241336';c.beginPath();c.moveTo(-10,-17);c.lineTo(0,-33);c.lineTo(7,-18);c.lineTo(14,-16);c.quadraticCurveTo(0,-12,-13,-16);c.closePath();c.fill();c.stroke();
    c.fillStyle='#1e1830';c.beginPath();c.arc(3,-11,1.3,0,Math.PI*2);c.fill();c.restore();
  }
  root.BaoEntityArt = { ghost, witch };
})(globalThis);
