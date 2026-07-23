/**
 * CyberGrab - Interactive Gesture Catching Game
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
let highScore = parseInt(localStorage.getItem('cybergrab_high_score') || '0', 10);
let timer = 60;
let timerInterval = null;

// Leaderboard (Top 5 stored in localStorage)
const LEADERBOARD_KEY = 'cybergrab_leaderboard';

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToLeaderboard(finalScore) {
  const board = getLeaderboard();
  const entry = {
    score: finalScore,
    date: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  };
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const top5 = board.slice(0, 5);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top5));
  return top5;
}

function renderLeaderboard() {
  const board = getLeaderboard();
  const listEl = document.getElementById('leaderboard-list');
  const rankEmojis = ['🥇', '🥈', '🥉', '4', '5'];
  
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

function openLeaderboard() {
  renderLeaderboard();
  document.getElementById('leaderboard-modal').classList.add('active');
}

function closeLeaderboard() {
  document.getElementById('leaderboard-modal').classList.remove('active');
}

// Combo Multiplier System
let combo = 0;
let comboTimer = 0;
const COMBO_DURATION = 1500; // 1.5s to keep combo
let lastCatchTime = 0;

// Game Configs
let difficulty = 'medium'; // easy, medium, hard
let spawnRate = 800; // ms between spawns
let baseGravity = 2.5; // falling speed multiplier
let activeTheme = 'animated_svg'; // animated_svg, cute_emoji, pixel_art, custom
let customGifUrl = "";

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

// Initialize Application Elements
document.addEventListener('DOMContentLoaded', () => {
  videoElement = document.getElementById('webcam');
  canvasElement = document.getElementById('game-canvas');
  canvasCtx = canvasElement.getContext('2d');

  // Load high scores
  document.getElementById('high-score').textContent = formatScore(highScore);

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

  // Theme change
  const themeSelect = document.getElementById('theme-select');
  const customGroup = document.getElementById('custom-gif-group');
  themeSelect.addEventListener('change', (e) => {
    activeTheme = e.target.value;
    if (activeTheme === 'custom') {
      customGroup.classList.remove('hidden-anim');
      customGroup.classList.add('show-anim');
    } else {
      customGroup.classList.remove('show-anim');
      customGroup.classList.add('hidden-anim');
    }
    updateSystemConsole(`主題切換為：${themeSelect.options[themeSelect.selectedIndex].text}`);
  });

  // Custom GIF URL input
  const gifUrlInput = document.getElementById('custom-gif-url');
  customGifUrl = gifUrlInput.value;
  gifUrlInput.addEventListener('input', (e) => {
    customGifUrl = e.target.value;
  });

  // Difficulty change
  const diffSelect = document.getElementById('difficulty-select');
  diffSelect.addEventListener('change', (e) => {
    difficulty = e.target.value;
    adjustDifficultySettings();
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
      updateSystemConsole(`切換相機來源中...`);
      startCameraStream(e.target.value);
    }
  });

  // Manual calibrate / reset
  document.getElementById('btn-calibrate').addEventListener('click', () => {
    updateSystemConsole("重新校準手勢辨識與影像流...");
    synth.playTone(200, 'sine', 0.1, 0.05);
    
    // Clear elements
    clearFallingItems();
    combo = 0;
    document.getElementById('combo-multiplier').textContent = 'x1';
    document.getElementById('combo-progress').style.width = '0%';
    
    // Restart active camera
    const currentCam = camSelect.value;
    if (currentCam) {
      startCameraStream(currentCam);
    }
  });
  // Leaderboard buttons
  document.getElementById('btn-leaderboard').addEventListener('click', openLeaderboard);
  document.getElementById('btn-game-over-leaderboard').addEventListener('click', openLeaderboard);
  document.getElementById('btn-lb-close').addEventListener('click', closeLeaderboard);
  document.getElementById('btn-lb-clear').addEventListener('click', () => {
    if (confirm('確定要清除所有排行榜記錄嗎？')) {
      localStorage.removeItem(LEADERBOARD_KEY);
      renderLeaderboard();
      updateSystemConsole('排行榜記錄已清除。');
    }
  });

  // Close modal when clicking backdrop
  document.getElementById('leaderboard-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('leaderboard-modal')) {
      closeLeaderboard();
    }
  });
}

// Adjust Canvas Resolution based on viewport sizes
function adjustCanvasSize() {
  const viewport = document.getElementById('game-viewport');
  viewportWidth = viewport.clientWidth;
  viewportHeight = viewport.clientHeight;
  
  canvasElement.width = viewportWidth;
  canvasElement.height = viewportHeight;
}

// Change gravity and spawn configs based on difficulty
function adjustDifficultySettings() {
  switch (difficulty) {
    case 'easy':
      spawnRate = 1200;
      baseGravity = 1.6;
      break;
    case 'medium':
      spawnRate = 800;
      baseGravity = 2.8;
      break;
    case 'hard':
      spawnRate = 500;
      baseGravity = 4.2;
      break;
  }
}

// Format score into 4-digit layout, e.g. 0080
function formatScore(num) {
  return String(num).padStart(4, '0');
}

// Load Video Camera list
async function loadCameraDevices() {
  const camSelect = document.getElementById('camera-select');
  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ video: true });
    
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

    // Select the first device and open stream
    const defaultCam = videoDevices[0].deviceId;
    camSelect.value = defaultCam;
    startCameraStream(defaultCam);

  } catch (err) {
    console.error("Error accessing camera: ", err);
    camSelect.innerHTML = '<option value="">無權限或鏡頭已被佔用</option>';
    updateSystemConsole("相機權限遭拒或無法存取！");
    document.getElementById('loading-status').innerHTML = "🛑 無法存取攝影機鏡頭";
    document.getElementById('loading-subtext').innerHTML = "請於瀏覽器網址列設定中開啟相機權限並重新整理。";
  }
}

// Start camera capture stream
let activeStream = null;
let isProcessingFrame = false;

async function startCameraStream(deviceId) {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  };

  try {
    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = activeStream;
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      adjustCanvasSize();
      updateSystemConsole("相機串流載入完成，正在等待手勢模組初始化...");
      
      // Start frame loop processing
      requestAnimationFrame(processVideoFrame);
    };
  } catch (e) {
    console.error("startCameraStream error:", e);
    updateSystemConsole("無法啟動選定的相機設備！");
  }
}

// Core processing loops for camera frames to MediaPipe
async function processVideoFrame() {
  if (activeStream && !videoElement.paused && !videoElement.ended) {
    if (!isProcessingFrame && handsInstance) {
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
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
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
    updateSystemConsole("系統初始化完畢，隨時可啟動系統。");
  }

  adjustCanvasSize();
  
  // Clear canvas
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw Camera image MIRRORED on canvas
  canvasCtx.save();
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.restore();

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

    if (!smoothHandX && !smoothHandY) {
      smoothHandX = rawHandX;
      smoothHandY = rawHandY;
    } else {
      // Smooth tracking coordinates
      smoothHandX += (rawHandX - smoothHandX) * 0.35;
      smoothHandY += (rawHandY - smoothHandY) * 0.35;
    }

    // Draw futuristic cyber skeleton on the mirrored canvas
    drawCyberSkeleton(landmarks);

    // Position pointer reticle overlay
    const handPointer = document.getElementById('hand-pointer');
    handPointer.style.left = `${smoothHandX}px`;
    handPointer.style.top = `${smoothHandY}px`;
    handPointer.className = 'pointer-shown';
    
    if (currentGesture === 'fist') {
      handPointer.classList.add('fist-active');
    } else {
      handPointer.classList.remove('fist-active');
    }

  } else {
    isHandPresent = false;
    currentGesture = 'unknown';
    document.getElementById('hand-pointer').className = 'pointer-hidden';
    updateGestureHUD();
  }

  // If playing, spawn items when open hand, update items positions and collisions
  if (isPlaying) {
    if (isHandPresent && currentGesture === 'open') {
      const now = Date.now();
      if (now - lastSpawnTime > spawnRate) {
        spawnFallingItem();
        lastSpawnTime = now;
      }
    }
    
    updateGameLogic();
  }
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
  let glowColor = 'rgba(0, 240, 255, 0.9)'; // blue for open/neutral
  let strokeStyle = '#00f0ff';
  
  if (currentGesture === 'fist') {
    glowColor = 'rgba(255, 0, 127, 0.95)'; // pink for fist
    strokeStyle = '#ff007f';
  } else if (currentGesture === 'open') {
    glowColor = 'rgba(57, 255, 20, 0.95)'; // green for active summoning
    strokeStyle = '#39ff14';
  }

  canvasCtx.shadowColor = glowColor;
  canvasCtx.shadowBlur = 12;
  canvasCtx.strokeStyle = strokeStyle;

  // Draw bone lines
  connections.forEach(([i1, i2]) => {
    const pt1 = landmarks[i1];
    const pt2 = landmarks[i2];
    
    // Map non-mirrored landmarks to canvas mirrored coords
    const x1 = (1 - pt1.x) * canvasElement.width;
    const y1 = pt1.y * canvasElement.height;
    const x2 = (1 - pt2.x) * canvasElement.width;
    const y2 = pt2.y * canvasElement.height;
    
    canvasCtx.beginPath();
    canvasCtx.moveTo(x1, y1);
    canvasCtx.lineTo(x2, y2);
    canvasCtx.stroke();
  });

  // Draw node points
  canvasCtx.shadowBlur = 8;
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    const x = (1 - pt.x) * canvasElement.width;
    const y = pt.y * canvasElement.height;
    
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
    
    // Color tips uniquely
    if ([4, 8, 12, 16, 20].includes(i)) {
      canvasCtx.fillStyle = '#fffb00'; // yellow tips
      canvasCtx.shadowColor = 'rgba(255, 251, 0, 0.8)';
    } else {
      canvasCtx.fillStyle = '#ffffff';
    }
    canvasCtx.fill();
  }

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
  timer = 60;
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
    updateSystemConsole('遊戲開始！張開手掌以召喚物品，握緊拳頭去抓取它！');

    // Timer loop
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer--;
      document.getElementById('game-timer').textContent = `${timer}s`;

      const progressWidth = (timer / 60) * 100;
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
  
  // Check High Score
  const recordTag = document.getElementById('new-high-score-msg');
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('cybergrab_high_score', highScore);
    document.getElementById('high-score').textContent = formatScore(highScore);
    recordTag.classList.remove('hidden');
  } else {
    recordTag.classList.add('hidden');
  }

  // Save to leaderboard
  if (score > 0) {
    saveToLeaderboard(score);
  }

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
  
  // Position
  const xPercent = 10 + Math.random() * 80; // 10% to 90%
  const x = (xPercent / 100) * viewportWidth;
  const y = -size / 2;
  
  itemEl.style.left = `${x}px`;
  itemEl.style.top = `${y}px`;

  // Item attributes
  let value = 10;
  let elementContent = "";

  // Dynamic Theme content injection
  if (activeTheme === 'animated_svg') {
    const keys = Object.keys(SVGTemplates);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    elementContent = SVGTemplates[randomKey];
    // Give different SVGs different values
    if (randomKey === 'star') value = 15;
    if (randomKey === 'ghost') value = 25;
  } else if (activeTheme === 'cute_emoji') {
    const randomEmoji = EmojiThemeList[Math.floor(Math.random() * EmojiThemeList.length)];
    // Style as colored emoji text
    elementContent = `<span style="font-size: ${size * 0.75}px; user-select: none;">${randomEmoji}</span>`;
  } else if (activeTheme === 'pixel_art') {
    const randomPixel = PixelThemeList[Math.floor(Math.random() * PixelThemeList.length)];
    elementContent = randomPixel;
    value = 20;
  } else if (activeTheme === 'custom') {
    elementContent = `<img src="${customGifUrl}" alt="falling item" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2220%22 font-size=%2220%22>🌐</text></svg>';">`;
    value = 10;
  }

  itemEl.innerHTML = elementContent;
  
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
    element: itemEl,
    swaySpeed: 0.02 + Math.random() * 0.03,
    swayAmount: 1 + Math.random() * 2,
    swayOffset: Math.random() * Math.PI * 2
  });
}

// Update physics, positions and evaluate grab captures
function updateGameLogic() {
  const now = Date.now();
  
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
    item.y += item.speed;
    
    // Apply horizontal sinusoidal sway
    item.swayOffset += item.swaySpeed;
    const dx = Math.sin(item.swayOffset) * item.swayAmount;
    item.x += dx;
    
    // Bind x bounds
    if (item.x < item.size/2) item.x = item.size/2;
    if (item.x > viewportWidth - item.size/2) item.x = viewportWidth - item.size/2;

    // Update DOM Position
    item.element.style.left = `${item.x}px`;
    item.element.style.top = `${item.y}px`;

    // Check collision grab condition
    let grabbed = false;
    
    if (isHandPresent && currentGesture === 'fist') {
      // Calculate 2D distance between smooth hand pointer and falling item center
      const distance = Math.hypot(smoothHandX - item.x, smoothHandY - item.y);
      const grabRadius = 45; // effective size of palm grab range
      const triggerDistance = (item.size / 2) + grabRadius;
      
      if (distance < triggerDistance) {
        grabbed = true;
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
function createFloatingText(x, y, text, isCombo) {
  const container = document.getElementById('falling-items-container');
  const txtEl = document.createElement('div');
  txtEl.className = 'floating-text' + (isCombo ? ' combo' : '');
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
  const colors = ['#00f0ff', '#ff007f', '#39ff14', '#fffb00'];
  
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
  flashEl.classList.remove('flash-cyan', 'flash-pink');
  // Force reflow so animation restarts cleanly
  void flashEl.offsetWidth;
  flashEl.classList.add(colorType === 'pink' ? 'flash-pink' : 'flash-cyan');
}
