// ─── CANVAS SETUP ────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('wrap');
const NAV_H = 48;
let W, H;
const isMobile = () => ('ontouchstart' in window) && window.innerWidth < 540;
function resize() {
    const avH = window.innerHeight - NAV_H;
    W = isMobile() ? Math.min(window.innerWidth, 420) : window.innerWidth;
    H = isMobile() ? Math.min(avH, 720) : avH;
    canvas.width = W; canvas.height = H;
    wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
}
resize(); window.addEventListener('resize', resize);

// ─── COLOURS ─────────────────────────────────────────────────────────────────
const C = { bg: '#04040e', cyan: '#00ffe5', magenta: '#ff00cc', yellow: '#ffe600', red: '#ff2244', white: '#ffffff', green: '#00ff88', orange: '#ff8800' };

// ─── GAME STATE ──────────────────────────────────────────────────────────────
const MAX_DRONES = 5;
const SLOW_DURATION = 300; // 5 seconds at 60fps
let state = 'menu'; // menu|playing|paused|levelup|gameover
let score = 0, dispScore = 0, combo = 0, comboTimer = 0;
let lives = 3, level = 1, frame = 0, shakeFrames = 0;
let highScore = +localStorage.getItem('neonSurgeHS') || 0;
let levelUpTimer = 0, levelStartTimer = 0;
let deathReason = '', lastDeathReason = '';
let slowTimer = 0; // counts down from SLOW_DURATION
let username = '';
let activeTab = 'play';
let lbFilter = 'daily';
let pausedForTab = false;

// ─── PLAYER ──────────────────────────────────────────────────────────────────
const PL = { x: 0, y: 0, r: 13, vx: 0, vy: 0, invincible: 0, shield: 0, trail: [] };

// ─── OBJECTS ─────────────────────────────────────────────────────────────────
let crystals = [], drones = [], barriers = [], missiles = [], particles = [], powerups = [];

// ─── INPUT ───────────────────────────────────────────────────────────────────
let cursor = { x: 0, y: 0 };
const keys = {};
canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); cursor.x = e.clientX - r.left; cursor.y = e.clientY - r.top; });
canvas.addEventListener('touchmove', e => { e.preventDefault(); const r = canvas.getBoundingClientRect(); cursor.x = e.touches[0].clientX - r.left; cursor.y = e.touches[0].clientY - r.top; }, { passive: false });
canvas.addEventListener('touchstart', e => {
    e.preventDefault(); const r = canvas.getBoundingClientRect();
    cursor.x = e.touches[0].clientX - r.left; cursor.y = e.touches[0].clientY - r.top;
    if (state === 'menu' || state === 'gameover') startGame();
}, { passive: false });
document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyP' && (state === 'playing' || state === 'levelup')) { state = 'paused'; return; }
    if (e.code === 'KeyR' && state === 'paused') { state = 'playing'; return; }
    if (e.code === 'Escape' && state !== 'menu') { startGame(); return; }
    if ((e.code === 'Space' || e.code === 'Enter') && (state === 'menu' || state === 'gameover')) startGame();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('click', () => { if (state === 'menu' || state === 'gameover') startGame(); });

// ─── NAV TABS ────────────────────────────────────────────────────────────────
document.getElementById('tab-play').addEventListener('click', () => {
    activeTab = 'play';
    document.getElementById('tab-play').classList.add('active');
    document.getElementById('tab-lb').classList.remove('active');
    document.getElementById('game-area').style.display = 'flex';
    document.getElementById('lb-panel').style.display = 'none';
    if (pausedForTab) { pausedForTab = false; if (state === 'paused') state = 'playing'; }
});
document.getElementById('tab-lb').addEventListener('click', () => {
    activeTab = 'lb';
    document.getElementById('tab-lb').classList.add('active');
    document.getElementById('tab-play').classList.remove('active');
    document.getElementById('game-area').style.display = 'none';
    document.getElementById('lb-panel').style.display = 'block';
    if (state === 'playing' || state === 'levelup') { pausedForTab = true; state = 'paused'; }
    renderLeaderboard();
});
document.querySelectorAll('.lb-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        lbFilter = btn.dataset.p;
        renderLeaderboard();
    });
});

// ─── USERNAME MODAL ──────────────────────────────────────────────────────────
function initUser() {
    const saved = localStorage.getItem('neonSurgeUser');
    if (saved) {
        username = saved;
        document.getElementById('nav-user').textContent = saved;
    } else {
        document.getElementById('um').style.display = 'flex';
        setTimeout(() => document.getElementById('um-input').focus(), 300);
    }
}
document.getElementById('um-btn').addEventListener('click', submitUsername);
document.getElementById('um-input').addEventListener('keydown', e => { if (e.code === 'Enter') submitUsername(); });
function submitUsername() {
    const val = document.getElementById('um-input').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (val.length < 2) { document.getElementById('um-err').textContent = 'MIN 2 CHARACTERS'; return; }
    username = val;
    localStorage.setItem('neonSurgeUser', val);
    document.getElementById('nav-user').textContent = val;
    document.getElementById('um').style.display = 'none';
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
function saveScore() {
    if (score <= 0) return;
    const lb = JSON.parse(localStorage.getItem('neonSurgeLB') || '[]');
    lb.push({ name: username || 'ANONYMOUS', score, level, ts: Date.now() });
    if (lb.length > 1000) lb.sort((a, b) => b.score - a.score).splice(1000);
    localStorage.setItem('neonSurgeLB', JSON.stringify(lb));
}
function renderLeaderboard() {
    const lb = JSON.parse(localStorage.getItem('neonSurgeLB') || '[]');
    const now = Date.now();
    const DAY = 86400000, WEEK = 7 * DAY;
    let rows = lb;
    if (lbFilter === 'daily') rows = lb.filter(e => now - e.ts < DAY);
    if (lbFilter === 'weekly') rows = lb.filter(e => now - e.ts < WEEK);
    rows.sort((a, b) => b.score - a.score);
    const body = document.getElementById('lb-body');
    if (!rows.length) { body.innerHTML = '<div class="lb-empty">NO SCORES YET<br>BE THE FIRST TO PLAY!</div>'; return; }
    let html = `<table class="lb-table">
    <thead><tr>
      <th style="width:44px">#</th>
      <th>PLAYER</th>
      <th class="r">SCORE</th>
      <th class="r">LEVEL</th>
    </tr></thead><tbody>`;
    rows.forEach((e, i) => {
        const rk = i + 1;
        const rc = rk === 1 ? 'r1' : rk === 2 ? 'r2' : rk === 3 ? 'r3' : '';
        const med = rk === 1 ? '<span class="medal m1">1</span>' : rk === 2 ? '<span class="medal m2">2</span>' : rk === 3 ? '<span class="medal m3">3</span>' : '';
        const nm = String(e.name || 'ANONYMOUS').substring(0, 14);
        html += `<tr class="${rc}">
      <td>${rk}</td>
      <td><span class="pname">${med}${nm}</span></td>
      <td class="r lb-score">${String(e.score).padStart(7, '0')}</td>
      <td class="r lb-lv">LV ${e.level}</td>
    </tr>`;
    });
    html += '</tbody></table>';
    body.innerHTML = html;
}

// ─── LEVEL CONFIG ────────────────────────────────────────────────────────────
function cfg(lvl) {
    return {
        scoreGoal: lvl * 600,
        crystalRate: Math.max(30, 75 - lvl * 6),
        droneRate: Math.max(55, 180 - lvl * 18),
        missileRate: lvl >= 4 ? Math.max(70, 200 - lvl * 15) : 0,
        barrierRate: lvl >= 2 ? Math.max(100, 280 - lvl * 20) : 0,
        powerupRate: Math.max(280, 500 - lvl * 20),
        droneSpeed: 0.9 + lvl * 0.18,
    };
}

// ─── PARTICLES ───────────────────────────────────────────────────────────────
function burst(x, y, col, n, spd = 3) {
    for (let i = 0; i < n; i++) {
        const a = Math.PI * 2 / n * i + Math.random() * .4, s = spd * .6 + Math.random() * spd;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + Math.random() * 2, life: 1, col, type: 'dot' });
    }
}
function scoreText(x, y, txt, col) { particles.push({ type: 'text', x, y, vy: -1.5, life: 1, txt, col }); }

// ─── SPAWN ───────────────────────────────────────────────────────────────────
function spawnCrystal() {
    const hue = 140 + Math.random() * 80;
    crystals.push({ x: 30 + Math.random() * (W - 60), y: -20, vy: 1.4 + Math.random() * .8, r: 7 + Math.random() * 4, hue, pulse: Math.random() * Math.PI * 2, rotation: 0 });
}
function spawnDrone() {
    if (drones.length >= MAX_DRONES) { const ev = drones.shift(); burst(ev.x, ev.y, C.red, 5, 2); }
    const c = cfg(level), side = Math.random() < .5 ? -1 : 1;
    const x = side === -1 ? -25 : W + 25, y = 70 + Math.random() * (H - 140);
    drones.push({ x, y, r: 11, vx: side * c.droneSpeed, vy: (Math.random() - .5) * .4, trail: [], hp: 1 });
}
function spawnBarrier() {
    const bw = 50 + Math.random() * 90;
    barriers.push({ x: Math.random() * (W - bw), y: -18, w: bw, h: 13, vy: 1.3 + Math.random() * .7, sway: Math.random() * .4, swayOffset: Math.random() * Math.PI * 2 });
}
function spawnMissile() {
    const side = Math.random() < .5 ? -1 : 1;
    const x = side === -1 ? -15 : W + 15, y = 60 + Math.random() * (H - 120);
    const spd = 3.2 + Math.random() * 1.2, ang = Math.atan2(PL.y - y, PL.x - x);
    missiles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 6, life: 1 });
}
function spawnPowerup() {
    const types = ['shield', 'multi', 'slow'];
    powerups.push({ x: 40 + Math.random() * (W - 80), y: -20, r: 14, vy: 1.2, pulse: 0, kind: types[Math.floor(Math.random() * 3)] });
}

// ─── GAME FLOW ───────────────────────────────────────────────────────────────
function startGame() {
    state = 'playing';
    score = 0; dispScore = 0; combo = 0; comboTimer = 0;
    lives = 3; level = 1; frame = 0; shakeFrames = 0; levelUpTimer = 0; levelStartTimer = 0; slowTimer = 0;
    deathReason = ''; lastDeathReason = '';
    crystals = []; drones = []; barriers = []; missiles = []; particles = []; powerups = [];
    PL.x = W / 2; PL.y = H - 100; PL.vx = 0; PL.vy = 0; PL.invincible = 0; PL.shield = 0; PL.trail = [];
    cursor.x = W / 2; cursor.y = H - 100;
}
function hitPlayer(reason) {
    if (PL.invincible > 0) return;
    if (PL.shield > 0) { PL.shield = 0; burst(PL.x, PL.y, C.cyan, 12, 4); return; }
    lives--; combo = 0; comboTimer = 0;
    burst(PL.x, PL.y, C.magenta, 20, 4); shakeFrames = 20; PL.invincible = 1;
    deathReason = reason || 'UNKNOWN';
    if (lives <= 0) {
        lastDeathReason = deathReason;
        saveScore();
        state = 'gameover';
        if (score > highScore) { highScore = score; localStorage.setItem('neonSurgeHS', highScore); }
    }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
function update() {
    if (state === 'paused') return;
    if (state === 'levelup') {
        if (--levelUpTimer <= 0) { state = 'playing'; levelStartTimer = 90; }
        updateParticles(); return;
    }
    if (state !== 'playing') return;

    frame++;
    if (shakeFrames > 0) shakeFrames--;
    if (levelStartTimer > 0) levelStartTimer--;
    if (slowTimer > 0) slowTimer--;

    const c = cfg(level);
    const ks = Math.max(4, W / 110);
    if (keys['ArrowLeft'] || keys['KeyA']) cursor.x = Math.max(0, cursor.x - ks);
    if (keys['ArrowRight'] || keys['KeyD']) cursor.x = Math.min(W, cursor.x + ks);
    if (keys['ArrowUp'] || keys['KeyW']) cursor.y = Math.max(0, cursor.y - ks);
    if (keys['ArrowDown'] || keys['KeyS']) cursor.y = Math.min(H, cursor.y + ks);

    const dx = cursor.x - PL.x, dy = cursor.y - PL.y;
    PL.vx += dx * .09; PL.vy += dy * .09; PL.vx *= .72; PL.vy *= .72;
    PL.x += PL.vx; PL.y += PL.vy;
    PL.x = Math.max(PL.r, Math.min(W - PL.r, PL.x)); PL.y = Math.max(PL.r, Math.min(H - PL.r, PL.y));
    PL.trail.push({ x: PL.x, y: PL.y }); if (PL.trail.length > 18) PL.trail.shift();
    if (PL.invincible > 0) PL.invincible--; if (PL.shield > 0) PL.shield--;
    if (comboTimer > 0 && --comboTimer <= 0) combo = 0;

    if (frame % c.crystalRate === 0) spawnCrystal();
    if (frame % c.droneRate === 0) spawnDrone();
    if (c.barrierRate && frame % c.barrierRate === 0) spawnBarrier();
    if (c.missileRate && frame % c.missileRate === 0) spawnMissile();
    if (frame % c.powerupRate === 0) spawnPowerup();

    // Crystals
    crystals = crystals.filter(cr => {
        cr.y += cr.vy; cr.pulse += .1; cr.rotation += .04;
        if (Math.hypot(cr.x - PL.x, cr.y - PL.y) < PL.r + cr.r) {
            combo++; comboTimer = 90; const mul = 1 + Math.floor(combo / 5), pts = 10 * mul; score += pts;
            burst(cr.x, cr.y, `hsl(${cr.hue},100%,65%)`, 7, 2.5); scoreText(cr.x, cr.y - 10, `+${pts}`, C.yellow); return false;
        }
        return cr.y < H + 30;
    });

    // Powerups
    powerups = powerups.filter(pu => {
        pu.y += pu.vy; pu.pulse += .08;
        if (Math.hypot(pu.x - PL.x, pu.y - PL.y) < PL.r + pu.r) {
            if (pu.kind === 'shield') { PL.shield = 300; burst(PL.x, PL.y, C.cyan, 15, 3); scoreText(pu.x, pu.y - 14, 'SHIELD!', C.cyan); }
            if (pu.kind === 'multi') { score += 200; scoreText(pu.x, pu.y - 14, '+200!', C.orange); burst(pu.x, pu.y, C.orange, 14, 3); }
            if (pu.kind === 'slow') {
                slowTimer = SLOW_DURATION;
                // Immediately dampen all drone velocities hard
                drones.forEach(d => { d.vx *= 0.08; d.vy *= 0.08; });
                burst(pu.x, pu.y, C.green, 18, 3); scoreText(pu.x, pu.y - 14, 'SLOW!', C.green);
            }
            return false;
        }
        return pu.y < H + 30;
    });

    // ── Drones — apply slow multiplier when slowTimer active ─────────────────
    const slowMult = slowTimer > 0 ? 0.08 : 1; // 8% speed when slowed
    drones = drones.filter(d => {
        const ddx = PL.x - d.x, ddy = PL.y - d.y, dist = Math.hypot(ddx, ddy) || 1;
        const c2 = cfg(level);
        const accel = slowTimer > 0 ? 0.004 : 0.07; // near-frozen acceleration when slowed
        d.vx += (ddx / dist) * accel * c2.droneSpeed;
        d.vy += (ddy / dist) * accel * c2.droneSpeed;
        const spd = Math.hypot(d.vx, d.vy), mx = c2.droneSpeed * 2.2 * slowMult;
        if (spd > mx) { d.vx *= mx / spd; d.vy *= mx / spd; }
        d.x += d.vx; d.y += d.vy;
        d.trail.push({ x: d.x, y: d.y }); if (d.trail.length > 10) d.trail.shift();
        if (Math.hypot(d.x - PL.x, d.y - PL.y) < PL.r + d.r) { hitPlayer('DRONE COLLISION'); burst(d.x, d.y, C.red, 12, 3); return false; }
        return d.x > -60 && d.x < W + 60 && d.y > -60 && d.y < H + 60;
    });

    // Barriers
    barriers = barriers.filter(b => {
        b.y += b.vy; b.x += Math.sin(frame * b.sway + b.swayOffset) * 1.2;
        b.x = Math.max(0, Math.min(W - b.w, b.x));
        const nx = Math.max(b.x, Math.min(PL.x, b.x + b.w));
        const ny = Math.max(b.y, Math.min(PL.y, b.y + b.h));
        if (Math.hypot(PL.x - nx, PL.y - ny) < PL.r) hitPlayer('BARRIER HIT');
        return b.y < H + 20;
    });

    // Missiles
    missiles = missiles.filter(m => {
        m.x += m.vx; m.y += m.vy;
        if (Math.hypot(m.x - PL.x, m.y - PL.y) < PL.r + m.r) { hitPlayer('MISSILE STRIKE'); burst(m.x, m.y, C.orange, 10, 3); return false; }
        return m.x > -30 && m.x < W + 30 && m.y > -30 && m.y < H + 30;
    });

    updateParticles();
    dispScore = Math.round(dispScore + (score - dispScore) * .18);
    if (score >= cfg(level).scoreGoal) {
        level++; levelUpTimer = 50; state = 'levelup';
        burst(W / 2, H / 2, C.yellow, 30, 5); burst(W / 2, H / 2, C.cyan, 20, 3);
    }
}
function updateParticles() {
    particles = particles.filter(p => {
        p.life -= p.type === 'text' ? .018 : .025; p.y += p.vy || 0;
        if (p.type === 'dot') { p.x += p.vx; p.vy = (p.vy || 0) + .06; }
        return p.life > 0;
    });
}

// ─── DRAW HELPERS ────────────────────────────────────────────────────────────
function glow(col, amt) { ctx.shadowColor = col; ctx.shadowBlur = amt; }
function noGlow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
function circle(x, y, r, col, gc, ga = 0) { ctx.fillStyle = col; if (gc) glow(gc, ga); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); noGlow(); }
function fs(base) { return Math.round(base * Math.min(1.85, Math.max(1, W / 480))); }

// ─── HEART ICON ──────────────────────────────────────────────────────────────
function drawHeart(cx, cy, r, col, glowCol, glowAmt = 0) {
    ctx.save();
    if (glowCol) glow(glowCol, glowAmt);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.32);
    // left lobe
    ctx.bezierCurveTo(cx - r * 0.08, cy + r * 0.12, cx - r, cy + r * 0.14, cx - r, cy - r * 0.22);
    ctx.bezierCurveTo(cx - r, cy - r * 0.82, cx, cy - r * 0.88, cx, cy - r * 0.52);
    // right lobe
    ctx.bezierCurveTo(cx, cy - r * 0.88, cx + r, cy - r * 0.82, cx + r, cy - r * 0.22);
    ctx.bezierCurveTo(cx + r, cy + r * 0.14, cx + r * 0.08, cy + r * 0.12, cx, cy + r * 0.32);
    ctx.closePath(); ctx.fill(); noGlow(); ctx.restore();
}

// ─── SHIELD ICON ─────────────────────────────────────────────────────────────
function drawShieldIcon(cx, cy, hw, col, glowCol) {
    const hh = hw * 1.55;
    ctx.save(); if (glowCol) glow(glowCol, 18); ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - hh + hw * .25); ctx.quadraticCurveTo(cx - hw, cy - hh, cx - hw + hw * .25, cy - hh);
    ctx.lineTo(cx + hw - hw * .25, cy - hh); ctx.quadraticCurveTo(cx + hw, cy - hh, cx + hw, cy - hh + hw * .25);
    ctx.lineTo(cx + hw, cy + hh * .1);
    ctx.bezierCurveTo(cx + hw, cy + hh * .6, cx + hw * .35, cy + hh * .95, cx, cy + hh);
    ctx.bezierCurveTo(cx - hw * .35, cy + hh * .95, cx - hw, cy + hh * .6, cx - hw, cy + hh * .1);
    ctx.closePath(); ctx.fill(); noGlow();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = hw * .12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy - hh + hw * .3); ctx.lineTo(cx, cy + hh * .55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - hw + hw * .15, cy - hh * .1); ctx.lineTo(cx + hw - hw * .15, cy - hh * .1); ctx.stroke();
    ctx.restore();
}

// ─── CLOCK ICON ──────────────────────────────────────────────────────────────
function drawClockIcon(cx, cy, r, col, glowCol) {
    const now = Date.now() / 1000;
    ctx.save(); if (glowCol) glow(glowCol, 18);
    ctx.strokeStyle = col; ctx.lineWidth = r * .16;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); noGlow();
    ctx.fillStyle = col + '22'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col;
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 - Math.PI / 2, inner = i % 3 === 0 ? r * .55 : r * .7;
        ctx.lineWidth = i % 3 === 0 ? r * .12 : r * .07;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * r * .88, cy + Math.sin(a) * r * .88); ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = r * .14; ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(now * .3 - Math.PI / 2) * r * .44, cy + Math.sin(now * .3 - Math.PI / 2) * r * .44); ctx.stroke();
    ctx.lineWidth = r * .09; ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(now * 1.8 - Math.PI / 2) * r * .68, cy + Math.sin(now * 1.8 - Math.PI / 2) * r * .68); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r * .12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// ─── PLUS-CIRCLE ICON ────────────────────────────────────────────────────────
function drawPlusCircleIcon(cx, cy, r, col, glowCol) {
    ctx.save(); if (glowCol) glow(glowCol, 18);
    ctx.strokeStyle = col; ctx.lineWidth = r * .16;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col + '22'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    noGlow(); ctx.strokeStyle = col; ctx.lineWidth = r * .22; ctx.lineCap = 'round';
    const arm = r * .52;
    ctx.beginPath(); ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm); ctx.stroke();
    ctx.restore();
}

// ─── MINI ENEMY ICONS (for legend) ───────────────────────────────────────────
function drawMiniDrone(cx, cy, r) {
    ctx.save(); glow(C.red, r * 1.2);
    ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); noGlow();
    ctx.strokeStyle = '#ff7799'; ctx.lineWidth = r * .13; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffaacc'; ctx.beginPath(); ctx.arc(cx, cy, r * .38, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}
function drawMiniMissile(cx, cy, r) {
    ctx.save(); ctx.translate(cx, cy); glow(C.orange, r * 1.2); ctx.fillStyle = C.orange;
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r, -r * .55); ctx.lineTo(-r * .3, 0); ctx.lineTo(-r, r * .55); ctx.closePath(); ctx.fill();
    noGlow(); ctx.globalAlpha = .4; ctx.fillStyle = C.yellow;
    ctx.beginPath(); ctx.ellipse(-r * .55, 0, r * .38, r * .2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
}
function drawMiniBarrier(cx, cy, bw, bh) {
    ctx.save(); const x = cx - bw / 2, y = cy - bh / 2; glow(C.red, bh);
    ctx.fillStyle = 'rgba(255,34,68,0.90)'; ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 2); ctx.fill(); noGlow();
    ctx.fillStyle = 'rgba(255,230,0,0.6)';
    for (let sx = x - bh; sx < x + bw; sx += bh * 1.4) {
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + bh, y); ctx.lineTo(sx + bh * 1.5, y + bh); ctx.lineTo(sx + bh * .5, y + bh); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
}

// ─── DRAW GAME ───────────────────────────────────────────────────────────────
function drawGame() {
    ctx.save();
    if (shakeFrames > 0) { const s = shakeFrames * .8; ctx.translate((Math.random() - .5) * s, (Math.random() - .5) * s); }
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // Grid
    const gsp = Math.round(W / 15);
    ctx.strokeStyle = 'rgba(0,200,255,0.06)'; ctx.lineWidth = .5;
    for (let x = 0; x < W; x += gsp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gsp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Progress bar
    const prev = level === 1 ? 0 : cfg(level - 1).scoreGoal;
    const goal = cfg(level).scoreGoal;
    const prog = Math.min(1, (score - prev) / (goal - prev || 1));
    ctx.fillStyle = 'rgba(0,255,229,0.10)'; ctx.fillRect(0, 0, W, 8);
    glow(C.cyan, 8); ctx.fillStyle = C.cyan; ctx.fillRect(0, 0, W * prog, 8); noGlow();

    // ── HUD ──────────────────────────────────────────────────────────────────
    const topY = fs(12) + 18;

    // Score (top-left)
    ctx.font = `${fs(12)}px "Press Start 2P",monospace`;
    glow(C.cyan, 10); ctx.fillStyle = C.cyan; ctx.fillText(String(dispScore).padStart(7, '0'), 14, topY); noGlow();

    // Level (top-center)
    ctx.font = `${fs(7)}px "Press Start 2P",monospace`;
    glow(C.yellow, 6); ctx.fillStyle = C.yellow; ctx.textAlign = 'center'; ctx.fillText(`LV ${level}`, W / 2, topY); ctx.textAlign = 'left'; noGlow();

    // ── LIVES as RED HEARTS (top-right) ──────────────────────────────────────
    const heartSpacing = 26, heartR = 9;
    for (let i = 0; i < 3; i++) {
        const hx = W - 14 - heartR - i * heartSpacing, hy = topY - heartR * .2;
        if (i < lives) { drawHeart(hx, hy, heartR, C.red, C.red, 14); }
        else { drawHeart(hx, hy, heartR, 'rgba(255,34,68,0.18)', null, 0); }
    }

    // Combo (below score)
    if (combo >= 3) {
        ctx.font = `${fs(7)}px "Press Start 2P",monospace`;
        glow(C.yellow, 8); ctx.fillStyle = C.yellow; ctx.fillText(`${combo}x COMBO!`, 14, topY + fs(18)); noGlow();
    }

    // Right-side status column
    let rightY = topY + fs(18);
    if (PL.shield > 0) {
        ctx.font = `${fs(7)}px "Press Start 2P",monospace`;
        glow(C.cyan, 8); ctx.fillStyle = C.cyan; ctx.textAlign = 'right'; ctx.fillText('SHIELD ACTIVE', W - 14, rightY); ctx.textAlign = 'left'; noGlow();
        rightY += fs(18);
    }

    // ── SLOW COUNTDOWN ───────────────────────────────────────────────────────
    if (slowTimer > 0) {
        const secs = Math.ceil(slowTimer / 60);
        const pct = slowTimer / SLOW_DURATION;
        const cR = fs(8), cX = W - 14 - cR, cY = rightY + cR;

        // Countdown arc background
        ctx.strokeStyle = 'rgba(0,255,136,0.18)'; ctx.lineWidth = cR * .22;
        ctx.beginPath(); ctx.arc(cX, cY, cR, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        // Countdown arc fill
        glow(C.green, 10); ctx.strokeStyle = C.green; ctx.lineWidth = cR * .22;
        ctx.beginPath(); ctx.arc(cX, cY, cR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke(); noGlow();
        // Clock face
        ctx.fillStyle = 'rgba(0,255,136,0.12)'; ctx.beginPath(); ctx.arc(cX, cY, cR * .76, 0, Math.PI * 2); ctx.fill();
        // Single sweeping hand
        const handAng = Date.now() / 1000 * 1.8 - Math.PI / 2;
        ctx.strokeStyle = C.green; ctx.lineWidth = cR * .1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cX, cY); ctx.lineTo(cX + Math.cos(handAng) * cR * .55, cY + Math.sin(handAng) * cR * .55); ctx.stroke();
        ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(cX, cY, cR * .1, 0, Math.PI * 2); ctx.fill();
        // Seconds label
        ctx.font = `${fs(7)}px "Press Start 2P",monospace`;
        glow(C.green, 8); ctx.fillStyle = C.green; ctx.textAlign = 'right';
        ctx.fillText(`${secs}s`, cX - cR - 4, cY + cR * .35); ctx.textAlign = 'left'; noGlow();
        rightY += cR * 2 + fs(6);
    }

    // PC shortcuts footer
    if (!isMobile()) {
        ctx.font = `${fs(5)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(0,255,229,0.20)';
        ctx.textAlign = 'right'; ctx.fillText('[P] Pause   [R] Resume   [ESC] Restart', W - 14, H - 10); ctx.textAlign = 'left';
    }
    // Drone counter footer
    ctx.font = `${fs(5)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(255,34,68,0.38)';
    ctx.textAlign = 'center'; ctx.fillText(`DRONES: ${drones.length}/${MAX_DRONES}`, W / 2, H - 10); ctx.textAlign = 'left';

    // ── BARRIERS ─────────────────────────────────────────────────────────────
    barriers.forEach(b => {
        ctx.save(); glow(C.red, 10); ctx.fillStyle = 'rgba(255,34,68,0.85)';
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 3); ctx.fill(); noGlow();
        ctx.fillStyle = 'rgba(255,230,0,0.55)';
        for (let sx = b.x - b.h; sx < b.x + b.w; sx += 16) { ctx.beginPath(); ctx.moveTo(sx, b.y); ctx.lineTo(sx + b.h, b.y); ctx.lineTo(sx + b.h * 1.5, b.y + b.h); ctx.lineTo(sx + .5 * b.h, b.y + b.h); ctx.closePath(); ctx.fill(); }
        ctx.restore();
    });

    // ── CRYSTALS ─────────────────────────────────────────────────────────────
    crystals.forEach(cr => {
        const pulse = Math.sin(cr.pulse) * 1.5, col = `hsl(${cr.hue},100%,65%)`;
        ctx.save(); ctx.translate(cr.x, cr.y); ctx.rotate(cr.rotation); glow(col, 14); ctx.fillStyle = col;
        const rr = cr.r + pulse;
        ctx.beginPath(); ctx.moveTo(0, -rr); ctx.lineTo(rr * .6, 0); ctx.lineTo(0, rr); ctx.lineTo(-rr * .6, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; noGlow(); ctx.beginPath(); ctx.arc(-rr * .2, -rr * .25, rr * .18, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    // ── POWERUPS ─────────────────────────────────────────────────────────────
    powerups.forEach(pu => {
        const pulse = Math.sin(pu.pulse) * 1.8, r = pu.r + pulse;
        if (pu.kind === 'shield') drawShieldIcon(pu.x, pu.y, r * .75, C.cyan, C.cyan);
        else if (pu.kind === 'slow') drawClockIcon(pu.x, pu.y, r, C.green, C.green);
        else drawPlusCircleIcon(pu.x, pu.y, r, C.orange, C.orange);
    });

    // ── DRONES (tinted blue when slowed) ─────────────────────────────────────
    const droneBody = slowTimer > 0 ? '#4488ff' : '#ff2244';
    const droneRing = slowTimer > 0 ? '#88bbff' : '#ff7799';
    const droneCore = slowTimer > 0 ? '#aaccff' : '#ffaacc';
    const droneGlow = slowTimer > 0 ? C.cyan : C.red;
    drones.forEach(d => {
        d.trail.forEach((t, i) => { ctx.globalAlpha = (i / d.trail.length) * 0.35; ctx.fillStyle = droneBody; ctx.beginPath(); ctx.arc(t.x, t.y, d.r * (i / d.trail.length) * .7, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalAlpha = 1;
        circle(d.x, d.y, d.r, droneBody, droneGlow, 16);
        ctx.strokeStyle = droneRing; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.stroke();
        circle(d.x, d.y, d.r * .4, droneCore, null, 0);
    });

    // ── MISSILES ─────────────────────────────────────────────────────────────
    missiles.forEach(m => {
        ctx.save(); const ang = Math.atan2(m.vy, m.vx); ctx.translate(m.x, m.y); ctx.rotate(ang); glow(C.orange, 12);
        ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(m.r, 0); ctx.lineTo(-m.r, -m.r * .5); ctx.lineTo(-m.r * .3, 0); ctx.lineTo(-m.r, .5 * m.r); ctx.closePath(); ctx.fill(); noGlow(); ctx.restore();
    });

    // ── PLAYER TRAIL ─────────────────────────────────────────────────────────
    PL.trail.forEach((t, i) => { ctx.globalAlpha = (i / PL.trail.length) * 0.45; ctx.fillStyle = PL.shield > 0 ? C.cyan : '#00ffe5'; ctx.beginPath(); ctx.arc(t.x, t.y, PL.r * (i / PL.trail.length) * .65, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;

    // ── PLAYER ───────────────────────────────────────────────────────────────
    if (PL.invincible === 0 || Math.floor(PL.invincible / 7) % 2 === 0) {
        const pcol = PL.shield > 0 ? C.cyan : '#00ffe5';
        if (PL.shield > 0) {
            const sp = frame * .05;
            for (let i = 0; i < 6; i++) { const a = sp + i / 6 * Math.PI * 2; ctx.save(); glow(C.cyan, 10); ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(PL.x + Math.cos(a) * 22, PL.y + Math.sin(a) * 22, 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        }
        circle(PL.x, PL.y, PL.r, pcol, pcol, 22); circle(PL.x, PL.y, PL.r * .45, '#ffffff', null, 0);
    }

    // ── PARTICLES ────────────────────────────────────────────────────────────
    particles.forEach(p => {
        if (p.type === 'text') { ctx.globalAlpha = p.life; ctx.fillStyle = p.col; ctx.font = `${fs(8)}px "Press Start 2P",monospace`; ctx.textAlign = 'center'; ctx.fillText(p.txt, p.x, p.y); ctx.textAlign = 'left'; }
        else { ctx.globalAlpha = p.life * .9; ctx.fillStyle = p.col; glow(p.col, 8); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); noGlow(); }
    });
    ctx.globalAlpha = 1;

    // ── LEVEL UP overlay ─────────────────────────────────────────────────────
    if (state === 'levelup') {
        const fade = levelUpTimer / 50; ctx.fillStyle = `rgba(0,0,0,${0.55 * fade})`; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = fade; ctx.textAlign = 'center';
        ctx.font = `${fs(22)}px "Press Start 2P",monospace`; glow(C.yellow, 28); ctx.fillStyle = C.yellow; ctx.fillText('LEVEL UP!', W / 2, H / 2 - fs(16));
        ctx.font = `${fs(11)}px "Press Start 2P",monospace`; glow(C.cyan, 14); ctx.fillStyle = C.cyan; ctx.fillText(`LEVEL ${level} STARTING`, W / 2, H / 2 + fs(14));
        noGlow(); ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }

    // ── LEVEL START toast ────────────────────────────────────────────────────
    if (levelStartTimer > 0) {
        const fade = Math.min(1, levelStartTimer / 20); ctx.globalAlpha = fade * 0.92;
        const tw = W * 0.58, th = fs(36), tx = W / 2 - tw / 2, ty = H / 2 - th / 2;
        ctx.fillStyle = 'rgba(0,5,20,0.85)'; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.fill();
        ctx.strokeStyle = C.yellow; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 8); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${fs(10)}px "Press Start 2P",monospace`;
        glow(C.yellow, 12); ctx.fillStyle = C.yellow; ctx.fillText(`— LEVEL ${level} —`, W / 2, H / 2);
        noGlow(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// ─── PAUSE OVERLAY ───────────────────────────────────────────────────────────
function drawPause() {
    ctx.fillStyle = 'rgba(0,0,0,0.74)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
    ctx.font = `${fs(24)}px "Press Start 2P",monospace`; glow(C.cyan, 26); ctx.fillStyle = C.cyan; ctx.fillText('PAUSED', W / 2, H / 2 - fs(44)); noGlow();
    ctx.strokeStyle = 'rgba(0,255,229,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W * .2, H / 2 - fs(26)); ctx.lineTo(W * .8, H / 2 - fs(26)); ctx.stroke();
    [{ key: 'R', label: 'Resume game', col: C.cyan }, { key: 'ESC', label: 'Restart', col: C.magenta }, { key: 'P', label: 'Pause toggle', col: C.yellow }]
        .forEach((r, i) => {
            const y = H / 2 - fs(6) + i * fs(28), bw = fs(36), bh = fs(20), bx = W / 2 - fs(80);
            ctx.fillStyle = 'rgba(0,255,229,0.12)'; ctx.beginPath(); ctx.roundRect(bx, y - fs(14), bw, bh, 4); ctx.fill();
            ctx.strokeStyle = r.col; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(bx, y - fs(14), bw, bh, 4); ctx.stroke();
            glow(r.col, 6); ctx.fillStyle = r.col; ctx.font = `${fs(8)}px "Press Start 2P",monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(r.key, bx + bw / 2, y - fs(14) + bh / 2); noGlow();
            ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(r.label, W / 2 - fs(30), y);
        });
    ctx.font = `${fs(9)}px "Press Start 2P",monospace`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillText('current score', W / 2, H / 2 + fs(104));
    ctx.font = `${fs(18)}px "Press Start 2P",monospace`; glow(C.yellow, 10); ctx.fillStyle = C.yellow; ctx.fillText(String(score).padStart(7, '0'), W / 2, H / 2 + fs(128)); noGlow(); ctx.textAlign = 'left';
}

// ─── MENU ────────────────────────────────────────────────────────────────────
function drawMenu() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const gsp = Math.round(W / 15);
    ctx.strokeStyle = 'rgba(0,200,255,0.07)'; ctx.lineWidth = .5;
    for (let x = 0; x < W; x += gsp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += gsp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const t = Date.now() / 1000;
    [{ x: W * .18, y: H * .22, r: 22, c: C.cyan, spd: 1.2 }, { x: W * .82, y: H * .45, r: 16, c: C.magenta, spd: .9 }, { x: W * .5, y: H * .75, r: 11, c: C.yellow, spd: 1.5 }, { x: W * .1, y: H * .6, r: 8, c: C.green, spd: 1.1 }, { x: W * .9, y: H * .7, r: 9, c: C.orange, spd: 1.3 }]
        .forEach(o => circle(o.x, o.y + Math.sin(t * o.spd) * 10, o.r, o.c, o.c, 18));
    ctx.textAlign = 'center';
    const titleY = H * .22;
    ctx.font = `${fs(26)}px "Press Start 2P",monospace`;
    glow(C.cyan, 22); ctx.fillStyle = C.cyan; ctx.fillText('NEON', W / 2, titleY);
    glow(C.magenta, 22); ctx.fillStyle = C.magenta; ctx.fillText('SURGE', W / 2, titleY + fs(34)); noGlow();
    ctx.font = `${fs(6)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(0,255,229,0.55)'; ctx.fillText('COLLECT · DODGE · SURVIVE', W / 2, titleY + fs(34) + fs(20));
    if (Math.sin(t * 4) > 0) { ctx.font = `${fs(9)}px "Press Start 2P",monospace`; glow(C.white, 10); ctx.fillStyle = C.white; ctx.fillText('TAP  OR  PRESS  ENTER', W / 2, H * .52); noGlow(); }

    // ── LEGEND (two balanced columns, icons + labels) ─────────────────────────
    const lgTop = H * .60;
    const rowH = fs(24);
    const iconR = fs(8);
    const lblOff = iconR + fs(8);
    const lblSz = fs(6);

    // Determine column x positions
    const c1x = W > 640 ? W * .12 : W * 0.10;
    const c2x = W > 640 ? W * .54 : W * 0.10;
    const col2startRow = W > 640 ? 0 : 3; // stacked on narrow screens

    // Section labels
    ctx.font = `${fs(5)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.textAlign = 'left';
    ctx.fillText('POWER-UPS', c1x, lgTop - fs(6));
    ctx.fillText('ENEMIES', c2x, W > 640 ? lgTop - fs(6) : lgTop + rowH * 3 + fs(2));

    // Thin vertical divider on wide screens
    if (W > 640) { ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(W * .5, lgTop - fs(14)); ctx.lineTo(W * .5, lgTop + rowH * 3 + fs(4)); ctx.stroke(); }

    // Left col rows
    const leftRows = [
        { draw: () => drawShieldIcon(c1x + iconR * .6, lgTop + rowH * 0 + iconR * .2, iconR * .7, C.cyan, null), col: C.cyan, lbl: 'Shield  — absorbs 1 hit' },
        { draw: () => drawClockIcon(c1x + iconR, lgTop + rowH * 1 + iconR * .5, iconR, C.green, null), col: C.green, lbl: 'Clock   — slows drones 5s' },
        { draw: () => drawPlusCircleIcon(c1x + iconR, lgTop + rowH * 2 + iconR * .5, iconR, C.orange, null), col: C.orange, lbl: '+200   — bonus points' },
    ];
    leftRows.forEach((row, i) => {
        row.draw();
        ctx.font = `${lblSz}px "Press Start 2P",monospace`; ctx.fillStyle = row.col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(row.lbl, c1x + lblOff + iconR * .2, lgTop + rowH * i + iconR * .7);
    });

    // Right col rows (stacked under on narrow)
    const r2y = (W > 640) ? lgTop : lgTop + rowH * 3 + fs(18);
    const rightRows = [
        { draw: () => drawMiniDrone(c2x + iconR, r2y + rowH * 0 + iconR * .5, iconR), col: C.red, lbl: 'Drone   — homing enemy' },
        { draw: () => drawMiniMissile(c2x + iconR, r2y + rowH * 1 + iconR * .5, iconR), col: C.orange, lbl: 'Missile — fires at you (Lv4)' },
        { draw: () => drawMiniBarrier(c2x + iconR, r2y + rowH * 2 + iconR * .5, iconR * 2.6, iconR * .72), col: C.red, lbl: 'Barrier — blocks path (Lv2)' },
    ];
    rightRows.forEach((row, i) => {
        row.draw();
        ctx.font = `${lblSz}px "Press Start 2P",monospace`; ctx.fillStyle = row.col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(row.lbl, c2x + lblOff + iconR * .2, r2y + rowH * i + iconR * .7);
    });
    ctx.textBaseline = 'alphabetic';

    if (!isMobile()) { ctx.font = `${fs(5)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(0,255,229,0.28)'; ctx.textAlign = 'center'; ctx.fillText('[P] Pause   [R] Resume   [ESC] Restart', W / 2, H * .94); }
    if (highScore > 0) { ctx.font = `${fs(8)}px "Press Start 2P",monospace`; glow(C.yellow, 8); ctx.fillStyle = C.yellow; ctx.textAlign = 'center'; ctx.fillText(`BEST: ${highScore}`, W / 2, H * .98); noGlow(); }
    ctx.textAlign = 'left';
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────
function drawGameOver() {
    ctx.fillStyle = 'rgba(4,4,14,0.90)'; ctx.fillRect(0, 0, W, H);
    const t = Date.now() / 1000; ctx.textAlign = 'center';
    ctx.font = `${fs(18)}px "Press Start 2P",monospace`; glow(C.red, 20); ctx.fillStyle = C.red; ctx.fillText('GAME OVER', W / 2, H * .22); noGlow();

    // Death reason banner
    if (lastDeathReason) {
        ctx.font = `${fs(7)}px "Press Start 2P",monospace`;
        const rw = Math.min(W * .85, 480), rh = fs(24), rx = W / 2 - rw / 2, ry = H * .29;
        ctx.fillStyle = 'rgba(255,34,68,0.15)'; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(255,34,68,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 5); ctx.stroke();
        glow(C.red, 8); ctx.fillStyle = C.red; ctx.textBaseline = 'middle';
        ctx.fillText(`KILLED BY: ${lastDeathReason}`, W / 2, ry + rh / 2); ctx.textBaseline = 'alphabetic'; noGlow();
    }

    ctx.font = `${fs(8)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fillText('SCORE', W / 2, H * .42);
    ctx.font = `${fs(22)}px "Press Start 2P",monospace`; glow(C.cyan, 14); ctx.fillStyle = C.cyan; ctx.fillText(String(score).padStart(7, '0'), W / 2, H * .52); noGlow();
    if (score >= highScore && score > 0) { ctx.font = `${fs(7)}px "Press Start 2P",monospace`; glow(C.yellow, 12); ctx.fillStyle = C.yellow; ctx.fillText('★ NEW HIGH SCORE ★', W / 2, H * .60); noGlow(); }
    else if (highScore > 0) { ctx.font = `${fs(7)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillText(`BEST: ${highScore}`, W / 2, H * .60); }
    ctx.font = `${fs(8)}px "Press Start 2P",monospace`; glow(C.yellow, 8); ctx.fillStyle = C.yellow; ctx.fillText(`LEVEL REACHED: ${level}`, W / 2, H * .68); noGlow();
    if (Math.sin(t * 4) > 0) { ctx.font = `${fs(8)}px "Press Start 2P",monospace`; glow(C.white, 8); ctx.fillStyle = C.white; ctx.fillText('TAP  OR  PRESS  ENTER', W / 2, H * .80); noGlow(); }
    if (!isMobile()) { ctx.font = `${fs(6)}px "Press Start 2P",monospace`; ctx.fillStyle = 'rgba(0,255,229,0.26)'; ctx.fillText('[ESC] also restarts', W / 2, H * .87); }
    ctx.textAlign = 'left';
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
function loop() {
    update();
    if (state === 'menu') drawMenu();
    else if (state === 'gameover') { drawGame(); drawGameOver(); }
    else if (state === 'paused') { drawGame(); drawPause(); }
    else drawGame();
    requestAnimationFrame(loop);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
cursor.x = W / 2; cursor.y = H / 2;
initUser();
loop();