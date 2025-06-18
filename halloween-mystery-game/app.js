// ===== app.js（修正版） =====

// 全域遊戲狀態
const gameState = {
  level: 0,
  flags: [],
  hintCount: 0,
  score: 0,
  wrongAttempts: 0,
  startTime: null,
  achievements: [],
  isGameCompleted: false,
  currentEnding: null,
  settings: {
    soundEnabled: true,
    musicEnabled: true,
    volume: 70,
    difficulty: 'normal'
  }
};

// 常量定義
const GAME_CONSTANTS = {
  SAVE_KEY: 'halloween_save',
  SETTINGS_KEY: 'halloween_settings'
};

let storyData = null;
let currentAudio = null;

// 綁定所有需要的 DOM 元素
const elements = {
  log: document.getElementById('log'),
  input: document.getElementById('input'),
  sendBtn: document.getElementById('send'),
  currentLocation: document.getElementById('current-location'),
  cluesCount: document.getElementById('clues-count'),
  hintsRemaining: document.getElementById('hints-remaining'),
  scoreDisplay: document.getElementById('score-display'),
  hintBtn: document.getElementById('hint-btn'),
  statusBtn: document.getElementById('status-btn'),
  saveBtn: document.getElementById('save-btn'),
  loadBtn: document.getElementById('load-btn'),
  cluesList: document.getElementById('clues-list'),
  achievementsList: document.getElementById('achievements-list'),
  progressFill: document.getElementById('progress-fill'),
  progressCurrent: document.getElementById('progress-current'),
  progressTotal: document.getElementById('progress-total'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsBtn: document.getElementById('settings-btn'),
  closeSettings: document.getElementById('close-settings'),
  soundToggle: document.getElementById('sound-toggle'),
  musicToggle: document.getElementById('music-toggle'),
  volumeSlider: document.getElementById('volume-slider'),
  volumeValue: document.getElementById('volume-value'),
  difficultySelect: document.getElementById('difficulty-select'),
  resetGame: document.getElementById('reset-game'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  helpBtn: document.getElementById('help-btn'),
  thunderSound: document.getElementById('thunder-sound'),
  ambientSound: document.getElementById('ambient-sound'),
  successSound: document.getElementById('success-sound'),
  errorSound: document.getElementById('error-sound')
};

// 工具函式：非同步載入 JSON、存取 localStorage
const utils = {
  async loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`載入失敗：${resp.status}`); 
    return await resp.json();  // 使用 Fetch API 解析 JSON[1]
  },
  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));  // 使用 localStorage 儲存設定[3]
  },
  load(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;  // 從 localStorage 讀取並解析[3]
  }
};

// 音效管理器
const audioManager = {
  play(id, volume = null) {
    if (!gameState.settings.soundEnabled) return;
    const el = elements[id + 'Sound'];
    if (!el) return;
    el.volume = ((volume !== null ? volume : gameState.settings.volume) / 100);
    el.currentTime = 0;
    el.play().catch(()=>{});  // 音訊播放錯誤不阻斷流程[4]
  },
  playMusic() {
    if (!gameState.settings.musicEnabled) return;
    this.stopMusic();
    const bg = elements.ambientSound;
    bg.volume = gameState.settings.volume / 100 * 0.3;
    bg.loop = true;
    bg.play().catch(()=>{});
    currentAudio = bg;
  },
  stopMusic() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  }
};

// 核心遊戲邏輯
const gameLogic = {
  async initialize() {
    try {
      this.showLoading();
      // 載入故事資料
      storyData = await utils.loadJSON('story.json');
      // 載入使用者設定
      const saved = utils.load(GAME_CONSTANTS.SETTINGS_KEY);
      if (saved) gameState.settings = saved;
      
      // 【音樂修正】不在這裡啟動音樂，因為瀏覽器會阻擋
      // audioManager.playMusic(); 
      
      // 綁定事件
      this.bindEvents();
      // 啟動遊戲
      this.start();
    } catch (e) {
      elements.log.innerHTML = `<div class="error-message">初始化失敗：${e.message}</div>`;
    } finally {
      this.hideLoading();
    }
  },

  showLoading() {
      document.getElementById('loading-screen').classList.remove('loading--hidden');
  },

  hideLoading() {
      document.getElementById('loading-screen').classList.add('loading--hidden');
      document.body.classList.add('game-loaded');
      document.querySelector('.game').classList.remove('game--hidden');
  },

  bindEvents() {
    // 【訊息修正】確保監聽器呼叫的是下方已更名的 handleInput 函式
    elements.sendBtn.addEventListener('click', () => this.handleInput());
    elements.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleInput();
        }
    });

    // --- 其他按鈕的事件綁定 (維持原樣) ---
    elements.hintBtn.addEventListener('click', ()=> this.onHint());
    elements.statusBtn.addEventListener('click', ()=> this.onStatus());
    elements.saveBtn.addEventListener('click', ()=> this.onSave());
    elements.loadBtn.addEventListener('click', ()=> this.onLoad());
    elements.settingsBtn.addEventListener('click', ()=> elements.settingsPanel.classList.toggle('active'));
    elements.closeSettings.addEventListener('click', ()=> elements.settingsPanel.classList.remove('active'));
    elements.soundToggle.addEventListener('change', e=> {
      gameState.settings.soundEnabled = e.target.checked;
      utils.save(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
    });
    elements.musicToggle.addEventListener('change', e=> {
      gameState.settings.musicEnabled = e.target.checked;
      if (e.target.checked) audioManager.playMusic(); else audioManager.stopMusic();
      utils.save(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
    });
    elements.volumeSlider.addEventListener('input', e=> {
      gameState.settings.volume = e.target.value;
      elements.volumeValue.textContent = e.target.value;
      audioManager.play('success', e.target.value);
    });
    elements.difficultySelect.addEventListener('change', e=> {
      gameState.settings.difficulty = e.target.value;
      utils.save(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
    });
    elements.resetGame.addEventListener('click', ()=> location.reload());
    elements.fullscreenBtn.addEventListener('click', ()=> document.documentElement.requestFullscreen());
    elements.helpBtn.addEventListener('click', ()=> this.onHelp());
  },

  start() {
    gameState.startTime = Date.now();
    this.addMessage(storyData.globals['/start'].response, 'welcome');
  },

  addMessage(text, type='system') {
    const div = document.createElement('div');
    div.className = `${type}-message`;
    div.innerHTML = text.replace(/\n/g,'<br>');
    elements.log.append(div);
    elements.log.scrollTop = elements.log.scrollHeight;
  },

  // 【訊息修正】將 onSend 更名為 handleInput，以對應 bindEvents 中的呼叫
  handleInput() {
    const cmd = elements.input.value.trim();
    if (!cmd) return;

    // 【音樂修正】在第一次使用者互動時才播放音樂
    if (!gameState.musicStarted && gameState.settings.musicEnabled) {
      audioManager.playMusic();
      gameState.musicStarted = true; // 設置一個旗標，確保只播放一次
    }

    this.addMessage(cmd, 'user');
    elements.input.value = '';
    // TODO: 處理指令邏輯
  },
  
  onHint() { /* TODO: 顯示提示 */ },
  onStatus() { /* TODO: 顯示狀態 */ },
  onSave() {
    utils.save(GAME_CONSTANTS.SAVE_KEY, gameState);
    this.addMessage('💾 遊戲已保存！', 'success');
  },
  onLoad() {
    const data = utils.load(GAME_CONSTANTS.SAVE_KEY);
    if (data) Object.assign(gameState, data);
    this.addMessage('📂 遊戲已載入！', 'success');
  },
  onHelp() {
    this.addMessage('🤖 可用指令：/hint、/status、/save、/load', 'system');
  }
};

// 等待 DOMContentLoaded 後啟動
document.addEventListener('DOMContentLoaded', ()=> gameLogic.initialize());
