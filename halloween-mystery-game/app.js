// ===== app.js (改善版) =====
(() => {
  // ==================== 遊戲狀態管理 ====================
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
  let loadRetryCount = 0;
  const MAX_RETRY_COUNT = 3;

  // ==================== 常量定義 ====================
  const GAME_CONSTANTS = {
    MAX_HINTS: 3,
    MAX_LEVELS: 7,
    SAVE_KEY: 'halloween_save',
    SETTINGS_KEY: 'halloween_settings',
    HIGH_SCORE_KEY: 'halloween_high_score',
    CLUE_NAMES: {
      'A': '但丁密文',
      'B': '黏土腳印樣本', 
      'C': '夜行者披風',
      'D': '血漬地圖'
    },
    AUDIO_FADE_DURATION: 500,
    NOTIFICATION_DURATION: 3000
  };

  // ==================== DOM 元素引用 ====================
  const elements = {
    // 載入畫面
    loadingScreen: document.getElementById('loading-screen'),
    loadingProgress: document.querySelector('.loading-progress'),
    loadingText: document.querySelector('.loading-text'),
    
    // 遊戲容器
    gameContainer: document.getElementById('game-container'),
    
    // 主要遊戲元素
    log: document.getElementById('log'),
    input: document.getElementById('input'),
    sendBtn: document.getElementById('send'),
    
    // 狀態顯示
    currentLocation: document.getElementById('current-location'),
    cluesCount: document.getElementById('clues-count'),
    hintsRemaining: document.getElementById('hints-remaining'),
    scoreDisplay: document.getElementById('score-display'),
    
    // 快速按鈕
    hintBtn: document.getElementById('hint-btn'),
    statusBtn: document.getElementById('status-btn'),
    saveBtn: document.getElementById('save-btn'),
    loadBtn: document.getElementById('load-btn'),
    
    // 側邊欄
    cluesList: document.getElementById('clues-list'),
    progressFill: document.getElementById('progress-fill'),
    progressCurrent: document.getElementById('progress-current'),
    progressTotal: document.getElementById('progress-total'),
    
    // 設定面板
    settingsPanel: document.getElementById('settings-panel'),
    settingsBtn: document.getElementById('settings-btn'),
    closeSettings: document.getElementById('close-settings'),
    soundToggle: document.getElementById('sound-toggle'),
    musicToggle: document.getElementById('music-toggle'),
    volumeSlider: document.getElementById('volume-slider'),
    volumeValue: document.getElementById('volume-value'),
    difficultySelect: document.getElementById('difficulty-select'),
    resetGame: document.getElementById('reset-game'),
    
    // 其他UI元素
    inputSuggestions: document.getElementById('input-suggestions'),
    achievementNotification: document.getElementById('achievement-notification'),
    confirmDialog: document.getElementById('confirm-dialog'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    
    // 音效元素
    thunderSound: document.getElementById('thunder-sound'),
    ambientSound: document.getElementById('ambient-sound'),
    successSound: document.getElementById('success-sound'),
    errorSound: document.getElementById('error-sound')
  };

  // ==================== 工具函數 ====================
  const utils = {
    // 格式化文字輸出
    formatText(text, variables = {}) {
      if (!text) return '';
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
      });
    },

    // 安全的本地存儲
    saveToStorage(key, data) {
      try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);
        return true;
      } catch (error) {
        console.error(`存儲失敗 [${key}]:`, error);
        // 嘗試清理存儲空間
        if (error.name === 'QuotaExceededError') {
          this.clearOldSaves();
          // 重試一次
          try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
          } catch (retryError) {
            console.error('重試存儲失敗:', retryError);
          }
        }
        return false;
      }
    },

    loadFromStorage(key) {
      try {
        const data = localStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data);
      } catch (error) {
        console.error(`讀取失敗 [${key}]:`, error);
        // 如果數據損壞，清除該項目
        localStorage.removeItem(key);
        return null;
      }
    },

    // 清理舊存檔
    clearOldSaves() {
      try {
        const keysToCheck = ['halloween_save', 'halloween_settings'];
        keysToCheck.forEach(key => {
          const data = localStorage.getItem(key);
          if (data) {
            try {
              const parsed = JSON.parse(data);
              // 檢查是否為舊版本數據
              if (!parsed.version || parsed.version < 2.0) {
                localStorage.removeItem(key);
                console.log(`清理舊版本數據: ${key}`);
              }
            } catch (e) {
              localStorage.removeItem(key);
            }
          }
        });
      } catch (error) {
        console.error('清理存儲失敗:', error);
      }
    },

    // 防抖函數
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // 節流函數
    throttle(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // 格式化時間
    formatTime(seconds) {
      if (!seconds || seconds < 0) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // 計算準確度
    calculateAccuracy() {
      const totalAttempts = gameState.wrongAttempts + this.getCurrentLevel();
      if (totalAttempts === 0) return 100;
      const correctAttempts = this.getCurrentLevel();
      return Math.round((correctAttempts / totalAttempts) * 100);
    },

    // 獲取當前關卡
    getCurrentLevel() {
      return Math.max(0, gameState.level);
    },

    // 檢查線索需求
    checkRequiredFlags(requiredFlags) {
      if (!requiredFlags || !Array.isArray(requiredFlags)) return true;
      return requiredFlags.every(flag => gameState.flags.includes(flag));
    },

    // 安全的元素操作
    safeElementOperation(element, operation, ...args) {
      try {
        if (element && typeof element[operation] === 'function') {
          return element[operation](...args);
        }
      } catch (error) {
        console.warn(`元素操作失敗 [${operation}]:`, error);
      }
      return null;
    },

    // 深度複製對象
    deepClone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj.getTime());
      if (obj instanceof Array) return obj.map(item => this.deepClone(item));
      if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            clonedObj[key] = this.deepClone(obj[key]);
          }
        }
        return clonedObj;
      }
    }
  };

  // ==================== 音效系統 ====================
  const audioManager = {
    currentFadeTimeout: null,

    play(soundId, volume = null) {
      if (!gameState.settings.soundEnabled) return Promise.resolve();
      
      const audioElement = elements[soundId + 'Sound'];
      if (!audioElement) {
        console.warn(`音效元素不存在: ${soundId}`);
        return Promise.resolve();
      }
      
      try {
        const targetVolume = (volume !== null ? volume : gameState.settings.volume) / 100;
        audioElement.volume = Math.max(0, Math.min(1, targetVolume));
        audioElement.currentTime = 0;
        
        return audioElement.play().catch(error => {
          console.warn(`音效播放失敗 [${soundId}]:`, error);
        });
      } catch (error) {
        console.warn(`音效設定失敗 [${soundId}]:`, error);
        return Promise.resolve();
      }
    },

    playMusic(loop = true) {
      if (!gameState.settings.musicEnabled) return;
      
      this.stopMusic();
      
      const musicElement = elements.ambientSound;
      if (!musicElement) {
        console.warn('背景音樂元素不存在');
        return;
      }
      
      try {
        currentAudio = musicElement;
        currentAudio.loop = loop;
        currentAudio.volume = Math.max(0, Math.min(1, gameState.settings.volume / 100 * 0.3));
        
        const playPromise = currentAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('背景音樂播放失敗:', error);
            currentAudio = null;
          });
        }
      } catch (error) {
        console.warn('背景音樂設定失敗:', error);
        currentAudio = null;
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

    fadeOut(duration = GAME_CONSTANTS.AUDIO_FADE_DURATION) {
      if (!currentAudio) return;
      
      const startVolume = currentAudio.volume;
      const fadeStep = startVolume / (duration / 50);
      
      const fade = () => {
        if (currentAudio && currentAudio.volume > 0) {
          currentAudio.volume = Math.max(0, currentAudio.volume - fadeStep);
          this.currentFadeTimeout = setTimeout(fade, 50);
        } else {
          this.stopMusic();
        }
      };
      
      fade();
    },

    setVolume(volume) {
      const normalizedVolume = Math.max(0, Math.min(100, volume));
      gameState.settings.volume = normalizedVolume;
      
      if (currentAudio) {
        try {
          currentAudio.volume = normalizedVolume / 100 * 0.3;
        } catch (error) {
          console.warn('設定音量失敗:', error);
        }
      }
    }
  };

  // ==================== UI 更新函數 ====================
  const ui = {
    // 更新遊戲狀態顯示
    updateStatus() {
      const currentLevel = utils.getCurrentLevel();
      const levelData = this.getCurrentLevelData();
      
      this.updateElement(elements.currentLocation, levelData?.name || '準備開始');
      this.updateElement(elements.cluesCount, `線索: ${gameState.flags.length}/4`);
      
      const maxHints = storyData?.game_config?.max_hints || GAME_CONSTANTS.MAX_HINTS;
      const remainingHints = Math.max(0, maxHints - gameState.hintCount);
      this.updateElement(elements.hintsRemaining, `提示: ${remainingHints}/${maxHints}`);
      this.updateElement(elements.scoreDisplay, `分數: ${gameState.score}`);
      
      // 更新進度條
      this.updateProgressBar(currentLevel);
      
      // 更新按鈕狀態
      this.updateButtonStates(remainingHints);
    },

    updateElement(element, content) {
      if (element && content !== undefined) {
        element.textContent = content;
      }
    },

    updateProgressBar(currentLevel) {
      if (!elements.progressFill || !elements.progressCurrent) return;
      
      const totalLevels = storyData?.levels?.length || GAME_CONSTANTS.MAX_LEVELS;
      const progress = Math.min(100, (currentLevel / totalLevels) * 100);
      
      elements.progressFill.style.width = `${progress}%`;
      elements.progressCurrent.textContent = currentLevel;
      if (elements.progressTotal) {
        elements.progressTotal.textContent = totalLevels;
      }
    },

    updateButtonStates(remainingHints) {
      if (elements.hintBtn) {
        elements.hintBtn.disabled = remainingHints <= 0;
        elements.hintBtn.title = remainingHints <= 0 ? '沒有剩餘提示' : `剩餘 ${remainingHints} 個提示`;
      }
    },

    getCurrentLevelData() {
      return storyData?.levels?.find(l => l.id === gameState.level);
    },

    // 更新線索列表
    updateCluesList() {
      if (!elements.cluesList) return;
      
      if (gameState.flags.length === 0) {
        elements.cluesList.innerHTML = '<div class="no-clues">尚未發現線索...</div>';
        return;
      }
      
      const clueItems = gameState.flags.map(flag => {
        const clueName = GAME_CONSTANTS.CLUE_NAMES[flag] || '未知線索';
        return `
          <div class="clue-item" data-flag="${flag}">
            <span class="clue-icon">🔍</span>
            <span class="clue-name">線索${flag}: ${clueName}</span>
          </div>
        `;
      }).join('');
      
      elements.cluesList.innerHTML = clueItems;
    },

    // 顯示輸入建議
    showSuggestions(suggestions) {
      if (!elements.inputSuggestions || !Array.isArray(suggestions)) return;
      
      if (suggestions.length === 0) {
        this.hideSuggestions();
        return;
      }
      
      const suggestionItems = suggestions.map(suggestion => `
        <div class="suggestion-item" data-command="${suggestion.command}" tabindex="0">
          <span class="suggestion-icon">${suggestion.icon}</span>
          <span class="suggestion-text">${suggestion.text}</span>
        </div>
      `).join('');
      
      elements.inputSuggestions.innerHTML = suggestionItems;
      elements.inputSuggestions.classList.remove('hidden');
    },

    // 隱藏輸入建議
    hideSuggestions() {
      if (elements.inputSuggestions) {
        elements.inputSuggestions.classList.add('hidden');
      }
    },

    // 顯示成就通知
    showAchievement(title, description) {
      if (!elements.achievementNotification) return;
      
      const titleEl = elements.achievementNotification.querySelector('.achievement-title');
      const descEl = elements.achievementNotification.querySelector('.achievement-description');
      
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = description;
      
      elements.achievementNotification.classList.remove('hidden');
      
      // 自動隱藏
      setTimeout(() => {
        if (elements.achievementNotification) {
          elements.achievementNotification.classList.add('hidden');
        }
      }, GAME_CONSTANTS.NOTIFICATION_DURATION);
    },

    // 顯示確認對話框
    showConfirmDialog(title, message, onConfirm, onCancel = null) {
      if (!elements.confirmDialog) return;
      
      const titleEl = elements.confirmDialog.querySelector('.dialog-title');
      const messageEl = elements.confirmDialog.querySelector('.dialog-message');
      const yesBtn = elements.confirmDialog.querySelector('#confirm-yes');
      const noBtn = elements.confirmDialog.querySelector('#confirm-no');
      
      if (titleEl) titleEl.textContent = title;
      if (messageEl) messageEl.textContent = message;
      
      // 移除舊的事件監聽器
      const newYesBtn = yesBtn?.cloneNode(true);
      const newNoBtn = noBtn?.cloneNode(true);
      
      if (newYesBtn && yesBtn?.parentNode) {
        yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
        newYesBtn.addEventListener('click', () => {
          this.hideConfirmDialog();
          if (onConfirm) onConfirm();
        });
      }
      
      if (newNoBtn && noBtn?.parentNode) {
        noBtn.parentNode.replaceChild(newNoBtn, noBtn);
        newNoBtn.addEventListener('click', () => {
          this.hideConfirmDialog();
          if (onCancel) onCancel();
        });
      }
      
      elements.confirmDialog.classList.remove('hidden');
    },

    hideConfirmDialog() {
      if (elements.confirmDialog) {
        elements.confirmDialog.classList.add('hidden');
      }
    },

    // 顯示載入狀態
    showLoading(text, progress = 0) {
      if (elements.loadingText) elements.loadingText.textContent = text;
      if (elements.loadingProgress) elements.loadingProgress.style.width = `${progress}%`;
      if (elements.loadingScreen) elements.loadingScreen.classList.remove('hidden');
    },

    hideLoading() {
      if (elements.loadingScreen) elements.loadingScreen.classList.add('hidden');
      if (elements.gameContainer) elements.gameContainer.classList.remove('hidden');
    }
  };

  // ==================== 遊戲邏輯函數 ====================
  function appendToLog(text, className = '') {
    if (!elements.log || !text) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `log-message ${className}`;
    
    // 處理特殊格式和表情符號
    const formattedText = text
      .replace(/【([^】]+)】/g, '<span class="log-title">【$1】</span>')
      .replace(/■ ([^\n]+)/g, '<span class="log-bullet">■ $1</span>')
      .replace(/(🔍|💡|❓|✅|❌|🎭|🏠|📊|🔑|👻|🎃)/g, '<span class="log-emoji">$1</span>');
    
    messageDiv.innerHTML = formattedText;
    elements.log.appendChild(messageDiv);
    
    // 滾動到底部
    utils.safeElementOperation(elements.log, 'scrollTo', {
      top: elements.log.scrollHeight,
      behavior: 'smooth'
    });
    
    // 限制日誌條目數量
    const maxLogEntries = 100;
    while (elements.log.children.length > maxLogEntries) {
      elements.log.removeChild(elements.log.firstChild);
    }
  }

  function processCommand(cmd) {
    if (!storyData?.globals || !cmd) return;
    
    const globalCmd = storyData.globals[cmd];
    if (!globalCmd) {
      handleUserInput(cmd.replace('/', ''));
      return;
    }
    
    // 檢查指令條件
    if (globalCmd.condition && !evaluateCondition(globalCmd.condition)) {
      appendToLog('此指令暫時無法使用', 'warning-message');
      return;
    }
    
    // 處理全域指令
    let response = globalCmd.response || globalCmd.response_template || '';
    
    // 替換模板變數
    const variables = getTemplateVariables();
    response = utils.formatText(response, variables);
    
    if (response) {
      appendToLog(response, 'system-message');
    }
    
    // 執行動作
    if (globalCmd.action) {
      executeAction(globalCmd.action);
    }
    
    // 播放對應音效
    playCommandSound(cmd);
  }

  function getTemplateVariables() {
    const currentLevelData = ui.getCurrentLevelData();
    const maxHints = storyData?.game_config?.max_hints || GAME_CONSTANTS.MAX_HINTS;
    const playTime = gameState.startTime ? Math.floor((Date.now() - gameState.startTime) / 1000) : 0;
    
    return {
      current_level_hint: getCurrentLevelHint(),
      hint_number: gameState.hintCount + 1,
      max_hints: maxHints,
      remaining_hints: Math.max(0, maxHints - gameState.hintCount),
      level_name: currentLevelData?.name || '未知位置',
      flags_display: gameState.flags.join(', ') || '無',
      time_elapsed: utils.formatTime(playTime),
      accuracy_percentage: utils.calculateAccuracy(),
      total_score: gameState.score
    };
  }

  function evaluateCondition(condition) {
    try {
      // 簡單的條件評估
      if (condition.includes('hint_count < max_hints')) {
        const maxHints = storyData?.game_config?.max_hints || GAME_CONSTANTS.MAX_HINTS;
        return gameState.hintCount < maxHints;
      }
      return true;
    } catch (error) {
      console.warn('條件評估失敗:', error);
      return false;
    }
  }

  function playCommandSound(cmd) {
    const soundMap = {
      '/start': 'thunder',
      '/hint': 'success',
      '/save': 'success',
      '/load': 'success'
    };
    
    const soundId = soundMap[cmd];
    if (soundId) {
      audioManager.play(soundId, cmd === '/start' ? 80 : 50);
    }
    
    if (cmd === '/start') {
      setTimeout(() => audioManager.playMusic(), 1000);
    }
  }

  function executeAction(action) {
    const actions = {
      'reset_game_state': resetGameState,
      'increment_hint_count': () => {
        gameState.hintCount++;
        ui.updateStatus();
      },
      'save_game_state': saveGame,
      'load_game_state': loadGame
    };
    
    const actionFunction = actions[action];
    if (actionFunction) {
      actionFunction();
    } else {
      console.warn(`未知動作: ${action}`);
    }
  }

  function handleUserInput(text) {
    if (!text?.trim()) return;
    
    const normalizedText = text.trim();
    
    if (!storyData || gameState.level === 0) {
      appendToLog('請先輸入 /start 開始遊戲', 'error-message');
      return;
    }
    
    const currentLevelData = ui.getCurrentLevelData();
    if (!currentLevelData) {
      appendToLog('遊戲數據錯誤，請重新開始', 'error-message');
      return;
    }
    
    // 按優先順序處理輸入
    if (processBranches(currentLevelData, normalizedText) ||
        processAnswers(currentLevelData, normalizedText) ||
        processWrongResponses(currentLevelData, normalizedText)) {
      return;
    }
    
    // 預設錯誤回應
    const defaultWrong = currentLevelData.default_wrong || '請重新思考，或使用 /hint 獲取提示。';
    appendToLog(defaultWrong, 'error-message');
    gameState.wrongAttempts++;
    audioManager.play('error');
  }

  function processBranches(levelData, text) {
    if (!levelData.branches) return false;
    
    for (const branch of levelData.branches) {
      const triggers = Array.isArray(branch.trigger) ? branch.trigger : [branch.trigger];
      
      if (triggers.some(trigger => text.toLowerCase().includes(trigger.toLowerCase()))) {
        // 檢查所需線索
        if (!utils.checkRequiredFlags(branch.requires_flags)) {
          appendToLog('你需要更多線索才能進行這個調查...', 'warning-message');
          return true;
        }
        
        // 執行分支
        appendToLog(branch.response, 'branch-message');
        
        if (branch.flag && !gameState.flags.includes(branch.flag)) {
          addClue(branch.flag, branch.score_bonus || 50);
        }
        
        return true;
      }
    }
    
    return false;
  }

  function processAnswers(levelData, text) {
    if (!levelData.answers) return false;
    
    for (const answer of levelData.answers) {
      const values = Array.isArray(answer.values) ? answer.values : [answer.values];
      
      if (values.some(value => text.toLowerCase() === value.toLowerCase())) {
        // 檢查所需線索
        if (!utils.checkRequiredFlags(answer.requires_flags)) {
          appendToLog('你還沒有足夠的線索來支持這個推理...', 'warning-message');
          return true;
        }
        
        // 正確答案
        processCorrectAnswer(answer);
        return true;
      }
    }
    
    return false;
  }

  function processWrongResponses(levelData, text) {
    if (!levelData.wrong_responses) return false;
    
    for (const wrongResponse of levelData.wrong_responses) {
      const values = Array.isArray(wrongResponse.values) ? wrongResponse.values : [wrongResponse.values];
      
      if (values.some(value => text.toLowerCase() === value.toLowerCase())) {
        appendToLog(wrongResponse.response, 'error-message');
        gameState.wrongAttempts++;
        audioManager.play('error');
        return true;
      }
    }
    
    return false;
  }

  function processCorrectAnswer(answer) {
    appendToLog(answer.response, 'success-message');
    
    // 更新遊戲狀態
    if (answer.flag && !gameState.flags.includes(answer.flag)) {
      addClue(answer.flag);
    }
    
    if (answer.score_bonus) {
      gameState.score += answer.score_bonus;
    }
    
    if (answer.next_level) {
      advanceToNextLevel(answer.next_level);
    }
    
    // 檢查是否到達結局
    if (answer.ending || answer.next_state) {
      handleEnding(answer.ending || answer.next_state);
    }
    
    ui.updateStatus();
    ui.updateCluesList();
    audioManager.play('success');
    checkAchievements();
  }

  function addClue(flag, scoreBonus = 50) {
    if (!gameState.flags.includes(flag)) {
      gameState.flags.push(flag);
      gameState.score += scoreBonus;
      
      const clueName = GAME_CONSTANTS.CLUE_NAMES[flag] || '未知線索';
      appendToLog(`🔍 獲得線索${flag}：${clueName}`, 'clue-message');
    }
  }

  function advanceToNextLevel(nextLevel) {
    gameState.level = nextLevel;
    
    // 延遲顯示新關卡提示
    setTimeout(() => {
      const nextLevelData = storyData.levels?.find(l => l.id === nextLevel);
      if (nextLevelData?.prompt) {
        appendToLog(nextLevelData.prompt, 'level-prompt');
      }
    }, 1000);
  }

  function getCurrentLevelHint() {
    const currentLevelData = ui.getCurrentLevelData();
    if (!currentLevelData?.hints) return '暫無提示';
    
    const hintIndex = Math.min(gameState.hintCount, currentLevelData.hints.length - 1);
    return currentLevelData.hints[hintIndex] || '暫無提示';
  }

  function handleEnding(endingType) {
    gameState.isGameCompleted = true;
    gameState.currentEnding = endingType;
    
    const ending = storyData.endings?.[endingType];
    if (ending) {
      appendToLog(ending.description || ending.title, 'ending-message');
    }
    
    // 計算最終分數
    const finalScore = gameState.score + (ending?.score_bonus || 0);
    const accuracy = utils.calculateAccuracy();
    const playTime = gameState.startTime ? Math.floor((Date.now() - gameState.startTime) / 1000) : 0;
    
    setTimeout(() => {
      showFinalScore(finalScore, accuracy, playTime);
    }, 2000);
    
    // 保存最高分
    updateHighScore(finalScore);
  }

  function showFinalScore(finalScore, accuracy, playTime) {
    const scoreText = `
      🎊 遊戲結束！
      📊 最終統計：
      • 總分：${finalScore}
      • 準確度：${accuracy}%
      • 遊戲時間：${utils.formatTime(playTime)}
      • 收集線索：${gameState.flags.length}/4
      • 結局類型：${gameState.currentEnding || '未知'}
      
      感謝遊玩！輸入 /start 重新開始
    `;
    
    appendToLog(scoreText, 'final-score');
  }

  function updateHighScore(finalScore) {
    const highScore = utils.loadFromStorage(GAME_CONSTANTS.HIGH_SCORE_KEY) || 0;
    if (finalScore > highScore) {
      utils.saveToStorage(GAME_CONSTANTS.HIGH_SCORE_KEY, finalScore);
      ui.showAchievement('新紀錄！', `創造了 ${finalScore} 分的新高分！`);
    }
  }

  function checkAchievements() {
    if (!storyData.achievements) return;
    
    const achievementCheckers = {
      'flags_count >= 1': () => gameState.flags.length >= 1,
      'hint_count == 0 && game_completed': () => gameState.hintCount === 0 && gameState.isGameCompleted,
      'flags_count == 4 && ending == "perfect_ending"': () => 
        gameState.flags.length === 4 && gameState.currentEnding === 'perfect_ending'
    };
    
    for (const achievement of storyData.achievements) {
      if (gameState.achievements.includes(achievement.id)) continue;
      
      const checker = achievementCheckers[achievement.condition];
      if (checker && checker()) {
        gameState.achievements.push(achievement.id);
        ui.showAchievement(achievement.name, achievement.description);
        audioManager.play('success');
      }
    }
  }

  // ==================== 遊戲存檔系統 ====================
  function saveGame() {
    const saveData = {
      ...utils.deepClone(gameState),
      timestamp: Date.now(),
      version: 2.0
    };
    
    if (utils.saveToStorage(GAME_CONSTANTS.SAVE_KEY, saveData)) {
      appendToLog('💾 遊戲已保存！', 'system-message');
      audioManager.play('success', 30);
    } else {
      appendToLog('❌ 保存失敗，請檢查瀏覽器設定', 'error-message');
    }
  }

  function loadGame() {
    const saveData = utils.loadFromStorage(GAME_CONSTANTS.SAVE_KEY);
    
    if (!saveData) {
      appendToLog('❌ 沒有找到存檔', 'error-message');
      return;
    }
    
    // 檢查存檔版本兼容性
    if (saveData.version && saveData.version < 2.0) {
      appendToLog('❌ 存檔版本過舊，請重新開始遊戲', 'error-message');
      return;
    }
    
    // 恢復遊戲狀態
    Object.assign(gameState, saveData);
    ui.updateStatus();
    ui.updateCluesList();
    
    // 顯示當前關卡
    const currentLevelData = ui.getCurrentLevelData();
    if (currentLevelData) {
      appendToLog('📂 遊戲已載入！', 'system-message');
      if (currentLevelData.prompt) {
        appendToLog(currentLevelData.prompt, 'level-prompt');
      }
    }
    
    audioManager.play('success', 30);
  }

  function resetGameState() {
    const oldSettings = utils.deepClone(gameState.settings);
    
    gameState = {
      level: 0,
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
    
    if (elements.log) {
      elements.log.innerHTML = '';
    }
  }

  // ==================== 載入系統 ====================
  async function loadGameData() {
    try {
      ui.showLoading('載入遊戲數據...', 20);
      
      const response = await fetchWithRetry('scripts/story.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      storyData = await response.json();
      ui.showLoading('驗證遊戲數據...', 60);
      
      // 驗證數據完整性
      if (!validateGameData(storyData)) {
        throw new Error('遊戲數據格式錯誤');
      }
      
      ui.showLoading('初始化遊戲系統...', 80);
      
      // 載入設定
      loadSettings();
      
      ui.showLoading('準備完成...', 100);
      
      setTimeout(() => {
        ui.hideLoading();
        isGameLoaded = true;
        appendToLog('🎃 歡迎來到萬聖夜驚變！輸入 /start 開始遊戲', 'welcome-message');
      }, 500);
      
    } catch (error) {
      console.error('載入失敗:', error);
      handleLoadError(error);
    }
  }

  async function fetchWithRetry(url, maxRetries = MAX_RETRY_COUNT) {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) return response;
        
        if (i === maxRetries) throw new Error(`載入失敗，已重試 ${maxRetries} 次`);
        
        // 等待後重試
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } catch (error) {
        if (i === maxRetries) throw error;
      }
    }
  }

  function validateGameData(data) {
    const requiredFields = ['globals', 'levels', 'game_config'];
    return requiredFields.every(field => data && data[field]);
  }

  function handleLoadError(error) {
    const errorMessage = error.message || '未知錯誤';
    ui.showLoading(`載入失敗: ${errorMessage}`, 0);
    
    if (elements.loadingProgress) {
      elements.loadingProgress.style.backgroundColor = '#ff4444';
    }
    
    // 提供重試選項
    setTimeout(() => {
      if (loadRetryCount < MAX_RETRY_COUNT) {
        loadRetryCount++;
        ui.showLoading(`重試中... (${loadRetryCount}/${MAX_RETRY_COUNT})`, 10);
        setTimeout(() => loadGameData(), 2000);
      } else {
        ui.showLoading('載入失敗，請重新整理頁面', 0);
      }
    }, 3000);
  }

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

  // ==================== 事件監聽器 ====================
  function setupEventListeners() {
    // 主要輸入事件
    setupInputEvents();
    
    // 快速按鈕事件
    setupQuickButtonEvents();
    
    // 設定面板事件
    setupSettingsEvents();
    
    // 其他UI事件
    setupUIEvents();
    
    // 全域事件
    setupGlobalEvents();
  }

  function setupInputEvents() {
    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', handleSendClick);
    }
    
    if (elements.input) {
      elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendClick();
        }
      });
      
      // 輸入建議
      elements.input.addEventListener('input', utils.debounce((e) => {
        const value = e.target.value.toLowerCase().trim();
        if (value.length < 2) {
          ui.hideSuggestions();
          return;
        }
        
        const suggestions = getSuggestions(value);
        ui.showSuggestions(suggestions);
      }, 300));
      
      elements.input.addEventListener('blur', () => {
        setTimeout(() => ui.hideSuggestions(), 200);
      });
    }
  }

  function setupQuickButtonEvents() {
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
  }

  function setupSettingsEvents() {
    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', () => {
        elements.settingsPanel?.classList.remove('hidden');
      });
    }
    
    if (elements.closeSettings) {
      elements.closeSettings.addEventListener('click', () => {
        elements.settingsPanel?.classList.add('hidden');
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
      elements.volumeSlider.addEventListener('input', utils.throttle((e) => {
        const volume = parseInt(e.target.value);
        audioManager.setVolume(volume);
        if (elements.volumeValue) {
          elements.volumeValue.textContent = volume;
        }
        saveSettings();
      }, 100));
    }
    
    if (elements.difficultySelect) {
      elements.difficultySelect.addEventListener('change', (e) => {
        gameState.settings.difficulty = e.target.value;
        saveSettings();
      });
    }
    
    if (elements.resetGame) {
      elements.resetGame.addEventListener('click', () => {
        ui.showConfirmDialog(
          '重置遊戲',
          '確定要重置所有遊戲進度嗎？此操作無法復原。',
          () => {
            resetGameState();
            appendToLog('🔄 遊戲已重置', 'system-message');
          }
        );
      });
    }
  }

  function setupUIEvents() {
    // 全螢幕按鈕
    if (elements.fullscreenBtn) {
      elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    // 輸入建議點擊
    if (elements.inputSuggestions) {
      elements.inputSuggestions.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
          const command = suggestionItem.dataset.command;
          if (elements.input) {
            elements.input.value = command;
            elements.input.focus();
          }
          ui.hideSuggestions();
        }
      });
    }
  }

  function setupGlobalEvents() {
    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        elements.settingsPanel?.classList.add('hidden');
        ui.hideConfirmDialog();
        ui.hideSuggestions();
      }
    });
    
    // 頁面可見性變化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        audioManager.fadeOut();
      } else if (gameState.settings.musicEnabled && isGameLoaded) {
        audioManager.playMusic();
      }
    });
  }

  function handleSendClick() {
    if (!isGameLoaded || !elements.input) return;
    
    const text = elements.input.value.trim();
    if (!text) return;
    
    appendToLog(`> ${text}`, 'user-input');
    
    if (text.startsWith('/')) {
      processCommand(text);
    } else {
      handleUserInput(text);
    }
    
    elements.input.value = '';
    ui.hideSuggestions();
  }

  function getSuggestions(input) {
    const suggestions = [
      { command: '/start', icon: '🎭', text: '開始遊戲' },
      { command: '/hint', icon: '💡', text: '獲取提示' },
      { command: '/status', icon: '📊', text: '查看狀態' },
      { command: '檢查', icon: '🔍', text: '檢查物品' },
      { command: '調查', icon: '🕵️', text: '深入調查' },
      { command: '分析', icon: '🧠', text: '分析線索' }
    ];
    
    return suggestions.filter(s => 
      s.command.toLowerCase().includes(input) || 
      s.text.toLowerCase().includes(input)
    ).slice(0, 5);
  }

  function saveSettings() {
    utils.saveToStorage(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('無法進入全螢幕模式:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // ==================== 初始化 ====================
  async function init() {
    console.log('🎃 萬聖夜驚變：化裝舞會謎案 - 載入中...');
    
    try {
      // 設定事件監聽器
      setupEventListeners();
      
      // 載入遊戲數據
      await loadGameData();
      
      // 初始化遊戲狀態
      gameState.startTime = Date.now();
      
      console.log('✅ 遊戲初始化完成');
    } catch (error) {
      console.error('初始化失敗:', error);
      handleLoadError(error);
    }
  }

  // 頁面載入完成後初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 頁面卸載時保存設定
  window.addEventListener('beforeunload', () => {
    saveSettings();
    if (currentAudio) {
      audioManager.stopMusic();
    }
  });

})();
