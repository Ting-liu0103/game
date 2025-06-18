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
        elements.cluesList.innerHTML = '<div class="no-clues">尚未發現線索...</div>';
        return;
      }
      
      const clueItems = gameState.flags.map(flag => {
        const clueName = GAME_CONSTANTS.CLUE_NAMES[flag] || '未知線索';
        return `
          <div class="clue-item">
            <span class="clue-icon">🔍</span>
            <span class="clue-name">線索${flag}: ${clueName}</span>
          </div>
        `;
      }).join('');
      
      elements.cluesList.innerHTML = clueItems;
    }
  };

  // 日誌函數
  function appendToLog(text, className = '') {
    if (!elements.log || !text) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `log-message ${className}`;
    messageDiv.innerHTML = text;
    elements.log.appendChild(messageDiv);
    
    elements.log.scrollTop = elements.log.scrollHeight;
    
    // 限制日誌條目數量
    while (elements.log.children.length > 100) {
      elements.log.removeChild(elements.log.firstChild);
    }
  }

  // 指令處理
  function processCommand(cmd) {
    switch (cmd) {
      case '/start':
        resetGameState();
        appendToLog('🎭 遊戲開始！歡迎來到萬聖夜驚變！', 'system-message');
        appendToLog('你發現自己身處一座古老的莊園中，化裝舞會正在進行...', 'level-prompt');
        audioManager.play('thunder', 80);
        setTimeout(() => audioManager.playMusic(), 1000);
        break;
        
      case '/hint':
        if (gameState.hintCount >= GAME_CONSTANTS.MAX_HINTS) {
          appendToLog('❌ 沒有剩餘提示了', 'error-message');
          audioManager.play('error');
        } else {
          gameState.hintCount++;
          const hint = getCurrentLevelHint();
          appendToLog(`💡 提示 ${gameState.hintCount}/${GAME_CONSTANTS.MAX_HINTS}：\n${hint}`, 'system-message');
          ui.updateStatus();
          audioManager.play('success', 50);
        }
        break;
        
      case '/status':
        const playTime = gameState.startTime ? Math.floor((Date.now() - gameState.startTime) / 1000) : 0;
        const accuracy = utils.calculateAccuracy();
        const statusText = `📊 當前狀態\n━━━━━━━━━━━━━━\n🏠 位置： ${ui.getCurrentLevelData()?.name || '準備開始'}\n🔍 收集線索： ${gameState.flags.join(', ') || '無'}\n💡 剩餘提示： ${Math.max(0, GAME_CONSTANTS.MAX_HINTS - gameState.hintCount)}/${GAME_CONSTANTS.MAX_HINTS}\n⏱️ 調查時間： ${utils.formatTime(playTime)}\n🎯 推理準確度： ${accuracy}%`;
        appendToLog(statusText, 'system-message');
        break;
        
      case '/save':
        if (saveGame()) {
          appendToLog('💾 遊戲已保存！', 'system-message');
          audioManager.play('success', 30);
        } else {
          appendToLog('❌ 保存失敗', 'error-message');
        }
        break;
        
      case '/load':
        if (loadGame()) {
          appendToLog('📂 遊戲已載入！', 'system-message');
          audioManager.play('success', 30);
        } else {
          appendToLog('❌ 沒有找到存檔', 'error-message');
        }
        break;
        
      default:
        handleUserInput(cmd.replace('/', ''));
    }
  }

  function getCurrentLevelHint() {
    const hints = [
      '仔細觀察每個細節，線索可能隱藏在最不起眼的地方',
      '注意角色證詞中的矛盾之處',
      '收集所有線索可以解鎖隱藏劇情'
    ];
    return hints[Math.min(gameState.hintCount - 1, hints.length - 1)];
  }

  function handleUserInput(text) {
    if (!text?.trim()) return;
    
    appendToLog(`> ${text}`, 'user-input');
    
    // 簡單的回應邏輯
    if (text.toLowerCase().includes('檢查') || text.toLowerCase().includes('調查')) {
      appendToLog('🔍 你仔細檢查了周圍，發現了一些有趣的線索...', 'success-message');
      audioManager.play('success');
    } else if (text.toLowerCase().includes('幫助') || text.toLowerCase().includes('說明')) {
      appendToLog('📖 遊戲說明：\n• 使用 /start 開始遊戲\n• 使用 /hint 獲取提示\n• 使用 /status 查看狀態\n• 輸入調查指令進行探索', 'system-message');
    } else {
      appendToLog('❓ 請嘗試其他指令，或使用 /hint 獲取提示', 'warning-message');
    }
  }

  // 遊戲存檔系統
  function saveGame() {
    const saveData = {
      ...gameState,
      timestamp: Date.now(),
      version: 2.0
    };
    
    return utils.saveToStorage(GAME_CONSTANTS.SAVE_KEY, saveData);
  }

  function loadGame() {
    const saveData = utils.loadFromStorage(GAME_CONSTANTS.SAVE_KEY);
    
    if (!saveData) return false;
    
    Object.assign(gameState, saveData);
    ui.updateStatus();
    ui.updateCluesList();
    
    return true;
  }

  function resetGameState() {
    const oldSettings = gameState.settings;
    
    gameState = {
      level: 1,
      flags: [],
      hintCount: 0,
      score: 0,
      wrongAttempts: 0,
      startTime: Date.now(),
      achievements: [],
      isGameCompleted: false,
      currentEnding: null,
      settings: oldSettings
    };
    
    ui.updateStatus();
    ui.updateCluesList();
  }

  // 設定系統
  function loadSettings() {
    const savedSettings = utils.loadFromStorage(GAME_CONSTANTS.SETTINGS_KEY);
    if (savedSettings) {
      gameState.settings = { ...gameState.settings, ...savedSettings };
    }
    applySettings();
  }

  function applySettings() {
    const settings = gameState.settings;
    
    if (elements.soundToggle) elements.soundToggle.checked = settings.soundEnabled;
    if (elements.musicToggle) elements.musicToggle.checked = settings.musicEnabled;
    if (elements.volumeSlider) elements.volumeSlider.value = settings.volume;
    if (elements.volumeValue) elements.volumeValue.textContent = settings.volume;
    if (elements.difficultySelect) elements.difficultySelect.value = settings.difficulty;
  }

  function saveSettings() {
    utils.saveToStorage(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
  }

  // 事件監聽器設定
  function setupEventListeners() {
    // 主要輸入事件
    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', handleSendClick);
    }
    
    if (elements.input) {
      elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSendClick();
        }
      });
    }

    // 快速按鈕事件
    const buttonMap = {
      hintBtn: '/hint',
      statusBtn: '/status',
      saveBtn: '/save',
      loadBtn: '/load'
    };
    
    Object.entries(buttonMap).forEach(([elementKey, command]) => {
      const element = elements[elementKey];
      if (element) {
        element.addEventListener('click', () => processCommand(command));
      }
    });

    // 設定面板事件
    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', () => {
        if (elements.settingsPanel) {
          elements.settingsPanel.classList.remove('hidden');
        }
      });
    }
    
    if (elements.closeSettings) {
      elements.closeSettings.addEventListener('click', () => {
        if (elements.settingsPanel) {
          elements.settingsPanel.classList.add('hidden');
        }
      });
    }

    // 設定控制項
    if (elements.soundToggle) {
      elements.soundToggle.addEventListener('change', (e) => {
        gameState.settings.soundEnabled = e.target.checked;
        saveSettings();
      });
    }
    
    if (elements.musicToggle) {
      elements.musicToggle.addEventListener('change', (e) => {
        gameState.settings.musicEnabled = e.target.checked;
        if (e.target.checked) {
          audioManager.playMusic();
        } else {
          audioManager.stopMusic();
        }
        saveSettings();
      });
    }
    
    if (elements.volumeSlider) {
      elements.volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        audioManager.setVolume(volume);
        if (elements.volumeValue) {
          elements.volumeValue.textContent = volume;
        }
        saveSettings();
      });
    }
    
    if (elements.difficultySelect) {
      elements.difficultySelect.addEventListener('change', (e) => {
        gameState.settings.difficulty = e.target.value;
        saveSettings();
      });
    }
    
    if (elements.resetGame) {
      elements.resetGame.addEventListener('click', () => {
        if (confirm('確定要重置所有遊戲進度嗎？')) {
          resetGameState();
          appendToLog('🔄 遊戲已重置', 'system-message');
        }
      });
    }

    // 全螢幕按鈕
    if (elements.fullscreenBtn) {
      elements.fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn('無法進入全螢幕模式:', err);
          });
        } else {
          document.exitFullscreen();
