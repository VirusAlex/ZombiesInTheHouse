// ─── Sector config ───
// Clockwise from 12 o'clock. 1 & 2 adjacent (big), then 3 & 4 adjacent (small).
const SECTORS = [
  { value: 1, label: 'Бег',          color: '#e8c830', icon: '🏃', iconFile: 'icons/1.png', degrees: 110 },
  { value: 2, label: 'Зомби кусает', color: '#4caf50', icon: '🧟', iconFile: 'icons/2.png', degrees: 110 },
  { value: 3, label: 'Ближний бой',  color: '#3b7dd8', icon: '⚔️', iconFile: 'icons/3.png', degrees: 70 },
  { value: 4, label: 'Дальний бой',  color: '#d94f4f', icon: '🎯', iconFile: 'icons/4.png', degrees: 70 },
];

const TOTAL_DEG = SECTORS.reduce((s, sec) => s + sec.degrees, 0);

// ─── Preload icon images (fallback to emoji if missing) ───
const sectorImages = {};
SECTORS.forEach(sec => {
  const img = new Image();
  img.src = sec.iconFile;
  img.onload = () => { sectorImages[sec.value] = img; drawWheel(currentAngle); };
});

// ─── Canvas setup ───
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
let size, cx, cy, radius;
let highlightSector = null;
let highlightPhase = 0;
let highlightAnimId = null;

function resizeCanvas() {
  const area = document.querySelector('.wheel-area');
  const areaRect = area.getBoundingClientRect();
  const pad = 16;
  const dim = Math.min(areaRect.width - pad, areaRect.height - pad);

  const wrapper = canvas.parentElement;
  wrapper.style.width = dim + 'px';
  wrapper.style.height = dim + 'px';

  // Scale pointer proportionally to wheel size
  const ptrW = Math.max(10, dim * 0.035);
  const ptrH = ptrW * 2;
  const ptr = document.getElementById('pointer');
  ptr.style.setProperty('--ptr-w', ptrW + 'px');
  ptr.style.setProperty('--ptr-h', ptrH + 'px');

  const dpr = window.devicePixelRatio || 1;
  size = Math.round(dim * dpr);
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = dim + 'px';
  canvas.style.height = dim + 'px';
  cx = size / 2;
  cy = size / 2;
  radius = size / 2 - 4 * dpr;
  drawWheel(currentAngle);
}

// ─── Draw ───
function degToRad(d) { return d * Math.PI / 180; }

function drawWheel(rotationDeg) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(degToRad(rotationDeg));

  let startAngle = -Math.PI / 2; // 12 o'clock

  // Pulsing highlight intensity (0..1)
  const pulse = highlightSector ? 0.5 + 0.5 * Math.sin(highlightPhase) : 0;

  const innerR = radius * 0.80; // boundary between number ring and icon area

  // ── Pass 1: Draw full sectors (background) ──
  SECTORS.forEach(sec => {
    const sweep = degToRad(sec.degrees);
    const endAngle = startAngle + sweep;
    const isHighlighted = highlightSector && highlightSector.value === sec.value;

    // Full sector fill
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = sec.color;
    ctx.fill();

    // Darken the outer ring slightly for contrast
    ctx.beginPath();
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.arc(0, 0, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // Dim non-winners
    if (highlightSector && !isHighlighted) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${0.35 + pulse * 0.1})`;
      ctx.fill();
    }

    // Sector divider lines
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, size / 300);
    ctx.stroke();

    startAngle = endAngle;
  });
  // Last divider
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, size / 300);
  ctx.stroke();

  // ── Ring boundary circle ──
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = Math.max(2, size / 200);
  ctx.stroke();

  // ── Pass 2: Highlight glow (winning sector) ──
  startAngle = -Math.PI / 2;
  SECTORS.forEach(sec => {
    const sweep = degToRad(sec.degrees);
    const endAngle = startAngle + sweep;
    const isHighlighted = highlightSector && highlightSector.value === sec.value;

    if (isHighlighted) {
      const glowWidth = Math.max(6, size / 60);

      // Outer glow arc
      ctx.beginPath();
      ctx.arc(0, 0, radius - glowWidth * 0.3, startAngle, endAngle);
      ctx.strokeStyle = sec.color;
      ctx.lineWidth = glowWidth;
      ctx.shadowColor = sec.color;
      ctx.shadowBlur = glowWidth * (1.5 + pulse * 2);
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Bright edge line
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, startAngle, endAngle);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(2, size / 200);
      ctx.stroke();

      // Radial edge glow
      for (const a of [startAngle, endAngle]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.3})`;
        ctx.lineWidth = Math.max(2, size / 250);
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = glowWidth * (0.5 + pulse);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    startAngle = endAngle;
  });

  // ── Pass 3: Icons (inner area) and Numbers (outer ring) ──
  startAngle = -Math.PI / 2;
  SECTORS.forEach(sec => {
    const sweep = degToRad(sec.degrees);
    const endAngle = startAngle + sweep;
    const isHighlighted = highlightSector && highlightSector.value === sec.value;
    const midAngle = startAngle + sweep / 2;
    const dimAlpha = (highlightSector && !isHighlighted) ? 0.45 : 1;

    // Icon — centered in inner area
    const iconR = radius * 0.52;
    const ix = Math.cos(midAngle) * iconR;
    const iy = Math.sin(midAngle) * iconR;

    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.globalAlpha = dimAlpha;

    const iconSz = radius * 0.38;
    const img = sectorImages[sec.value];

    if (img) {
      ctx.drawImage(img, -iconSz / 2, -iconSz / 2, iconSz, iconSz);
    } else {
      ctx.font = `${iconSz}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sec.icon, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Number — centered in outer ring band
    const numR = (innerR + radius) / 2;
    const nx = Math.cos(midAngle) * numR;
    const ny = Math.sin(midAngle) * numR;

    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.globalAlpha = dimAlpha;

    ctx.font = `bold ${radius * 0.14}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isHighlighted) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 8 + pulse * 12;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
    }
    ctx.fillText(sec.value, 0, 0);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();

    startAngle = endAngle;
  });

  // Center circle
  const centerR = radius * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, centerR * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#e74c3c';
  ctx.fill();

  ctx.restore();

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(2, size / 200);
  ctx.stroke();
}

// ─── Spin physics ───
let currentAngle = 0;
let angularVel = 0;
let spinning = false;
let animId = null;

const FRICTION_LINEAR = 0.0003;
const FRICTION_PROPORTIONAL = 0.0025;
const MIN_VELOCITY = 0.4;
const MAX_VELOCITY = 3.0;
const STOP_THRESHOLD = 0.005;

function getResultSector(angleDeg) {
  let pointerAngle = (((-angleDeg % 360) + 360) % 360);
  let cumulative = 0;
  for (const sec of SECTORS) {
    cumulative += sec.degrees;
    if (pointerAngle < cumulative) return sec;
  }
  return SECTORS[SECTORS.length - 1];
}

function startSpinAnimation() {
  spinning = true;
  stopHighlight();
  canvas.classList.add('spinning');
  document.getElementById('hint').classList.add('hidden');

  let lastTime = performance.now();
  let lastTickAngle = currentAngle;
  const initialSign = angularVel > 0 ? 1 : -1;

  function animate(now) {
    const dt = now - lastTime;
    lastTime = now;

    // Apply friction: proportional (smooth at low speed) + small linear (ensures stop)
    const speed = Math.abs(angularVel);
    const frictionForce = speed * FRICTION_PROPORTIONAL + FRICTION_LINEAR;
    angularVel -= initialSign * frictionForce * dt;

    // Stop if velocity crossed zero or below threshold
    if (Math.abs(angularVel) <= STOP_THRESHOLD || (initialSign > 0 && angularVel < 0) || (initialSign < 0 && angularVel > 0)) {
      angularVel = 0;
      spinning = false;
      canvas.classList.remove('spinning');

      // Highlight the winning sector with pulsing animation
      const result = getResultSector(currentAngle);
      highlightSector = result;
      highlightPhase = 0;
      startHighlightAnimation();
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      return;
    }

    currentAngle += angularVel * dt;
    drawWheel(currentAngle);

    // Tick feedback every ~18 degrees
    if (Math.abs(currentAngle - lastTickAngle) > 18) {
      lastTickAngle = currentAngle;
      if (navigator.vibrate) navigator.vibrate(6);
      const ptr = document.getElementById('pointer');
      ptr.classList.add('flash');
      setTimeout(() => ptr.classList.remove('flash'), 60);
    }

    animId = requestAnimationFrame(animate);
  }

  animId = requestAnimationFrame(animate);
}

function startHighlightAnimation() {
  if (highlightAnimId) cancelAnimationFrame(highlightAnimId);
  let lastTime = performance.now();
  function animateHighlight(now) {
    const dt = now - lastTime;
    lastTime = now;
    highlightPhase += dt * 0.004;
    drawWheel(currentAngle);
    if (highlightSector) {
      highlightAnimId = requestAnimationFrame(animateHighlight);
    }
  }
  highlightAnimId = requestAnimationFrame(animateHighlight);
}

function stopHighlight() {
  highlightSector = null;
  highlightPhase = 0;
  if (highlightAnimId) {
    cancelAnimationFrame(highlightAnimId);
    highlightAnimId = null;
  }
  drawWheel(currentAngle);
}

// ─── Input: swipe-based angular velocity ───
let pointerHistory = [];
let isDown = false;

function getWheelCenter() {
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function computeReleaseVelocity() {
  if (pointerHistory.length < 2) return 0;
  const center = getWheelCenter();
  const tail = pointerHistory.slice(-4);
  let totalAngle = 0, totalTime = 0;
  for (let i = 1; i < tail.length; i++) {
    const prev = tail[i - 1], curr = tail[i];
    const a1 = Math.atan2(prev.y - center.y, prev.x - center.x);
    const a2 = Math.atan2(curr.y - center.y, curr.x - center.x);
    let da = (a2 - a1) * 180 / Math.PI;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    totalAngle += da;
    totalTime += curr.t - prev.t;
  }
  return totalTime > 0 ? totalAngle / totalTime : 0;
}

function computeAverageVelocity() {
  if (pointerHistory.length < 2) return 0;
  const center = getWheelCenter();
  let totalAngle = 0, totalTime = 0;
  for (let i = 1; i < pointerHistory.length; i++) {
    const prev = pointerHistory[i - 1], curr = pointerHistory[i];
    const a1 = Math.atan2(prev.y - center.y, prev.x - center.x);
    const a2 = Math.atan2(curr.y - center.y, curr.x - center.x);
    let da = (a2 - a1) * 180 / Math.PI;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    totalAngle += da;
    totalTime += curr.t - prev.t;
  }
  return totalTime > 0 ? totalAngle / totalTime : 0;
}

canvas.addEventListener('pointerdown', (e) => {
  if (spinning) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  isDown = true;
  stopHighlight();
  pointerHistory = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
});

canvas.addEventListener('pointermove', (e) => {
  if (!isDown || spinning) return;
  pointerHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (pointerHistory.length > 20) pointerHistory.shift();
});

canvas.addEventListener('pointerup', (e) => {
  if (!isDown || spinning) return;
  isDown = false;
  pointerHistory.push({ x: e.clientX, y: e.clientY, t: performance.now() });

  const startPt = pointerHistory[0];
  const elapsed = performance.now() - startPt.t;
  const totalDist = Math.hypot(e.clientX - startPt.x, e.clientY - startPt.y);

  const releaseVel = computeReleaseVelocity();
  const avgVel = computeAverageVelocity();

  let vel;
  let inputType;

  if (elapsed < 150 && totalDist < 15) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    vel = dir * (0.8 + Math.random() * 1.5);
    inputType = 'tap';
  } else {
    const rawVel = Math.abs(releaseVel) >= Math.abs(avgVel) ? releaseVel : avgVel;
    vel = rawVel * 2;
    inputType = Math.abs(releaseVel) >= Math.abs(avgVel) ? 'release' : 'average';
  }

  const dir = vel >= 0 ? 1 : -1;
  let speed = Math.abs(vel);

  const randomRaw = (Math.random() - 0.5) * 2;
  const randomFactor = 0.1 + speed * 0.15;
  const randomDelta = randomRaw * randomFactor;
  speed += randomDelta;

  speed = Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, speed));

  angularVel = dir * speed;

  console.group('🎡 Spin');
  console.log('Input:', inputType);
  console.log('Start:', { x: Math.round(startPt.x), y: Math.round(startPt.y) });
  console.log('End:  ', { x: Math.round(e.clientX), y: Math.round(e.clientY) });
  console.log('Wheel center:', getWheelCenter());
  console.log(`Elapsed: ${elapsed.toFixed(0)}ms, Distance: ${totalDist.toFixed(1)}px`);
  console.log(`Samples: ${pointerHistory.length}`);
  console.log(`Release vel: ${releaseVel.toFixed(4)} deg/ms`);
  console.log(`Average vel: ${avgVel.toFixed(4)} deg/ms`);
  console.log(`Chosen vel: ${vel.toFixed(4)} deg/ms (via ${inputType})`);
  console.log(`Direction: ${dir > 0 ? 'CW ↻' : 'CCW ↺'}`);
  console.log(`Speed before random: ${Math.abs(vel).toFixed(4)}`);
  console.log(`Random: ${randomRaw.toFixed(3)} × ${randomFactor.toFixed(3)} = ${randomDelta.toFixed(4)}`);
  console.log(`Speed after random: ${(Math.abs(vel) + randomDelta).toFixed(4)}`);
  console.log(`Final angularVel: ${angularVel.toFixed(4)} deg/ms (speed: ${speed.toFixed(4)}, dir: ${dir})`);
  console.groupEnd();

  startSpinAnimation();
});

canvas.addEventListener('pointercancel', () => { isDown = false; });

// Keyboard fallback
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (spinning) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    angularVel = dir * (MIN_VELOCITY + Math.random() * (MAX_VELOCITY - MIN_VELOCITY));
    startSpinAnimation();
  }
});

// ─── PWA Install ───
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});

// ─── Init ───
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
