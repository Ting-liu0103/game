// ==================== app.js (最終整合修正版) ====================

// 常數
const GAME_CONSTANTS = {
    SAVE_KEY: 'halloween_mystery_save',
    SETTINGS_KEY: 'halloween_mystery_settings'
};

// DOM 元素快取物件 (先宣告為空，稍後由 gameLogic.cacheElements 填入)
const elements = {
    log: null, input: null, sendBtn: null, hintBtn: null, statusBtn: null,
    saveBtn: null, loadBtn: null, settingsBtn: null, helpBtn: null,
    fullscreenBtn: null, cluesCount: null, hintsRemaining: null,
    scoreDisplay: null, currentLocation: null, progressFill: null,
    progressCurrent: null, progressTotal: null, cluesList: null,
    achievementsList: null, settingsPanel: null, closeSettings: null,
    soundToggle: null, musicToggle: null, volumeSlider: null,
    volumeValue: null, difficultySelect: null, resetGame: null
};

// 全域遊戲狀態
let storyData = null;
let gameState = {
    currentLevelId: 1,
    flags: [],
    hintsUsed: 0,
    score: 0,
    startTime: null,
    settings: {
        soundEnabled: true,
        musicEnabled: true,
        volume: 70,
        difficulty: 'normal'
    },
    musicStarted: false // 用於追蹤音樂是否已開始播放
};

// 音效管理器
const audioManager = {
    sounds: {}, // 音訊物件將在 cacheElements 後動態建立
    setup() {
        this.sounds.thunder = document.getElementById('thunder-sound');
        this.sounds.ambient = document.getElementById('ambient-sound');
        this.sounds.success = document.getElementById('success-sound');
        this.sounds.error = document.getElementById('error-sound');
    },
    play(soundName) {
        if (!gameState.settings.soundEnabled) return;
        const sound = this.sounds[soundName];
        if (sound) {
            sound.volume = gameState.settings.volume / 100;
            sound.currentTime = 0; // 確保可以連續觸發
            sound.play().catch(e => console.error(`音效播放失敗: ${soundName}`, e));
        }
    },
    playMusic() {
        if (!gameState.settings.musicEnabled || gameState.musicStarted) return;
        const music = this.sounds.ambient;
        if(music) {
            music.loop = true;
            music.volume = (gameState.settings.volume / 100) * 0.5; // 背景音樂音量減半
            music.play().catch(e => console.error('背景音樂播放失敗', e));
            gameState.musicStarted = true;
        }
    },
    stopMusic() {
        const music = this.sounds.ambient;
        if(music) {
            music.pause();
            music.currentTime = 0;
        }
        gameState.musicStarted = false;
    }
};

// 實用工具函式
const utils = {
    async loadJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`無法載入 ${url}: ${response.statusText}`);
        }
        return response.json();
    },
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('儲存失敗', e);
        }
    },
    load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('載入失敗', e);
            return null;
        }
    }
};

// 核心遊戲邏輯
const gameLogic = {
    // 【新增】步驟 1: 快取所有 DOM 元素
    cacheElements() {
        const ids = Object.keys(elements);
        ids.forEach(id => {
            const elementId = id.replace(/([A-Z])/g, "-$1").toLowerCase();
            elements[id] = document.getElementById(elementId);
        });

        // 修正幾個駝峰命名與 ID 不一致的地方
        elements.sendBtn = document.getElementById('send');
        elements.cluesCount = document.getElementById('clues-count');
        elements.hintsRemaining = document.getElementById('hints-remaining');
        elements.scoreDisplay = document.getElementById('score-display');
        elements.currentLocation = document.getElementById('current-location');
        elements.progressFill = document.getElementById('progress-fill');
        elements.progressCurrent = document.getElementById('progress-current');
        elements.progressTotal = document.getElementById('progress-total');
        elements.cluesList = document.getElementById('clues-list');
        elements.achievementsList = document.getElementById('achievements-list');

        // 檢查是否有元素沒抓到
        for (const key in elements) {
            if (elements[key] === null) {
                console.error(`初始化警告：找不到 HTML 元素 #${key} 或其對應的 ID。`);
            }
        }
    },

    async initialize() {
        try {
            this.showLoading();

            // 【修正】將 cacheElements 作為第一步，確保所有元素都已找到
            this.cacheElements();
            
            // 【修正】在快取元素後，才能設定音效管理器
            audioManager.setup();

            // 步驟 2: 載入故事資料
            storyData = await utils.loadJSON('story.json');

            // 步驟 3: 載入使用者設定
            const savedSettings = utils.load(GAME_CONSTANTS.SETTINGS_KEY);
            if (savedSettings) gameState.settings = { ...gameState.settings, ...savedSettings };

            // 步驟 4: 綁定事件 (現在可以安全執行)
            this.bindEvents();

            // 步驟 5: 啟動遊戲
            this.start();
        } catch (e) {
            console.error('遊戲初始化失敗:', e);
            document.body.innerHTML = `<div class="fatal-error">致命錯誤：遊戲載入失敗，請檢查瀏覽器主控台 (F12) 的錯誤訊息。<br>錯誤: ${e.message}</div>`;
        } finally {
            this.hideLoading();
        }
    },

    showLoading() {
        document.getElementById('loading-screen').classList.remove('loading--hidden');
    },

    hideLoading() {
        document.getElementById('loading-screen').classList.add('loading--hidden');
        document.querySelector('.game').classList.remove('game--hidden');
        document.body.classList.add('game-loaded');
    },

    bindEvents() {
        elements.sendBtn.addEventListener('click', () => this.handleInput());
        elements.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleInput();
            }
        });
        
        elements.hintBtn.addEventListener('click', () => this.onCommand('/hint'));
        elements.statusBtn.addEventListener('click', () => this.onCommand('/status'));
        elements.saveBtn.addEventListener('click', () => this.onCommand('/save'));
        elements.loadBtn.addEventListener('click', () => this.onCommand('/load'));
        elements.helpBtn.addEventListener('click', () => this.onCommand('/help'));
        
        elements.settingsBtn.addEventListener('click', () => elements.settingsPanel.classList.toggle('active'));
        elements.closeSettings.addEventListener('click', () => elements.settingsPanel.classList.remove('active'));
        elements.resetGame.addEventListener('click', () => { if(confirm('確定要重置所有遊戲進度嗎？')) location.reload(); });
        elements.fullscreenBtn.addEventListener('click', () => document.documentElement.requestFullscreen().catch(err => console.warn(err)));

        elements.musicToggle.addEventListener('change', e => {
            gameState.settings.musicEnabled = e.target.checked;
            utils.save(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
            if (e.target.checked) audioManager.playMusic(); else audioManager.stopMusic();
        });
        // (其他設定的監聽器...)
    },
    
    start() {
        gameState.startTime = Date.now();
        this.addMessage(storyData.globals['/start'].response, 'welcome');
        audioManager.play('thunder');
    },
    
    addMessage(text, type = 'system') {
        const div = document.createElement('div');
        div.className = `log__message log__message--${type}`;
        div.innerHTML = text.replace(/\n/g, '<br>');
        elements.log.append(div);
        elements.log.scrollTop = elements.log.scrollHeight;
    },

    handleInput() {
        const cmd = elements.input.value.trim();
        if (!cmd) return;

        // 在第一次使用者互動時才播放音樂
        if (gameState.settings.musicEnabled && !gameState.musicStarted) {
            audioManager.playMusic();
        }

        this.addMessage(`> ${cmd}`, 'user');
        elements.input.value = '';

        this.processCommand(cmd);
    },

    processCommand(cmd) {
        const lowerCmd = cmd.toLowerCase();
        
        // 優先處理全域指令
        if (storyData.globals[lowerCmd]) {
            this.onCommand(lowerCmd);
            return;
        }

        // TODO: 在此處加入處理當前關卡答案和分支的邏輯
        
        // 若找不到任何對應指令，則顯示預設錯誤
        this.addMessage("無法識別的指令或答案。請檢查輸入，或使用 `/hint` 獲取提示。", 'error');
        audioManager.play('error');
    },
    
    // 統一處理全域指令
    onCommand(cmd) {
        const commandData = storyData.globals[cmd];
        if (!commandData) return;

        this.addMessage(commandData.response, 'system');
        
        if(cmd === '/save') {
            utils.save(GAME_CONSTANTS.SAVE_KEY, gameState);
            audioManager.play('success');
        } else if (cmd === '/load') {
            const loadedState = utils.load(GAME_CONSTANTS.SAVE_KEY);
            if (loadedState) {
                gameState = { ...gameState, ...loadedState };
                this.addMessage("遊戲進度已成功載入！", 'success');
                // TODO: 根據載入的狀態更新UI
            } else {
                this.addMessage("找不到存檔。", 'error');
            }
        }
        // TODO: 處理 /hint, /status 等其他指令
    }
};

// 最終啟動點：等待所有 HTML 都載入完成後，才開始執行遊戲邏輯
document.addEventListener('DOMContentLoaded', () => {
    gameLogic.initialize();
});
