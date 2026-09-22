/**
 * Aerocatch 飛船秘寶 - Interactive Gesture Catching Game
 * Core Application Logic
 */

// Web Audio API Sound Synthesizer Class
class AudioSynth {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (common browser security rule)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, gainStart) {
    if (!this.enabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  }

  playSpawn() {
    // Short high-pass whistle
    this.playTone(600, 'sine', 0.1, 0.03);
  }

  playCatch(combo = 1) {
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      // Frequency goes up with combos
      const baseFreq = 440 * Math.pow(1.059463, (combo - 1) * 2); // semitones
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      // Retro 8-bit double frequency sweep
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.setValueAtTime(baseFreq * 1.5, now + 0.06);
      osc.frequency.setValueAtTime(baseFreq * 2.0, now + 0.12);
      
      osc.start();
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn("Audio catch play error:", e);
    }
  }

  playMiss() {
    // Low buzzer sound
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.25);
      
      osc.start();
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn("Audio miss play error:", e);
    }
  }

  playStart() {
    // Beautiful ascending arpeggio
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C E G C
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.06, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.2);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } catch (e) {
      console.warn("Audio start play error:", e);
    }
  }

  playGameOver() {
    // Descending sad synth chords
    if (!this.enabled) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      const notes = [392.00, 349.23, 311.13, 220.00]; // G F Eb A
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.08, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.4);
        
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.55);
      });
    } catch (e) {
      console.warn("Audio game over play error:", e);
    }
  }
}

// Global Variables & Configuration
const synth = new AudioSynth();
let isPlaying = false;
let score = 0;
let timer = 60;
let gameDuration = 60; // seconds per round: 30 / 60 / 90 (set in settings)
let timerInterval = null;

// Human-readable theme names (used in leaderboard headings & console)
/* ============================================================
   Record store
   ------------------------------------------------------------
   Every finished round goes into one log. The leaderboard and the
   per-theme high score are DERIVED from that log rather than stored
   separately, so deleting a row in the admin panel actually removes
   it everywhere instead of leaving a ghost in the HUD.
   ============================================================ */
const GAME_LOG_KEY = 'cybergrab_game_log';
const ROUND_COUNT_KEY = 'cybergrab_round_count';
const LOG_LIMIT = 500;   // an event day can run a few hundred rounds

const DIFFICULTY_NAMES = { easy: '簡單', medium: '普通', hard: '困難' };

function getGameLog() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(GAME_LOG_KEY) || '[]'); }
  catch { return []; }
  if (!Array.isArray(raw)) return [];
  // Rounds logged before the admin panel existed carry no id, date or theme.
  // Normalise them on read so they can still be listed and deleted.
  return raw.map((e, i) => ({
    id: e.id || `legacy-${i}-${e.round || 0}-${e.score || 0}`,
    round: e.round || 0,
    ymd: e.ymd || '',
    time: e.time || '',
    score: Number(e.score) || 0,
    difficulty: e.difficulty || 'medium'
  }));
}

function writeGameLog(log) {
  localStorage.setItem(GAME_LOG_KEY, JSON.stringify(log.slice(0, LOG_LIMIT)));
}

function saveGameLog(finalScore) {
  const round = parseInt(localStorage.getItem(ROUND_COUNT_KEY) || '0', 10) + 1;
  localStorage.setItem(ROUND_COUNT_KEY, round);
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  const log = getGameLog();
  log.unshift({
    id: `${now.getTime()}-${round}`,
    round,
    ymd: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    time: `${p(now.getHours())}:${p(now.getMinutes())}`,
    score: finalScore,
    difficulty
  });
  writeGameLog(log);
}

function deleteLogEntry(id) { writeGameLog(getGameLog().filter(e => e.id !== id)); }
function deleteLogDay(ymd)  { writeGameLog(getGameLog().filter(e => (e.ymd || '') !== ymd)); }

function clearAllRecords() {
  localStorage.removeItem(GAME_LOG_KEY);
  localStorage.removeItem(ROUND_COUNT_KEY);
  // the pre-derivation stores would otherwise keep haunting the HUD
  Object.keys(localStorage)
    .filter(k => k.startsWith('cybergrab_high_') || k.startsWith('cybergrab_leaderboard_'))
    .forEach(k => localStorage.removeItem(k));
}

// ---- derived views -------------------------------------------------
function getHighScore() {
  return getGameLog().reduce((max, e) => (e.score > max ? e.score : max), 0);
}

function updateHighScoreDisplay() {
  document.getElementById('high-score').textContent = formatScore(getHighScore());
}

function getLeaderboard() {
  return getGameLog()
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(e => ({ score: e.score, date: e.ymd ? `${e.ymd.slice(5)} ${e.time}` : (e.time || '—') }));
}

function renderLeaderboard() {
  const board = getLeaderboard();
  const listEl = document.getElementById('leaderboard-list');
  const rankEmojis = ['🥇', '🥈', '🥉', '4', '5'];

  const subtitleEl = document.querySelector('.leaderboard-subtitle');
  if (subtitleEl) subtitleEl.textContent = 'HALL OF FAME // TOP 5 RECORDS';

  if (board.length === 0) {
    listEl.innerHTML = '<div class="lb-empty">尚無記錄。去挑戰吧！</div>';
    return;
  }

  listEl.innerHTML = board.map((entry, i) => `
    <div class="lb-row">
      <div class="lb-rank">${rankEmojis[i] || (i + 1)}</div>
      <div class="lb-info">
        <div class="lb-date">${entry.date}</div>
        <div class="lb-score">${String(entry.score).padStart(4, '0')} PTS</div>
      </div>
    </div>
  `).join('');
}

function todayYmd() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Quick view inside the settings panel — today's rounds only.
// The full history lives in the admin panel.
function renderGameLog() {
  const listEl = document.getElementById('game-log-list');
  const today = todayYmd();
  const log = getGameLog().filter(e => e.ymd === today);
  if (log.length === 0) {
    listEl.innerHTML = '<div class="log-empty">今天尚無紀錄</div>';
    return;
  }
  listEl.innerHTML = log.map(entry => `
    <div class="log-row">
      <span class="log-time">${entry.time}</span>
      <span class="log-round">第 ${entry.round} 回</span>
      <span class="log-score">${entry.score} 分</span>
    </div>
  `).join('');
}

function openLeaderboard() {
  renderLeaderboard();
  document.getElementById('leaderboard-modal').classList.add('active');
}

function closeLeaderboard() {
  document.getElementById('leaderboard-modal').classList.remove('active');
}

/* ============================================================
   Admin panel — every round grouped by day, deletable row by row
   ============================================================ */
const WEEKDAY_TC = ['日', '一', '二', '三', '四', '五', '六'];

function prettyDay(ymd) {
  if (!ymd) return '未記錄日期';
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${WEEKDAY_TC[new Date(y, m - 1, d).getDay()]}）`;
}

// newest day first; rows inside a day are already newest-first from the log
function groupLogByDay() {
  const groups = new Map();
  for (const e of getGameLog()) {
    const key = e.ymd || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function renderAdmin() {
  const listEl = document.getElementById('admin-list');
  const sumEl = document.getElementById('admin-summary');
  const log = getGameLog();

  if (!log.length) {
    sumEl.textContent = '尚無任何紀錄';
    listEl.innerHTML = '<div class="admin-empty">尚無紀錄</div>';
    return;
  }

  const days = groupLogByDay();
  sumEl.textContent = `${days.length} 天 · 共 ${log.length} 回 · 最高 ${Math.max(...log.map(e => e.score))} 分`;

  listEl.innerHTML = days.map(([ymd, rows]) => `
    <section class="admin-day">
      <header class="admin-day-head">
        <span class="admin-day-date">${prettyDay(ymd)}</span>
        <span class="admin-day-meta">${rows.length} 回 · 最高 ${Math.max(...rows.map(r => r.score))}</span>
        <button class="admin-day-del" data-ymd="${ymd}">刪除當日</button>
      </header>
      ${rows.map(r => `
        <div class="admin-row">
          <span class="admin-time">${r.time || '--:--'}</span>
          <span class="admin-tag">${DIFFICULTY_NAMES[r.difficulty] || r.difficulty}</span>
          <span class="admin-score">${formatScore(r.score)}</span>
          <button class="admin-del" data-id="${r.id}" title="刪除這筆" aria-label="刪除這筆">✕</button>
        </div>
      `).join('')}
    </section>
  `).join('');
}

// after any delete: the panel, the settings quick view and the HUD high score
// all read from the same log, so refresh the three together
function refreshRecordViews() {
  renderAdmin();
  renderGameLog();
  renderLeaderboard();
  updateHighScoreDisplay();
}

function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportStamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// CSV opens straight in Excel / Numbers. The BOM is what stops Excel from
// turning the Chinese headers into mojibake.
function exportRecordsCsv() {
  const log = getGameLog();
  if (!log.length) { updateSystemConsole('沒有紀錄可以匯出。'); return; }
  const head = ['日期', '時間', '回合', '分數', '難度'];
  const rows = log.map(e => [e.ymd || '', e.time || '', e.round, e.score,
                             DIFFICULTY_NAMES[e.difficulty] || e.difficulty]);
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  downloadFile(`aerocatch-${exportStamp()}.csv`, csv, 'text/csv;charset=utf-8');
  updateSystemConsole(`已匯出 ${log.length} 筆紀錄（CSV）。`);
}

// JSON keeps every field including the ids, so a file can be restored verbatim
function exportRecordsJson() {
  const log = getGameLog();
  if (!log.length) { updateSystemConsole('沒有紀錄可以匯出。'); return; }
  const payload = { exportedAt: new Date().toISOString(), rounds: log.length, records: log };
  downloadFile(`aerocatch-${exportStamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  updateSystemConsole(`已匯出 ${log.length} 筆紀錄（JSON）。`);
}

function openAdmin() {
  renderAdmin();
  document.getElementById('admin-modal').classList.add('active');
}

function closeAdmin() {
  document.getElementById('admin-modal').classList.remove('active');
}

// Combo Multiplier System
let combo = 0;
let comboTimer = 0;
const COMBO_DURATION = 1500; // 1.5s to keep combo
let lastCatchTime = 0;

// Game Configs
let difficulty = 'medium'; // easy, medium, hard (default: medium)
let spawnRate = 800; // ms between spawns
let baseGravity = 2.8; // falling speed multiplier (matches 'medium')
// Theme C: fixed GIF asset (the old custom-URL slot, now a preset)
let customGifUrl = "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnlhMDMxeTZnaTZsMDkwYWYxajR5MDd6Nmp2MGptNDJxb3ZtbWh3MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/WNJ06H3d1kH6Gj7G6B/giphy.gif";

// Video & Drawing Canvas variables
let videoElement;
let canvasElement;
let canvasCtx;
let cameraInstance = null;
let handsInstance = null;

// Web Viewport dimensions
let viewportWidth = 640;
let viewportHeight = 480;

// Hand coordinates tracking (mirrored)
let rawHandX = 0;
let rawHandY = 0;
let smoothHandX = 0;
let smoothHandY = 0;
let handPoints = []; // all 21 hand landmark screen positions (the red skeleton)
let isHandPresent = false;
let currentGesture = 'unknown'; // 'unknown', 'open', 'fist'
let lastGesture = 'unknown';
let lastSpawnTime = 0;

// Falling Game Items List
let gameItems = [];
let itemCounter = 0;

// Built-in theme assets (SVGs, emojis, pixel art drawings)
const SVGTemplates = {
  star: `<svg class="neon-svg-yellow" viewBox="0 0 24 24" style="width: 100%; height: 100%;"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`,
  ghost: `<svg class="neon-svg-pink" viewBox="0 0 24 24" style="width: 100%; height: 100%;"><path d="M12,2A9,9,0,0,0,3,11v9a1,1,0,0,0,1.7.7l1.8-1.8,1.8,1.8A1,1,0,0,0,10,20V19H14v1a1,1,0,0,0,1.7.7l1.8-1.8,1.8,1.8a1,1,0,0,0,1.7-.7V11A9,9,0,0,0,12,2ZM9,10a1,1,0,1,1,1-1A1,1,0,0,1,9,10Zm6,0a1,1,0,1,1,1-1A1,1,0,0,1,15,10Z" fill="currentColor"/></svg>`,
  crystal: `<svg class="neon-svg-cyan" viewBox="0 0 24 24" style="width: 100%; height: 100%;"><polygon points="12,2 20,9 12,22 4,9" fill="currentColor" stroke="#fff" stroke-width="1"/></svg>`,
  sphere: `<svg class="neon-svg-green" viewBox="0 0 24 24" style="width: 100%; height: 100%;"><circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="9" cy="9" r="2" fill="#fff"/><circle cx="15" cy="15" r="1" fill="#fff"/></svg>`
};

const EmojiThemeList = ['🐱', '🍓', '🎮', '⭐️', '🎈', '🍩', '🥑', '👾', '🌈', '🍦'];

// Item-dropping ships: a main ship with a smaller escort trailing just behind it.
// Both use webp art and fall back to a built-in saucer SVG if a file is missing.
const ShipSVG = `<svg viewBox="0 0 64 32" style="width:100%;height:100%;">
  <ellipse cx="32" cy="21" rx="30" ry="9" fill="#2E4FD8" stroke="#1A1512" stroke-width="2"/>
  <ellipse cx="32" cy="12" rx="14" ry="9" fill="#F09CCB" stroke="#1A1512" stroke-width="2"/>
  <circle cx="14" cy="21" r="2.5" fill="#FFB020"/>
  <circle cx="32" cy="24" r="2.5" fill="#FFB020"/>
  <circle cx="50" cy="21" r="2.5" fill="#FFB020"/>
</svg>`;

const SHIP_MAIN_HEIGHT = 336;  // main ship box height (grows upward from its belly line)
const SHIP_SUB_HEIGHT = 116;   // escort box height
const DROP_LINE_MIN = 176;     // highest belly line for the main ship
const SUB_OFFSET_X = 0.28;     // escort trails this far behind (right of) the main ship
const SUB_OFFSET_Y = 64;       // ...and sits this many px higher up, i.e. further away
const SUB_FOLLOW_MS = 190;     // escort blinks into formation one beat after the main ship
const MAIN_DROP_SHARE = 0.58;  // how often the next item comes from the main ship

// The fleet: [0] = main ship, [1] = escort.
// Each entry is { el, x (0~1 across the viewport), bottomPx (belly = drop line), height }
const ships = [];
let subFollowTimer = null;

function createShip() {
  ships.length = 0;
  ships.push(buildShip('game-ship', 'public/images/ship-main.webp', SHIP_MAIN_HEIGHT));
  ships.push(buildShip('game-ship-sub', 'public/images/ship-sub.webp', SHIP_SUB_HEIGHT));
  scheduleShipTeleport();
}

function buildShip(id, src, height) {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'game-ship';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.onerror = () => { el.innerHTML = ShipSVG; };
  el.appendChild(img);
  // Lives on the page top layer (fixed) so it can overflow the game frame
  document.body.appendChild(el);
  return { el, x: 0.5, bottomPx: DROP_LINE_MIN, height };
}

// Blink-teleport: the main ship jumps to a random spot and the escort blinks in
// just behind it. Both belly lines (= their drop lines) stay within the top third
// of the screen so players can't camp underneath. The oversized bodies float above
// the game frame, overflowing it freely.
// The main ship's x is capped short of the right edge so the escort always has
// room to sit behind it; between them the pair still covers the full width.
function teleportShip() {
  const main = ships[0];
  const sub = ships[1];
  if (!main || viewportWidth <= 0) return;

  main.x = 0.06 + Math.random() * 0.60;
  const bottomMax = Math.max(DROP_LINE_MIN, viewportHeight / 3);
  main.bottomPx = DROP_LINE_MIN + Math.random() * (bottomMax - DROP_LINE_MIN);
  placeShip(main);

  if (sub) {
    sub.x = main.x + SUB_OFFSET_X;
    sub.bottomPx = main.bottomPx - SUB_OFFSET_Y;
    clearTimeout(subFollowTimer);
    subFollowTimer = setTimeout(() => placeShip(sub), SUB_FOLLOW_MS);
  }
}

// Drop one ship onto its stored spot and flicker it in
function placeShip(ship) {
  // Convert viewport-local coords to page coords (ships are position: fixed)
  const rect = document.getElementById('game-viewport').getBoundingClientRect();
  ship.el.style.left = `${rect.left + ship.x * viewportWidth}px`;
  ship.el.style.top = `${rect.top + ship.bottomPx - ship.height}px`;

  // Flicker effect on arrival
  ship.el.classList.remove('blink');
  void ship.el.offsetWidth;
  ship.el.classList.add('blink');
}

function scheduleShipTeleport() {
  teleportShip();
  setTimeout(scheduleShipTeleport, 700 + Math.random() * 1300);
}

// Pick which ship lets the next item go — the main ship drops a little more often
function pickDroppingShip() {
  const visible = ships.filter(s => s.el.style.display !== 'none');
  if (visible.length < 2) return visible[0] || null;
  return Math.random() < MAIN_DROP_SHARE ? visible[0] : visible[1];
}

// Small recoil kick so you can see which ship let go
function shipDrop(ship) {
  ship.el.classList.remove('drop');
  void ship.el.offsetWidth;
  ship.el.classList.add('drop');
}

// Bonus items: rarer than bombs, worth +30.
// Falling items render at 50-70px, so these sources are 128px. The full-size
// char-*.webp are no longer loaded by anything — they fed the corner mascot,
// which went away with themes A/B/C. drop-koala.webp is spare, unused for now.
const BONUS_VALUE = 30;
const BonusWebpList = [
  'public/images/drop-captain.webp',
  'public/images/drop-sailor.webp',
  'public/images/drop-mouse.webp'
];

// Scoring legend (rendered into a hidden node; kept so the rows can be
// switched back on without rebuilding them)
function renderLegend() {
  const bodyEl = document.getElementById('legend-body');
  const titleEl = document.getElementById('legend-title');
  if (!bodyEl) return;

  const starSvg = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="var(--blue)"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`;
  const bombSvg = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;"><circle cx="11" cy="14" r="8.5" fill="#1A1512" stroke="#D63030" stroke-width="1.5"/><rect x="9.8" y="4.2" width="2.6" height="3.2" rx="0.6" fill="#6B6560"/><circle cx="18" cy="1.9" r="1.4" fill="#FFB020"/></svg>`;

  const bonusRows = BonusWebpList.map(src => `
    <div class="legend-row plus">
      <div class="legend-icon"><img src="${src}" alt=""></div>
      <div class="legend-text"><span class="legend-name">加分寶物</span><span class="legend-val plus">+30</span></div>
    </div>`).join('');

  bodyEl.innerHTML = `
    ${bonusRows}
    <div class="legend-row">
      <div class="legend-icon">${starSvg}</div>
      <div class="legend-text"><span class="legend-name">一般寶物</span><span class="legend-val plus">+10~25</span></div>
    </div>
    <div class="legend-row minus">
      <div class="legend-icon">${bombSvg}</div>
      <div class="legend-text"><span class="legend-name">炸藥</span><span class="legend-val minus">−30</span></div>
    </div>
    <p class="legend-tip">✊ 握拳碰到才算抓取<br>🖐️ 張開手掌召喚落物</p>`;

  if (titleEl) titleEl.textContent = '圖鑑 SCORING';
}

// Spawn mix, shared by every theme. These two are independent shares of each
// spawn; whatever is left over becomes a normal treasure. Keep them separate —
// they used to be written as two overlapping thresholds, where nudging the bomb
// share silently moved the bonus share with it.
const BOMB_CHANCE = 0.15;   // was 0.20
const BONUS_CHANCE = 0.10;  // unchanged

const BOMB_PENALTY = -30;
const BombSVG = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;">
  <circle cx="11" cy="14" r="8.5" fill="#1A1512" stroke="#D63030" stroke-width="1.5"/>
  <rect x="9.8" y="4.2" width="2.6" height="3.2" rx="0.6" fill="#6B6560"/>
  <path d="M12.8 4.6 C14.2 2.4, 16.4 3.6, 17.4 2.2" stroke="#E07020" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <circle cx="18" cy="1.9" r="1.4" fill="#FFB020"/>
  <circle cx="8.2" cy="11.4" r="2" fill="rgba(255,255,255,0.22)"/>
</svg>`;

// Retro pixel art invaders drawn via SVG paths
const PixelThemeList = [
  // Pixel Monster 1 (Octopus Invader)
  `<svg viewBox="0 0 12 8" style="width:100%; height:100%; color: var(--neon-pink);"><path fill="currentColor" d="M3,0h6v1H3V0z M2,1h8v1H2V1z M2,2h8v1H2V2z M0,3h12v1H0V3z M0,4h12v1H0V4z M2,5h2v1H2V5z M8,5h2v1H8V5z M0,6h2v1H0V6z M4,6h4v1H4V6z M10,6h2v1H10V6z M1,7h2v1H1V7z M9,7h2v1H9V7z"/><path fill="#fff" d="M3,3h1v1H3V3z M8,3h1v1H8V3z"/></svg>`,
  // Pixel Monster 2 (Crab Invader)
  `<svg viewBox="0 0 11 8" style="width:100%; height:100%; color: var(--neon-blue);"><path fill="currentColor" d="M2,0h7v1H2V0z M1,1h9v1H1V1z M1,2h9v1H1V2z M0,3h11v1H0V3z M0,4h11v1H0V4z M2,5h7v1H2V5z M0,6h2v1H0V6z M9,6h2v1H9V6z M1,7h2v1H1V7z M8,7h2v1H8V7z"/><path fill="#fff" d="M3,3h1v1H3V3z M7,3h1v1H7V3z"/></svg>`,
  // Pixel Monster 3 (Flyer Invader)
  `<svg viewBox="0 0 12 8" style="width:100%; height:100%; color: var(--neon-green);"><path fill="currentColor" d="M4,0h4v1H4V0z M3,1h6v1H3V1z M2,2h8v1H2V2z M0,3h12v1H0V3z M0,4h12v1H0V4z M3,5h6v1H3V5z M1,6h1v1H1V6z M10,6h1v1H10V6z M0,7h1v1H0V7z M11,7h1v1H11V7z"/><path fill="#fff" d="M4,3h1v1H4V3z M7,3h1v1H7V3z"/></svg>`
];

// Helper: Calculate distance between 3D points
function pointDistance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
}

// Console logging helper (displays on UI footer)
function updateSystemConsole(message) {
  const consoleEl = document.getElementById('system-console-msg');
  if (consoleEl) {
    consoleEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  }
}

// ---- Shared setters (used by the in-game settings AND the operator console) ----
function setDifficulty(value) {
  difficulty = value;
  const sel = document.getElementById('difficulty-select');
  if (sel) sel.value = value;
  adjustDifficultySettings();
}

function setDuration(value) {
  gameDuration = parseInt(value, 10);
  const sel = document.getElementById('duration-select');
  if (sel) sel.value = String(gameDuration);
  if (!isPlaying) {
    document.getElementById('game-timer').textContent = `${gameDuration}s`;
  }
}

// ---- Operator console link (separate window on the laptop, hidden from players) ----
// Same-origin BroadcastChannel — both windows must be the same site in the same browser.
let opChannel = null;

function initOperatorChannel() {
  if (typeof BroadcastChannel === 'undefined') return;
  opChannel = new BroadcastChannel('cybergrab');
  opChannel.onmessage = (ev) => {
    const m = ev.data || {};
    if (m.kind !== 'cmd') return;
    switch (m.cmd) {
      case 'setDifficulty': setDifficulty(m.value);  updateSystemConsole(`（遙控）難度已切換`); break;
      case 'setDuration':   setDuration(m.value);    updateSystemConsole(`（遙控）遊戲時間 ${gameDuration}s`); break;
      case 'start':         if (!isPlaying) startGame(); break;
      case 'restart':       startGame(); break;
      case 'requestStatus': broadcastStatus(); break;
    }
    broadcastStatus();
  };
  setInterval(broadcastStatus, 500);
}

function broadcastStatus() {
  if (!opChannel) return;
  opChannel.postMessage({
    kind: 'status',
    score: score,
    timer: timer,
    playing: isPlaying,
    duration: gameDuration,
    difficulty: difficulty,
    high: getHighScore()
  });
}

// Initialize Application Elements
document.addEventListener('DOMContentLoaded', () => {
  videoElement = document.getElementById('webcam');
  canvasElement = document.getElementById('game-canvas');
  canvasCtx = canvasElement.getContext('2d');

  // Load high score for the current (default) theme
  updateHighScoreDisplay();

  // Setup Event Listeners
  setupEventListeners();

  // Apply default difficulty settings on startup
  adjustDifficultySettings();
  
  // Setup Resize Observer
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      adjustCanvasSize();
    }
  });
  resizeObserver.observe(document.getElementById('game-viewport'));

  // Pre-load cameras
  loadCameraDevices();

  // Initialize MediaPipe Hands
  initMediaPipe();

  // Item-dropping ships
  createShip();
  renderLegend();

  // Link to the operator console (hidden control window on the laptop)
  initOperatorChannel();
});

// Setup DOM Event Listeners
function setupEventListeners() {
  // Start Button
  document.getElementById('btn-start-game').addEventListener('click', () => {
    startGame();
  });

  // Restart Button
  document.getElementById('btn-restart').addEventListener('click', () => {
    // Hide game over screen, reset game
    document.getElementById('game-over-overlay').classList.remove('active');
    startGame();
  });

  // Difficulty change
  const diffSelect = document.getElementById('difficulty-select');
  diffSelect.addEventListener('change', (e) => {
    setDifficulty(e.target.value);
    updateSystemConsole(`難度已調整為：${diffSelect.options[diffSelect.selectedIndex].text}`);
  });

  // Sound toggle
  const soundToggle = document.getElementById('sound-toggle');
  synth.enabled = soundToggle.checked;
  soundToggle.addEventListener('change', (e) => {
    synth.enabled = e.target.checked;
    if (synth.enabled) {
      synth.init();
      synth.playTone(440, 'sine', 0.1, 0.1);
    }
    updateSystemConsole(synth.enabled ? "音效已開啟" : "音效已關閉");
  });

  // Camera change
  const camSelect = document.getElementById('camera-select');
  camSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      // An explicit pick beats the label guess from here on
      try { localStorage.setItem(CAMERA_PREF_KEY, e.target.value); } catch { /* private mode */ }
      updateSystemConsole(`切換相機來源中...`);
      startCameraStream(e.target.value);
    }
  });

  // Manual calibrate / reset — same action from the header and from settings
  const resetTracking = () => {
    updateSystemConsole("重新校準手勢辨識與影像流...");
    synth.playTone(200, 'sine', 0.1, 0.05);

    clearFallingItems();
    combo = 0;
    document.getElementById('combo-multiplier').textContent = 'x1';
    document.getElementById('combo-progress').style.width = '0%';

    const currentCam = camSelect.value;
    if (currentCam) startCameraStream(currentCam);
  };
  document.getElementById('btn-calibrate').addEventListener('click', resetTracking);
  document.getElementById('btn-reset').addEventListener('click', resetTracking);

  // F5 resets the camera instead of reloading the page. A real reload re-fetches
  // the MediaPipe model from the CDN and costs seconds — not something you want
  // to trigger by reflex mid-event. Cmd/Ctrl+R still does a full reload.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      resetTracking();
    }
  });
  // Leaderboard buttons
  document.getElementById('btn-leaderboard').addEventListener('click', openLeaderboard);
  document.getElementById('btn-game-over-leaderboard').addEventListener('click', openLeaderboard);
  document.getElementById('btn-lb-close').addEventListener('click', closeLeaderboard);
  document.getElementById('btn-lb-clear').addEventListener('click', () => {
    // the board is derived from the log, so clearing it means deleting the rounds
    if (confirm('確定要清除所有紀錄嗎？\n排行榜和最高分都會一起歸零。')) {
      clearAllRecords();
      refreshRecordViews();
      updateSystemConsole('所有紀錄已清除。');
    }
  });

  // ---- Admin record panel ----
  document.getElementById('btn-admin').addEventListener('click', openAdmin);
  document.getElementById('btn-admin-close').addEventListener('click', closeAdmin);
  document.getElementById('btn-admin-done').addEventListener('click', closeAdmin);
  document.getElementById('admin-modal').addEventListener('click', (e) => {
    if (e.target.id === 'admin-modal') closeAdmin();
  });

  // one delegated handler covers every row and day button in the list
  document.getElementById('admin-list').addEventListener('click', (e) => {
    const oneBtn = e.target.closest('.admin-del');
    const dayBtn = e.target.closest('.admin-day-del');
    if (oneBtn) {
      deleteLogEntry(oneBtn.dataset.id);
      updateSystemConsole('已刪除 1 筆紀錄。');
    } else if (dayBtn) {
      const ymd = dayBtn.dataset.ymd;
      if (!confirm(`確定要刪除 ${prettyDay(ymd)} 的所有紀錄嗎？`)) return;
      deleteLogDay(ymd);
      updateSystemConsole(`${prettyDay(ymd)} 的紀錄已刪除。`);
    } else {
      return;
    }
    refreshRecordViews();
  });

  document.getElementById('btn-admin-csv').addEventListener('click', exportRecordsCsv);
  document.getElementById('btn-admin-json').addEventListener('click', exportRecordsJson);

  document.getElementById('btn-admin-clear').addEventListener('click', () => {
    if (!confirm('確定要清空「全部」紀錄嗎？\n排行榜與各主題最高分都會歸零，且無法復原。')) return;
    clearAllRecords();
    refreshRecordViews();
    updateSystemConsole('所有紀錄已清空。');
  });

  // Close modal when clicking backdrop
  document.getElementById('leaderboard-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('leaderboard-modal')) {
      closeLeaderboard();
    }
  });

  // Fullscreen toggle — whole page (UI included); Esc exits (browser default)
  const fsBtn = document.getElementById('btn-fullscreen');
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(err => {
        updateSystemConsole(`全螢幕無法啟動：${err.message}`);
      });
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fsBtn.querySelector('.icon-enter-fs').style.display = on ? 'none' : '';
    fsBtn.querySelector('.icon-exit-fs').style.display = on ? '' : 'none';
  });

  // Settings modal (gear icon top-right)
  const settingsModal = document.getElementById('settings-modal');
  document.getElementById('btn-settings').addEventListener('click', () => {
    renderGameLog();
    settingsModal.classList.add('active');
  });
  document.getElementById('btn-settings-close').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('active');
    }
  });
}

// Cap the canvas backing resolution so drawing cost stays flat no matter how
// big the display / fullscreen is. CSS still stretches it to fill the screen
// (same aspect ratio → no crop), so fullscreen just scales one small render up.
const CANVAS_MAX_WIDTH = 900; // "best size" internal render width

// Adjust Canvas Resolution based on viewport sizes
function adjustCanvasSize() {
  const viewport = document.getElementById('game-viewport');
  // Game-logic coordinate space stays in on-screen (display) pixels
  viewportWidth = viewport.clientWidth;
  viewportHeight = viewport.clientHeight;

  // Backing buffer is capped and keeps the display's aspect ratio
  const scale = Math.min(1, CANVAS_MAX_WIDTH / Math.max(1, viewportWidth));
  const w = Math.round(viewportWidth * scale);
  const h = Math.round(viewportHeight * scale);

  // Assigning canvas.width/height reallocates AND wipes the backing buffer even
  // when the value is unchanged, so only touch it on a real size change. This
  // runs once per detected frame, and the ResizeObserver covers actual resizes.
  if (w !== canvasElement.width || h !== canvasElement.height) {
    canvasElement.width = w;
    canvasElement.height = h;
  }
}

// Change gravity and spawn configs based on difficulty
function adjustDifficultySettings() {
  switch (difficulty) {
    // spawn intervals are the previous pass divided by 1.5 -> 1.5x the loot
    case 'easy':
      spawnRate = 640;
      baseGravity = 1.6;
      break;
    case 'medium':
      spawnRate = 427;
      baseGravity = 2.8;
      break;
    case 'hard':
      spawnRate = 267;
      baseGravity = 4.2;
      break;
  }
}

// Format score into 4-digit layout, e.g. 0080
function formatScore(num) {
  return String(num).padStart(4, '0');
}

/* ============================================================
   Camera preference
   ------------------------------------------------------------
   The rig runs on an external webcam pointed at the play area; the Mac's own
   FaceTime camera points at whoever is driving the laptop and is never the one
   you want. enumerateDevices() has no "is this built in?" flag, so the label is
   the only clue — rank on it, and let an explicit pick in the settings panel
   override the guess and survive a reload.
   ============================================================ */
const CAMERA_PREF_KEY = 'cybergrab_camera_id';

const BUILTIN_CAMERA_RE = /facetime|built[\s-]?in|internal|內建|内建|內置/i;
const VIRTUAL_CAMERA_RE = /virtual|obs|snap|camo|iphone|ipad|continuity|desk view|連續互通/i;

// Lower rank wins.
function cameraRank(device) {
  const label = device.label || '';
  if (BUILTIN_CAMERA_RE.test(label)) return 2;  // last resort: the Mac's own camera
  if (VIRTUAL_CAMERA_RE.test(label)) return 1;  // Continuity / OBS: real, but not the rig
  return 0;                                     // a plugged-in USB webcam
}

// A saved choice wins as long as that camera is still plugged in. Safari can
// hand out fresh deviceIds between sessions, so the label ranking is the one
// that has to be right on a cold boot.
function pickPreferredCamera(videoDevices) {
  let saved = null;
  try { saved = localStorage.getItem(CAMERA_PREF_KEY); } catch { /* private mode */ }
  if (saved && videoDevices.some(d => d.deviceId === saved)) return saved;
  return videoDevices.reduce((best, d) => (cameraRank(d) < cameraRank(best) ? d : best)).deviceId;
}

// Load Video Camera list
async function loadCameraDevices() {
  const camSelect = document.getElementById('camera-select');
  try {
    // Permission first, or enumerateDevices() returns every label as '' and the
    // external-camera ranking has nothing to work with. Release the probe right
    // away: left running it pins a second camera open for the whole session
    // (recording light stuck on, device possibly unavailable to the real stream).
    const probe = await navigator.mediaDevices.getUserMedia({ video: true });
    probe.getTracks().forEach(track => track.stop());
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    camSelect.innerHTML = '';
    
    if (videoDevices.length === 0) {
      camSelect.innerHTML = '<option value="">未找到相機鏡頭</option>';
      updateSystemConsole("警告：找不到視訊鏡頭設備。");
      return;
    }

    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `攝影機 ${index + 1}`;
      camSelect.appendChild(option);
    });

    // Default to the external camera, not whatever the OS happens to list first
    const defaultCam = pickPreferredCamera(videoDevices);
    camSelect.value = defaultCam;
    updateSystemConsole(`使用相機：${camSelect.options[camSelect.selectedIndex].text}`);
    startCameraStream(defaultCam);

  } catch (err) {
    console.error("Error accessing camera: ", err);
    camSelect.innerHTML = '<option value="">無權限或鏡頭已被佔用</option>';
    updateSystemConsole("相機權限遭拒或無法存取！");
    document.getElementById('loading-status').innerHTML = "🛑 無法存取攝影機鏡頭";
    document.getElementById('loading-subtext').innerHTML = "請於瀏覽器網址列設定中開啟相機權限並重新整理。";
  }
}

// Capture size. MediaPipe resizes to its own working resolution internally, so
// this only really sets how sharp the background video looks — drop it to
// 480x360 if the show laptop is struggling.
const CAMERA_WIDTH = 640;
const CAMERA_HEIGHT = 480;

// Start camera capture stream
let activeStream = null;
let isProcessingFrame = false;

async function startCameraStream(deviceId) {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
  }

  // `max` as well as `ideal`: with `ideal` alone a 2K/4K camera that has no
  // small capture mode can hand back its native stream, and every frame then
  // costs a full-resolution decode + downscale. The max makes the browser
  // pick the smallest mode it can and scale down inside the capture pipeline.
  const constraints = {
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: CAMERA_WIDTH, max: CAMERA_WIDTH },
      height: { ideal: CAMERA_HEIGHT, max: CAMERA_HEIGHT },
      frameRate: { ideal: DETECT_FPS, max: DETECT_FPS }
    }
  };

  try {
    try {
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // `max` is a MANDATORY constraint: a camera with no capture mode at or
      // below the cap can make getUserMedia reject outright instead of just
      // downscaling. Losing the camera entirely mid-event is far worse than a
      // heavier stream, so fall back to the soft request.
      if (err && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
        updateSystemConsole('相機不支援 640x480，改用預設規格（負擔會略高）。');
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: CAMERA_WIDTH }, height: { ideal: CAMERA_HEIGHT } }
        });
      } else {
        throw err;
      }
    }
    videoElement.srcObject = activeStream;
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      adjustCanvasSize();
      updateSystemConsole(`相機串流載入完成（${cameraSettingsLabel()}），正在等待手勢模組初始化...`);
      
      // Two independent loops: detection (throttled) and rendering (display rate)
      requestAnimationFrame(processVideoFrame);
      startGameLoop();
    };
  } catch (e) {
    console.error("startCameraStream error:", e);
    updateSystemConsole("無法啟動選定的相機設備！");
  }
}

// Hand detection runs on its own budget, capped well below the display rate.
// Left uncapped it will happily eat every millisecond of the main thread and
// starve rendering; 30Hz tracking under a 60Hz render loop feels smoother than
// both fighting over the same frame.
const DETECT_FPS = 30;
const DETECT_INTERVAL_MS = 1000 / DETECT_FPS;
let lastDetectTime = 0;

// What the browser actually handed back, which can differ from what we asked
// for. Worth checking on site when a new camera is plugged in.
function cameraSettingsLabel() {
  const track = activeStream && activeStream.getVideoTracks()[0];
  if (!track || !track.getSettings) return '未知規格';
  const st = track.getSettings();
  const fps = st.frameRate ? `${Math.round(st.frameRate)}fps` : '?fps';
  return `${st.width || '?'}x${st.height || '?'} @ ${fps}`;
}

// A settings / leaderboard / admin panel covers the whole viewport, so nobody
// can be playing while one is open. Hand detection is by far the most expensive
// thing on the page — running it at 30Hz behind a panel is pure waste, and the
// repaints it causes are what made opening the settings panel stall on Safari.
function isOverlayPanelOpen() {
  return !!document.querySelector('#settings-modal.active, #leaderboard-modal.active, #admin-modal.active');
}

// Core processing loops for camera frames to MediaPipe
async function processVideoFrame() {
  if (activeStream && !videoElement.paused && !videoElement.ended) {
    const now = performance.now();
    // Interval is measured start-to-start: if inference itself takes longer than
    // the budget it simply runs back-to-back, guarded by isProcessingFrame.
    if (!isOverlayPanelOpen() && !isProcessingFrame && handsInstance && now - lastDetectTime >= DETECT_INTERVAL_MS) {
      lastDetectTime = now;
      isProcessingFrame = true;
      try {
        await handsInstance.send({ image: videoElement });
      } catch (err) {
        console.error("MediaPipe prediction error: ", err);
      }
      isProcessingFrame = false;
    }
    requestAnimationFrame(processVideoFrame);
  }
}

// Initialize MediaPipe Hands model
function initMediaPipe() {
  handsInstance = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  handsInstance.setOptions({
    maxNumHands: 1,
    // 0 = the "lite" model: roughly half the inference cost of complexity 1.
    // Open-palm vs fist on large targets doesn't need the heavier model.
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    // Lower tracking confidence keeps MediaPipe on the cheap landmark-tracking
    // path instead of falling back to the expensive palm detector as often.
    minTrackingConfidence: 0.5
  });

  handsInstance.onResults(onHandResults);
  
  // Hide loading spinner after first predictions
  updateSystemConsole("手勢辨識模組載入中...");
}

// Callback: Received MediaPipe Hands tracking results
let isFirstPrediction = true;

function onHandResults(results) {
  if (isFirstPrediction) {
    isFirstPrediction = false;
    // Dismiss loading overlay
    document.getElementById('loading-overlay').classList.remove('active');
    document.getElementById('start-overlay').classList.add('active');
    updateSystemConsole("準備完成，隨時可以出航。");
  }

  adjustCanvasSize();

  // The <video> is mirrored by CSS and composited by the browser, so the whole
  // frame no longer gets redrawn into this canvas every detection. The canvas
  // is now a transparent overlay carrying only the skeleton.
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // If hands are tracked, draw skeleton overlay & detect gesture
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    isHandPresent = true;
    const landmarks = results.multiHandLandmarks[0];
    
    // Determine gesture
    classifyGesture(landmarks);

    // Calculate palm center (average of Wrist 0, Index MCP 5, Pinky MCP 17)
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];
    
    const palmX = (wrist.x + indexMCP.x + pinkyMCP.x) / 3;
    const palmY = (wrist.y + indexMCP.y + pinkyMCP.y) / 3;
    
    // Mirror X coordinate since screen is mirrored
    rawHandX = (1 - palmX) * viewportWidth;
    rawHandY = palmY * viewportHeight;

    // Store all landmark screen positions for touch-catch collision
    handPoints = landmarks.map(pt => ({
      x: (1 - pt.x) * viewportWidth,
      y: pt.y * viewportHeight
    }));

    // Draw futuristic cyber skeleton on the mirrored canvas
    drawCyberSkeleton(landmarks);

    // Reticle appearance only — its position is interpolated every rendered
    // frame in updateHandPointer(), so it glides instead of stepping at 30Hz
    const handPointer = getHandPointer();
    handPointer.className = 'pointer-shown';
    
    if (currentGesture === 'fist') {
      handPointer.classList.add('fist-active');
    } else {
      handPointer.classList.remove('fist-active');
    }

  } else {
    isHandPresent = false;
    currentGesture = 'unknown';
    handPoints = [];
    getHandPointer().className = 'pointer-hidden';
    updateGestureHUD();
  }
  // Item spawning and physics deliberately do NOT run here — see gameFrame()
}

/* ============================================================
   Render loop — independent of hand detection
   ============================================================
   Physics used to be driven by onHandResults, so item motion was locked to the
   detector's rate: slow inference meant visibly choppy items, and a faster
   machine literally made the game harder. This loop runs at the display rate
   and scales every movement by elapsed time instead of frame count.          */

// Per-frame speeds in this file were tuned against the old detection rate, so
// they're normalised back to it. Lower this if the game now feels faster than
// it used to on the show laptop; raise it if it feels slower.
const TUNING_FPS = 30;
const HAND_SMOOTHING = 0.35;   // reticle lerp, per reference frame
const MAX_FRAME_DELTA = 0.1;   // 10fps floor; guards against tab-stall jumps

let gameRafId = null;
let lastFrameTime = 0;
let handPointerEl = null;

function getHandPointer() {
  if (!handPointerEl) handPointerEl = document.getElementById('hand-pointer');
  return handPointerEl;
}

function startGameLoop() {
  if (gameRafId !== null) return;
  lastFrameTime = performance.now();
  gameRafId = requestAnimationFrame(gameFrame);
}

function gameFrame(now) {
  gameRafId = requestAnimationFrame(gameFrame);

  // Seconds since the last painted frame. Clamped so a backgrounded tab or a
  // long GC pause can't teleport every item down the screen in one step.
  // The floor is 10fps, not 20 — a struggling laptop can genuinely render below
  // 20fps, and clamping there would quietly slow the whole game back down.
  const dt = Math.min((now - lastFrameTime) / 1000, MAX_FRAME_DELTA);
  lastFrameTime = now;

  updateHandPointer(dt);
  if (!isPlaying) return;

  // Open hand keeps summoning loot; the ships decide where it comes from
  if (isHandPresent && currentGesture === 'open') {
    const t = Date.now();
    if (t - lastSpawnTime > spawnRate) {
      spawnFallingItem();
      lastSpawnTime = t;
    }
  }

  updateGameLogic(dt);
}

// Glide the reticle toward the latest detected palm position
function updateHandPointer(dt) {
  if (!isHandPresent) return;

  if (!smoothHandX && !smoothHandY) {
    smoothHandX = rawHandX;
    smoothHandY = rawHandY;
  } else {
    // Frame-rate independent exponential smoothing — same feel as the old
    // 0.35-per-frame lerp, but expressed as a time constant so it doesn't get
    // snappier just because the display refreshes faster.
    const alpha = 1 - Math.pow(1 - HAND_SMOOTHING, dt * TUNING_FPS);
    smoothHandX += (rawHandX - smoothHandX) * alpha;
    smoothHandY += (rawHandY - smoothHandY) * alpha;
  }

  const pointer = getHandPointer();
  pointer.style.left = `${smoothHandX}px`;
  pointer.style.top = `${smoothHandY}px`;
}

// Classify gesture using finger extended calculations
function classifyGesture(landmarks) {
  const wrist = landmarks[0];
  
  // Finger points
  const tips = [8, 12, 16, 20]; // index, middle, ring, pinky
  const pips = [6, 10, 14, 18];
  
  let extendedFingers = 0;
  
  for (let i = 0; i < 4; i++) {
    const tipWristDist = pointDistance(landmarks[tips[i]], wrist);
    const pipWristDist = pointDistance(landmarks[pips[i]], wrist);
    
    // If fingertip is further away from the wrist than the PIP joint, it is straight
    if (tipWristDist > pipWristDist * 1.05) {
      extendedFingers++;
    }
  }

  // Check Thumb: tip (4) distance to wrist vs IP (3) distance to wrist
  const thumbTipDist = pointDistance(landmarks[4], wrist);
  const thumbIPDist = pointDistance(landmarks[3], wrist);
  const thumbMCPDist = pointDistance(landmarks[2], wrist);
  
  // Thumb is extended if its tip is significantly far from palm
  if (thumbTipDist > thumbIPDist * 1.05 && thumbTipDist > thumbMCPDist * 1.1) {
    extendedFingers++;
  }

  // Evaluate gesture based on open finger counts
  if (extendedFingers >= 4) {
    currentGesture = 'open';
  } else if (extendedFingers <= 1) {
    currentGesture = 'fist';
  } else {
    // Keep last state if it's borderline to reduce flicker, or mark unknown
    currentGesture = 'unknown';
  }

  if (currentGesture !== lastGesture) {
    lastGesture = currentGesture;
    updateGestureHUD();
  }
}

// Update the Gesture badge UI
function updateGestureHUD() {
  const badge = document.getElementById('gesture-badge');
  const emoji = document.getElementById('gesture-emoji');
  const text = document.getElementById('gesture-text');
  const wrapper = document.getElementById('game-screen-wrapper');
  
  badge.className = 'gesture-status-badge';
  // Reset gesture classes on wrapper
  wrapper.classList.remove('gesture-open', 'gesture-fist');
  
  if (!isHandPresent) {
    badge.classList.add('unknown');
    emoji.textContent = '\u2753';
    text.textContent = '\u672a\u5075\u6e2c\u5230\u624b\u90e8';
  } else if (currentGesture === 'open') {
    badge.classList.add('open');
    emoji.textContent = '\ud83d\udd90\ufe0f';
    text.textContent = '\u958b\u638c - \u53ec\u559a\u7269\u9ad4';
    wrapper.classList.add('gesture-open');
  } else if (currentGesture === 'fist') {
    badge.classList.add('fist');
    emoji.textContent = '\u270a';
    text.textContent = '\u63e1\u62f3 - \u6293\u53d6\u6a21\u5f0f';
    wrapper.classList.add('gesture-fist');
  } else {
    badge.classList.add('unknown');
    emoji.textContent = '\ud83d\udc4c';
    text.textContent = '\u534a\u5f35\u958b\u624b\u638c';
  }
}

// Draw skeleton with beautiful neon glowing aesthetics
function drawCyberSkeleton(landmarks) {
  // Hand bones connection indexes
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [0, 9], [9, 10], [10, 11], [11, 12], // middle
    [0, 13], [13, 14], [14, 15], [15, 16], // ring
    [0, 17], [17, 18], [18, 19], [19, 20], // pinky
    [5, 9], [9, 13], [13, 17] // palm base cross links
  ];

  canvasCtx.save();
  
  // Custom neon line style
  canvasCtx.lineWidth = 4;
  canvasCtx.lineCap = 'round';
  canvasCtx.lineJoin = 'round';
  
  // Select color scheme based on gesture
  let glowColor = 'rgba(62, 143, 132, 0.85)'; // sailor teal for neutral
  let strokeStyle = '#3E8F84';

  if (currentGesture === 'fist') {
    glowColor = 'rgba(224, 135, 154, 0.9)';   // rose for fist
    strokeStyle = '#E0879A';
  } else if (currentGesture === 'open') {
    glowColor = 'rgba(143, 179, 92, 0.9)';    // sage for active summoning
    strokeStyle = '#8FB35C';
  }

  canvasCtx.shadowColor = glowColor;
  canvasCtx.shadowBlur = 12;
  canvasCtx.strokeStyle = strokeStyle;

  const cw = canvasElement.width;
  const ch = canvasElement.height;
  const px = (i) => (1 - landmarks[i].x) * cw; // mirrored X
  const py = (i) => landmarks[i].y * ch;

  // Draw ALL bone lines in a single path → shadowBlur runs once, not 23×
  canvasCtx.beginPath();
  connections.forEach(([i1, i2]) => {
    canvasCtx.moveTo(px(i1), py(i1));
    canvasCtx.lineTo(px(i2), py(i2));
  });
  canvasCtx.stroke();

  // Node points — batch by colour so shadowBlur runs twice, not 21×
  canvasCtx.shadowBlur = 8;
  const tips = [4, 8, 12, 16, 20];

  // White knuckle nodes (single fill)
  canvasCtx.fillStyle = '#FFFCF7';
  canvasCtx.beginPath();
  for (let i = 0; i < landmarks.length; i++) {
    if (tips.includes(i)) continue;
    const x = px(i), y = py(i);
    canvasCtx.moveTo(x + 5, y);
    canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
  }
  canvasCtx.fill();

  // Yellow finger tips (single fill)
  canvasCtx.fillStyle = '#C89544';
  canvasCtx.shadowColor = 'rgba(200, 149, 68, 0.8)';
  canvasCtx.beginPath();
  for (const i of tips) {
    const x = px(i), y = py(i);
    canvasCtx.moveTo(x + 5, y);
    canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
  }
  canvasCtx.fill();

  canvasCtx.restore();
}

// Animate the 3-2-1-GO! countdown overlay, then launch game loop
function runCountdown(onComplete) {
  const overlay = document.getElementById('countdown-overlay');
  const display = document.getElementById('countdown-number');
  const steps = ['3', '2', '1', 'GO!'];
  let idx = 0;

  overlay.classList.add('active');

  function showStep() {
    if (idx >= steps.length) {
      overlay.classList.remove('active');
      display.className = 'countdown-display'; // reset classes
      onComplete();
      return;
    }

    const val = steps[idx];
    display.textContent = val;
    display.className = val === 'GO!' ? 'countdown-display go' : 'countdown-display';
    // Force re-trigger CSS animation by toggling
    display.style.animation = 'none';
    void display.offsetWidth;
    display.style.animation = '';

    idx++;
    setTimeout(showStep, 750);
  }

  showStep();
}

// Start Game Play
function startGame() {
  // Reset score/ui immediately
  score = 0;
  timer = gameDuration;
  combo = 0;
  document.getElementById('current-score').textContent = formatScore(score);
  document.getElementById('combo-multiplier').textContent = 'x1';
  document.getElementById('combo-progress').style.width = '0%';
  document.getElementById('game-timer').textContent = `${timer}s`;
  document.getElementById('timer-progress').style.width = '100%';
  document.getElementById('timer-progress').style.backgroundColor = '';
  document.getElementById('game-screen-wrapper').classList.remove('timer-critical');

  clearFallingItems();

  // Hide Start/Over overlays
  document.getElementById('start-overlay').classList.remove('active');
  document.getElementById('game-over-overlay').classList.remove('active');

  updateSystemConsole('倒數計時中...');

  // Show countdown then begin
  runCountdown(() => {
    isPlaying = true;

    // Audio chime
    synth.playStart();
    updateSystemConsole('出航！張開手掌召喚秘寶，握緊拳頭抓住它！');

    // Timer loop
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer--;
      document.getElementById('game-timer').textContent = `${timer}s`;

      const progressWidth = (timer / gameDuration) * 100;
      const timerBar = document.getElementById('timer-progress');
      timerBar.style.width = `${progressWidth}%`;

      if (timer <= 10) {
        timerBar.style.backgroundColor = 'var(--neon-red)';
        document.getElementById('game-screen-wrapper').classList.add('timer-critical');
      } else {
        timerBar.style.backgroundColor = '';
        document.getElementById('game-screen-wrapper').classList.remove('timer-critical');
      }

      if (timer <= 0) {
        endGame();
      }
    }, 1000);
  });
}

// End Game Play
function endGame() {
  isPlaying = false;
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('game-screen-wrapper').classList.remove('timer-critical');
  
  synth.playGameOver();
  updateSystemConsole(`時間到！遊戲結束。你的得分是 ${score} 分。`);
  
  // Show score
  document.getElementById('final-score-value').textContent = score;
  
  // Read the old best BEFORE logging this round — the high score and the
  // leaderboard are both derived from the log now, so the round has to be
  // written first and everything else recomputed from it.
  const prevHigh = getHighScore();
  saveGameLog(score);
  updateHighScoreDisplay();

  const recordTag = document.getElementById('new-high-score-msg');
  if (score > 0 && score > prevHigh) recordTag.classList.remove('hidden');
  else recordTag.classList.add('hidden');

  // Clear items remaining
  clearFallingItems();

  // Show Game Over Overlay
  document.getElementById('game-over-overlay').classList.add('active');
}

// Clear all elements and items
function clearFallingItems() {
  gameItems.forEach(item => {
    if (item.element) item.element.remove();
  });
  gameItems = [];
}

// Spawn falling element in viewport overlay
function spawnFallingItem() {
  itemCounter++;
  const container = document.getElementById('falling-items-container');
  const itemEl = document.createElement('div');
  itemEl.className = 'falling-item';
  
  // Dimensions
  const size = 50 + Math.random() * 20; // 50 to 70px
  itemEl.style.width = `${size}px`;
  itemEl.style.height = `${size}px`;
  
  // Loot drops from whichever ship is chosen; if the fleet somehow isn't up yet
  // it rains from the top at a random x instead.
  let x, y;
  const dropper = pickDroppingShip();
  if (dropper) {
    x = dropper.x * viewportWidth;
    y = dropper.bottomPx + size / 2;
    shipDrop(dropper);
  } else {
    x = (0.1 + Math.random() * 0.8) * viewportWidth;
    y = -size / 2;
  }

  itemEl.style.left = `${x}px`;
  itemEl.style.top = `${y}px`;

  // Item attributes
  let value = 10;
  let elementContent = "";
  let isBonus = false;

  // Spawn roll — bomb, then bonus, otherwise a normal treasure
  const roll = Math.random();
  const isBomb = roll < BOMB_CHANCE;
  isBonus = !isBomb && roll < BOMB_CHANCE + BONUS_CHANCE;
  if (isBomb) {
    elementContent = BombSVG;
    value = BOMB_PENALTY;
    itemEl.classList.add('bomb');
  } else if (isBonus) {
    const bonusSrc = BonusWebpList[Math.floor(Math.random() * BonusWebpList.length)];
    elementContent = `<img src="${bonusSrc}" alt="">`;
    value = BONUS_VALUE;
    itemEl.classList.add('bonus');
  } else {
    // Normal treasure — neon SVG set (shared across all themes)
    const keys = Object.keys(SVGTemplates);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    elementContent = SVGTemplates[randomKey];
    if (randomKey === 'star') value = 15;
    if (randomKey === 'ghost') value = 25;
  }

  itemEl.innerHTML = elementContent;

  // Bonus webp not in the folder yet → fall back to the star SVG
  if (isBonus) {
    const bonusImg = itemEl.querySelector('img');
    if (bonusImg) bonusImg.onerror = () => { itemEl.innerHTML = SVGTemplates.star; };
  }

  // Add CSS swaying animation randomly to simulate dynamic floating
  if (Math.random() > 0.5) {
    itemEl.style.animation = `sway ${2 + Math.random() * 2}s ease-in-out infinite`;
  }

  container.appendChild(itemEl);
  synth.playSpawn();

  gameItems.push({
    id: itemCounter,
    x: x,
    y: y,
    size: size,
    speed: (1.5 + Math.random() * 2) * baseGravity,
    value: value,
    isBomb: isBomb,
    element: itemEl,
    swaySpeed: 0.02 + Math.random() * 0.03,
    swayAmount: 1 + Math.random() * 2,
    swayOffset: Math.random() * Math.PI * 2
  });
}

// Update physics, positions and evaluate grab captures.
// dt is seconds since the last rendered frame; `step` is that expressed in
// reference frames, so the per-frame constants below keep their original values.
function updateGameLogic(dt) {
  const now = Date.now();
  const step = dt * TUNING_FPS;
  
  // Decay combo multiplier if time expired
  if (combo > 0) {
    const elapsed = now - lastCatchTime;
    const comboBarProgress = Math.max(0, 100 - (elapsed / COMBO_DURATION) * 100);
    document.getElementById('combo-progress').style.width = `${comboBarProgress}%`;
    
    if (elapsed > COMBO_DURATION) {
      combo = 0;
      document.getElementById('combo-multiplier').textContent = `x1`;
      document.getElementById('combo-multiplier').className = 'stat-value neon-pink';
    }
  }

  // Iterate backwards to allow element splicing
  for (let i = gameItems.length - 1; i >= 0; i--) {
    const item = gameItems[i];
    
    // Apply gravity
    item.y += item.speed * step;
    
    // Apply horizontal sinusoidal sway
    item.swayOffset += item.swaySpeed * step;
    const dx = Math.sin(item.swayOffset) * item.swayAmount;
    item.x += dx * step;
    
    // Bind x bounds
    if (item.x < item.size/2) item.x = item.size/2;
    if (item.x > viewportWidth - item.size/2) item.x = viewportWidth - item.size/2;

    // Update DOM Position
    item.element.style.left = `${item.x}px`;
    item.element.style.top = `${item.y}px`;

    // Check collision grab condition:
    // fist required — any point of the hand skeleton touching the item while
    // making a fist scores; an open hand only summons, touching does nothing
    let grabbed = false;

    if (isHandPresent && currentGesture === 'fist' && handPoints.length > 0) {
      const touchPad = 10; // small forgiveness margin around the item
      const triggerDistance = (item.size / 2) + touchPad;
      for (const pt of handPoints) {
        if (Math.hypot(pt.x - item.x, pt.y - item.y) < triggerDistance) {
          grabbed = true;
          break;
        }
      }
    }

    if (grabbed) {
      // Grab catch successful!
      handleItemGrab(item);
      gameItems.splice(i, 1);
    } else if (item.y > viewportHeight + item.size) {
      // Fell off screen
      item.element.remove();
      gameItems.splice(i, 1);
      
      // Reset combo if item falls past screen (adds stakes)
      if (combo > 0) {
        combo = 0;
        document.getElementById('combo-multiplier').textContent = `x1`;
        document.getElementById('combo-progress').style.width = '0%';
        synth.playMiss();
      }
    }
  }
}

// Catch Event handling: award score, explode particles, sound alerts
function handleItemGrab(item) {
  // Bomb caught: deduct points, reset combo (score never drops below 0)
  if (item.isBomb) {
    combo = 0;
    document.getElementById('combo-multiplier').textContent = 'x1';
    document.getElementById('combo-multiplier').className = 'stat-value neon-pink';
    document.getElementById('combo-progress').style.width = '0%';

    score = Math.max(0, score + item.value); // value is negative
    document.getElementById('current-score').textContent = formatScore(score);

    synth.playMiss();
    createFloatingText(item.x, item.y, `${item.value}`, false, true);
    triggerScreenFlash('red');

    item.element.classList.add('catching-effect');
    createParticleExplosion(item.x, item.y);
    setTimeout(() => {
      item.element.remove();
    }, 300);
    return;
  }

  // Update combos
  combo++;
  lastCatchTime = Date.now();
  
  // Pitch adjustments based on combo size
  document.getElementById('combo-multiplier').textContent = `x${combo}`;
  if (combo > 5) {
    document.getElementById('combo-multiplier').className = 'stat-value neon-pink neon-green';
  } else {
    document.getElementById('combo-multiplier').className = 'stat-value neon-pink';
  }

  // Calculate scores
  const scoreAdded = item.value * combo;
  score += scoreAdded;
  document.getElementById('current-score').textContent = formatScore(score);

  // Play audio
  synth.playCatch(combo);

  // Floating text popup
  createFloatingText(item.x, item.y, `+${scoreAdded}`, combo > 2);
  
  // Show COMBO! banner text when combo >= 3
  if (combo >= 3) {
    createComboBanner(item.x, item.y, combo);
  }

  // Spawn visual catch explosion rings
  item.element.classList.add('catching-effect');
  
  // Particle explosion
  createParticleExplosion(item.x, item.y);

  // Screen flash effect
  triggerScreenFlash(combo >= 3 ? 'pink' : 'cyan');

  // Cleanup element after pop animation
  setTimeout(() => {
    item.element.remove();
  }, 300);
}

// UI Element: Create Floating Drift-Up Text
function createFloatingText(x, y, text, isCombo, isPenalty = false) {
  const container = document.getElementById('falling-items-container');
  const txtEl = document.createElement('div');
  txtEl.className = 'floating-text' + (isCombo ? ' combo' : '') + (isPenalty ? ' penalty' : '');
  txtEl.style.left = `${x}px`;
  txtEl.style.top = `${y}px`;
  txtEl.textContent = text;
  
  container.appendChild(txtEl);
  
  // Clean up
  setTimeout(() => {
    txtEl.remove();
  }, 800);
}

// UI Element: COMBO! banner that appears above score text
function createComboBanner(x, y, comboCount) {
  const container = document.getElementById('falling-items-container');
  const bannerEl = document.createElement('div');
  bannerEl.className = 'floating-text combo-banner';
  bannerEl.style.left = `${x}px`;
  bannerEl.style.top = `${y - 40}px`; // appear above the score popup
  bannerEl.textContent = `COMBO ×${comboCount}!`;
  
  container.appendChild(bannerEl);
  
  setTimeout(() => {
    bannerEl.remove();
  }, 1000);
}

// UI Element: Generate particle spark elements on capture
function createParticleExplosion(x, y) {
  const container = document.getElementById('falling-items-container');
  const numParticles = 12;
  const colors = ['#3E8F84', '#E0879A', '#8FB35C', '#C89544'];
  
  for (let i = 0; i < numParticles; i++) {
    const particle = document.createElement('div');
    particle.className = 'game-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    
    // Choose random colors
    const color = colors[Math.floor(Math.random() * colors.length)];
    particle.style.backgroundColor = color;
    particle.style.boxShadow = `0 0 6px ${color}`;

    // Random trajectories
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 60;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    
    container.appendChild(particle);
    
    // Clean up particles
    setTimeout(() => {
      particle.remove();
    }, 600);
  }
}

// Briefly flash the game screen on item catch for satisfying feedback
function triggerScreenFlash(colorType = 'cyan') {
  const flashEl = document.getElementById('screen-flash');
  if (!flashEl) return;
  // Remove existing animation class to restart it
  flashEl.classList.remove('flash-cyan', 'flash-pink', 'flash-red');
  // Force reflow so animation restarts cleanly
  void flashEl.offsetWidth;
  const cls = colorType === 'pink' ? 'flash-pink' : (colorType === 'red' ? 'flash-red' : 'flash-cyan');
  flashEl.classList.add(cls);
}
