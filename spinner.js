// ─── Settings system ───
const DEFAULTS = {
  frictionLinear:       0.0003,
  frictionProportional: 0.0025,
  minVelocity:          0.7,
  maxVelocity:          3.5,
  velocityMultiplier:   3.5,
  randomStrength:       0.15,
};

const SETTINGS_META = {
  velocityMultiplier:   { label: 'Сила раскрутки',    min: 1,      max: 8,     step: 0.5  },
  minVelocity:          { label: 'Мин. скорость',     min: 0.2,    max: 2,     step: 0.1  },
  maxVelocity:          { label: 'Макс. скорость',    min: 1.5,    max: 6,     step: 0.5  },
  frictionProportional: { label: 'Трение',            min: 0.0005, max: 0.008, step: 0.0005 },
  frictionLinear:       { label: 'Трение (линейное)', min: 0.0001, max: 0.001, step: 0.0001 },
  randomStrength:       { label: 'Сила рандома',      min: 0,      max: 0.5,   step: 0.05 },
};

let settings = { ...DEFAULTS };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('zombie_settings'));
    if (saved) Object.assign(settings, saved);
  } catch (e) {}
}

function saveSettings() {
  try { localStorage.setItem('zombie_settings', JSON.stringify(settings)); } catch (e) {}
}

function resetSettings() {
  settings = { ...DEFAULTS };
  saveSettings();
}

loadSettings();

// ─── Settings dialog ───
function openSettings() {
  if (document.getElementById('settingsDialog')) return;

  const overlay = document.createElement('div');
  overlay.id = 'settingsDialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;';

  const panel = document.createElement('div');
  panel.style.cssText = 'background:#2a2a4a;border-radius:16px;padding:20px;max-width:360px;width:100%;max-height:90vh;overflow-y:auto;color:#eee;font-family:inherit;';

  let html = '<h2 style="margin:0 0 16px;font-size:1.1rem;text-align:center;">Настройки</h2>';

  for (const [key, meta] of Object.entries(SETTINGS_META)) {
    const val = settings[key];
    const decimals = meta.step < 0.001 ? 4 : meta.step < 0.01 ? 3 : meta.step < 0.1 ? 2 : 1;
    html += `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
          <span>${meta.label}</span>
          <span id="val_${key}" style="opacity:0.7;font-variant-numeric:tabular-nums;">${val.toFixed(decimals)}</span>
        </div>
        <input type="range" id="rng_${key}" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${val}"
          style="width:100%;accent-color:#e74c3c;">
      </div>`;
  }

  html += `
    <div style="display:flex;gap:10px;margin-top:18px;">
      <button id="settingsReset" style="flex:1;padding:10px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:#eee;border-radius:8px;cursor:pointer;font-size:0.85rem;">Сброс</button>
      <button id="settingsClose" style="flex:1;padding:10px;border:none;background:#e74c3c;color:#fff;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;">Готово</button>
    </div>`;

  panel.innerHTML = html;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Bind sliders
  for (const [key, meta] of Object.entries(SETTINGS_META)) {
    const rng = document.getElementById('rng_' + key);
    const valEl = document.getElementById('val_' + key);
    const decimals = meta.step < 0.001 ? 4 : meta.step < 0.01 ? 3 : meta.step < 0.1 ? 2 : 1;
    rng.addEventListener('input', () => {
      settings[key] = parseFloat(rng.value);
      valEl.textContent = settings[key].toFixed(decimals);
      saveSettings();
    });
  }

  document.getElementById('settingsReset').addEventListener('click', () => {
    resetSettings();
    for (const [key, meta] of Object.entries(SETTINGS_META)) {
      const rng = document.getElementById('rng_' + key);
      const valEl = document.getElementById('val_' + key);
      const decimals = meta.step < 0.001 ? 4 : meta.step < 0.01 ? 3 : meta.step < 0.1 ? 2 : 1;
      rng.value = settings[key];
      valEl.textContent = settings[key].toFixed(decimals);
    }
  });

  const close = () => overlay.remove();
  document.getElementById('settingsClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

document.getElementById('settingsBtn').addEventListener('click', openSettings);

// ─── Sector config ───
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

  let startAngle = -Math.PI / 2;

  const pulse = highlightSector ? 0.5 + 0.5 * Math.sin(highlightPhase) : 0;
  const innerR = radius * 0.80;

  // ── Pass 1: Sectors background ──
  SECTORS.forEach(sec => {
    const sweep = degToRad(sec.degrees);
    const endAngle = startAngle + sweep;
    const isHighlighted = highlightSector && highlightSector.value === sec.value;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = sec.color;
    ctx.fill();

    // Darken outer ring for contrast
    ctx.beginPath();
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.arc(0, 0, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    if (highlightSector && !isHighlighted) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${0.35 + pulse * 0.1})`;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, size / 300);
    ctx.stroke();

    startAngle = endAngle;
  });
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, size / 300);
  ctx.stroke();

  // Ring boundary
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = Math.max(2, size / 200);
  ctx.stroke();

  // ── Pass 2: Highlight glow ──
  startAngle = -Math.PI / 2;
  SECTORS.forEach(sec => {
    const sweep = degToRad(sec.degrees);
    const endAngle = startAngle + sweep;
    const isHighlighted = highlightSector && highlightSector.value === sec.value;

    if (isHighlighted) {
      const glowWidth = Math.max(6, size / 60);

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

      ctx.beginPath();
      ctx.arc(0, 0, radius - 1, startAngle, endAngle);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = Math.max(2, size / 200);
      ctx.stroke();

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

  // ── Pass 3: Icons and numbers ──
  startAngle = -Math.PI / 2;
  SECTORS.forEach(sec => {
    const sweep = degToRad(sec.degrees);
    const endAngle = startAngle + sweep;
    const isHighlighted = highlightSector && highlightSector.value === sec.value;
    const midAngle = startAngle + sweep / 2;
    const dimAlpha = (highlightSector && !isHighlighted) ? 0.45 : 1;

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

    const speed = Math.abs(angularVel);
    const frictionForce = speed * settings.frictionProportional + settings.frictionLinear;
    angularVel -= initialSign * frictionForce * dt;

    if (Math.abs(angularVel) <= STOP_THRESHOLD || (initialSign > 0 && angularVel < 0) || (initialSign < 0 && angularVel > 0)) {
      angularVel = 0;
      spinning = false;
      canvas.classList.remove('spinning');

      const result = getResultSector(currentAngle);
      highlightSector = result;
      highlightPhase = 0;
      startHighlightAnimation();
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      return;
    }

    currentAngle += angularVel * dt;
    drawWheel(currentAngle);

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
    vel = rawVel * settings.velocityMultiplier;
    inputType = Math.abs(releaseVel) >= Math.abs(avgVel) ? 'release' : 'average';
  }

  const dir = vel >= 0 ? 1 : -1;
  let speed = Math.abs(vel);

  const randomRaw = (Math.random() - 0.5) * 2;
  const randomFactor = 0.1 + speed * settings.randomStrength;
  const randomDelta = randomRaw * randomFactor;
  speed += randomDelta;

  speed = Math.max(settings.minVelocity, Math.min(settings.maxVelocity, speed));

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
    angularVel = dir * (settings.minVelocity + Math.random() * (settings.maxVelocity - settings.minVelocity));
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
