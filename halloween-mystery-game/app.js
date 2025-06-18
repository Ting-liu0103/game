// ===== app.js (修正版) =====
(() => {
  // 遊戲狀態管理
  let gameState = {
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

  let storyData = null;
  let isGameLoaded = false;
  let currentAudio = null;

  // 常量定義
  const GAME_CONSTANTS = {
    MAX_HINTS: 3,
    MAX_LEVELS: 7,
    SAVE_KEY: 'halloween_save',
    SETTINGS_KEY: 'halloween_settings',
    CLUE_NAMES: {
      'A': '但丁密文',
      'B': '黏土腳印樣本',
      'C': '夜行者披風',
      'D': '血漬地圖'
    }
  };

  // DOM 元素引用
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
    inputSuggestions: document.getElementById('input-suggestions'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    helpBtn: document.getElementById('help-btn'),
    thunderSound: document.getElementById('thunder-sound'),
    ambientSound: document.getElementById('ambient-sound'),
    successSound: document.getElementById('success-sound'),
    errorSound: document.getElementById('error-sound')
  };

  // 工具函數
  const utils = {
    formatText(text, variables = {}) {
      if (!text) return '';
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
      });
    },

    saveToStorage(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error(`存儲失敗 [${key}]:`, error);
        return false;
      }
    },

    loadFromStorage(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error(`讀取失敗 [${key}]:`, error);
        return null;
      }
    },

    formatTime(seconds) {
      if (!seconds || seconds < 0) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    calculateAccuracy() {
      const totalAttempts = gameState.wrongAttempts + this.getCurrentLevel();
      if (totalAttempts === 0) return 100;
      const correctAttempts = this.getCurrentLevel();
      return Math.round((correctAttempts / totalAttempts) * 100);
    },

    getCurrentLevel() {
      return Math.max(0, gameState.level);
    },

    checkRequiredFlags(requiredFlags) {
      if (!requiredFlags || !Array.isArray(requiredFlags)) return true;
      return requiredFlags.every(flag => gameState.flags.includes(flag));
    }
  };

  // 音效系統
  const audioManager = {
    play(soundId, volume = null) {
      if (!gameState.settings.soundEnabled) return;
      
      const audioElement = elements[soundId + 'Sound'];
      if (!audioElement) return;

      try {
        const targetVolume = (volume !== null ? volume : gameState.settings.volume) / 100;
        audioElement.volume = Math.max(0, Math.min(1, targetVolume));
        audioElement.currentTime = 0;
        audioElement.play().catch(error => {
          console.warn(`音效播放失敗 [${soundId}]:`, error);
        });
      } catch (error) {
        console.warn(`音效設定失敗 [${soundId}]:`, error);
      }
    },

    playMusic(loop = true) {
      if (!gameState.settings.musicEnabled) return;
      
      this.stopMusic();
      const musicElement = elements.ambientSound;
      if (!musicElement) return;

      try {
        currentAudio = musicElement;
        currentAudio.loop = loop;
        currentAudio.volume = gameState.settings.volume / 100 * 0.3;
        currentAudio.play().catch(error => {
          console.warn('背景音樂播放失敗:', error);
        });
      } catch (error) {
        console.warn('背景音樂設定失敗:', error);
      }
    },

    stopMusic() {
      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio = null;
        } catch (error) {
          console.warn('停止背景音樂失敗:', error);
        }
      }
    },

    setVolume(volume) {
      gameState.settings.volume = Math.max(0, Math.min(100, volume));
      if (currentAudio) {
        currentAudio.volume = gameState.settings.volume / 100 * 0.3;
      }
    }
  };

  // UI 更新函數
  const ui = {
    updateStatus() {
      const currentLevel = utils.getCurrentLevel();
      const levelData = this.getCurrentLevelData();

      if (elements.currentLocation) {
        elements.currentLocation.textContent = levelData?.name || '準備開始';
      }

      if (elements.cluesCount) {
        elements.cluesCount.textContent = `線索: ${gameState.flags.length}/4`;
      }

      const maxHints = GAME_CONSTANTS.MAX_HINTS;
      const remainingHints = Math.max(0, maxHints - gameState.hintCount);
      if (elements.hintsRemaining) {
        elements.hintsRemaining.textContent = `提示: ${remainingHints}/${maxHints}`;
      }

      if (elements.scoreDisplay) {
        elements.scoreDisplay.textContent = `分數: ${gameState.score}`;
      }

      this.updateProgressBar(currentLevel);
      this.updateButtonStates(remainingHints);
    },

    updateProgressBar(currentLevel) {
      if (!elements.progressFill) return;

      const totalLevels = GAME_CONSTANTS.MAX_LEVELS;
      const progress = Math.min(100, (currentLevel / totalLevels) * 100);
      elements.progressFill.style.width = `${progress}%`;

      if (elements.progressCurrent) {
        elements.progressCurrent.textContent = currentLevel;
      }
      if (elements.progressTotal) {
        elements.progressTotal.textContent = totalLevels;
      }
    },

    updateButtonStates(remainingHints) {
      if (elements.hintBtn) {
        elements.hintBtn.disabled = remainingHints <= 0;
      }
    },

    getCurrentLevelData() {
      return storyData?.levels?.find(l => l.id === gameState.level);
    },

    updateCluesList() {
      if (!elements.cluesList) return;

      if (gameState.flags.length === 0) {
        elements.cluesList.innerHTML = '<div class="no-clues">尚未發現任何線索</div>';
        return;
      }

      const cluesHtml = gameState.flags.map(flag => {
        const clueName = GAME_CONSTANTS.CLUE_NAMES[flag] || `線索 ${flag}`;
        return `<div class="clue-item">🔍 ${clueName}</div>`;
      }).join('');

      elements.cluesList.innerHTML = cluesHtml;
    }
  };

  // 遊戲邏輯
  const gameLogic = {
    async loadStoryData() {
      try {
        const response = await fetch('story.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        storyData = await response.json();
        console.log('故事數據載入成功');
        return true;
      } catch (error) {
        console.error('載入故事數據失敗:', error);
        this.addMessage('❌ 遊戲數據載入失敗，請重新整理頁面', 'error-message');
        return false;
      }
    },

    addMessage(text, className = 'system-message') {
      if (!elements.log) return;

      const messageDiv = document.createElement('div');
      messageDiv.className = `log-message ${className}`;
      messageDiv.innerHTML = text;
      elements.log.appendChild(messageDiv);
      elements.log.scrollTop = elements.log.scrollHeight;
    },

    processInput(input) {
      if (!input.trim()) return;

      // 顯示用戶輸入
      this.addMessage(`> ${input}`, 'user-input');

      // 處理全域命令
      if (this.handleGlobalCommands(input)) {
        return;
      }

      // 處理關卡邏輯
      this.handleLevelInput(input);
    },

    handleGlobalCommands(input) {
      const command = input.toLowerCase().trim();
      const globalCommands = storyData?.globals;

      if (!globalCommands) return false;

      if (globalCommands[command]) {
        const commandData = globalCommands[command];
        let response = commandData.response || commandData.response_template || '';

        // 處理模板變數
        response = utils.formatText(response, {
          hint_number: gameState.hintCount + 1,
          max_hints: GAME_CONSTANTS.MAX_HINTS,
          remaining_hints: Math.max(0, GAME_CONSTANTS.MAX_HINTS - gameState.hintCount),
          level_name: ui.getCurrentLevelData()?.name || '未知位置',
          flags_display: gameState.flags.join(', ') || '無',
          time_elapsed: utils.formatTime(Math.floor((Date.now() - (gameState.startTime || Date.now())) / 1000)),
          accuracy_percentage: utils.calculateAccuracy(),
          current_level_hint: this.getCurrentHint()
        });

        this.addMessage(response, 'system-message');

        // 執行命令動作
        if (commandData.action) {
          this.executeAction(commandData.action);
        }

        return true;
