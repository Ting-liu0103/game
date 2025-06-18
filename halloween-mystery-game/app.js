// ===== app.js =====
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
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || match;
      });
    },

    // 安全的本地存儲
    saveToStorage(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('存儲失敗:', error);
        return false;
      }
    },

    loadFromStorage(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('讀取失敗:', error);
        return null;
      }
    },

    // 防抖函數
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // 格式化時間
    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // 計算準確度
    calculateAccuracy() {
      const totalAttempts = gameState.wrongAttempts + getCurrentLevel();
      return totalAttempts > 0 ? Math.round(((getCurrentLevel()) / totalAttempts) * 100) : 100;
    }
  };

  // ==================== 音效系統 ====================
  const audioManager = {
    play(soundId, volume = null) {
      if (!gameState.settings.soundEnabled) return;
      
      const audio = elements[soundId + 'Sound'];
      if (!audio) return;
      
      audio.volume = (volume || gameState.settings.volume) / 100;
      audio.currentTime = 0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('音效播放失敗:', error);
        });
      }
    },

    playMusic(loop = true) {
      if (!gameState.settings.musicEnabled) return;
      
      if (currentAudio) {
        currentAudio.pause();
      }
      
      currentAudio = elements.ambientSound;
      currentAudio.loop = loop;
      currentAudio.volume = gameState.settings.volume / 100 * 0.3; // 背景音樂較小聲
      
      const playPromise = currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('背景音樂播放失敗:', error);
        });
      }
    },

    stopMusic() {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    },

    setVolume(volume) {
      gameState.settings.volume = volume;
      if (currentAudio) {
        currentAudio.volume = volume / 100 * 0.3;
      }
    }
  };

  // ==================== UI 更新函數 ====================
  const ui = {
    // 更新遊戲狀態顯示
    updateStatus() {
      const currentLevel = getCurrentLevel();
      const levelData = storyData?.levels?.find(l => l.id === gameState.level);
      
      if (elements.currentLocation) {
        elements.currentLocation.textContent = levelData?.name || '準備開始';
      }
      
      if (elements.cluesCount) {
        elements.cluesCount.textContent = `線索: ${gameState.flags.length}/4`;
      }
      
      if (elements.hintsRemaining) {
        const maxHints = storyData?.game_config?.max_hints || 3;
        elements.hintsRemaining.textContent = `提示: ${maxHints - gameState.hintCount}/${maxHints}`;
      }
      
      if (elements.scoreDisplay) {
        elements.scoreDisplay.textContent = `分數: ${gameState.score}`;
      }
      
      // 更新進度條
      if (elements.progressFill && elements.progressCurrent) {
        const totalLevels = storyData?.levels?.length || 7;
        const progress = (currentLevel / totalLevels) * 100;
        elements.progressFill.style.width = `${progress}%`;
        elements.progressCurrent.textContent = currentLevel;
        elements.progressTotal.textContent = totalLevels;
      }
    },

    // 更新線索列表
    updateCluesList() {
      if (!elements.cluesList) return;
      
      if (gameState.flags.length === 0) {
        elements.cluesList.innerHTML = '<div class="no-clues">尚未發現線索...</div>';
        return;
      }
      
      const clueNames = {
        'A': '但丁密文',
        'B': '黏土腳印樣本',
        'C': '夜行者披風',
        'D': '血漬地圖'
      };
      
      elements.cluesList.innerHTML = gameState.flags
        .map(flag => `
          <div class="clue-item">
            <span class="clue-icon">🔍</span>
            <span class="clue-name">線索${flag}: ${clueNames[flag] || '未知線索'}</span>
          </div>
        `).join('');
    },

    // 顯示輸入建議
    showSuggestions(suggestions) {
      if (!elements.inputSuggestions) return;
      
      if (suggestions.length === 0) {
        elements.inputSuggestions.classList.add('hidden');
        return;
      }
      
      elements.inputSuggestions.innerHTML = suggestions
        .map(suggestion => `
          <div class="suggestion-item" data-command="${suggestion.command}">
            ${suggestion.icon} ${suggestion.text}
          </div>
        `).join('');
      
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
      
      // 3秒後自動隱藏
      setTimeout(() => {
        elements.achievementNotification.classList.add('hidden');
      }, 3000);
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
      
      // 清除之前的事件監聽器
      const newYesBtn = yesBtn.cloneNode(true);
      const newNoBtn = noBtn.cloneNode(true);
      yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
      noBtn.parentNode.replaceChild(newNoBtn, noBtn);
      
      // 添加新的事件監聽器
      newYesBtn.addEventListener('click', () => {
        elements.confirmDialog.classList.add('hidden');
        if (onConfirm) onConfirm();
      });
      
      newNoBtn.addEventListener('click', () => {
        elements.confirmDialog.classList.add('hidden');
        if (onCancel) onCancel();
      });
      
      elements.confirmDialog.classList.remove('hidden');
    }
  };

  // ==================== 遊戲邏輯函數 ====================
  function getCurrentLevel() {
    return gameState.level;
  }

  function appendToLog(text, className = '') {
    if (!elements.log) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `log-message ${className}`;
    
    // 處理特殊格式
    const formattedText = text
      .replace(/【([^】]+)】/g, '<span class="log-title">【$1】</span>')
      .replace(/■ ([^\n]+)/g, '<span class="log-bullet">■ $1</span>')
      .replace(/🔍|💡|❓|✅|❌|🎭|🏠|📊|🔑|👻|🎃/g, '<span class="log-emoji">$&</span>');
    
    messageDiv.innerHTML = formattedText;
    elements.log.appendChild(messageDiv);
    
    // 滾動到底部
    elements.log.scrollTop = elements.log.scrollHeight;
    
    // 添加打字機效果（可選）
    if (className.includes('typing')) {
      messageDiv.style.opacity = '0';
      setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transition = 'opacity 0.5s ease-in';
      }, 100);
    }
  }

  function processCommand(cmd) {
    if (!storyData || !storyData.globals) return;
    
    const globalCmd = storyData.globals[cmd];
    if (!globalCmd) {
      handleUserInput(cmd.replace('/', ''));
      return;
    }
    
    // 處理全域指令
    let response = globalCmd.response || globalCmd.response_template || '';
    
    // 替換模板變數
    const variables = {
      current_level_hint: getCurrentLevelHint(),
      hint_number: gameState.hintCount + 1,
      max_hints: storyData.game_config?.max_hints || 3,
      remaining_hints: Math.max(0, (storyData.game_config?.max_hints || 3) - gameState.hintCount),
      level_name: getCurrentLevelName(),
      flags_display: gameState.flags.join(', ') || '無',
      time_elapsed: utils.formatTime(Math.floor((Date.now() - gameState.startTime) / 1000)),
      accuracy_percentage: utils.calculateAccuracy(),
      total_score: gameState.score
    };
    
    response = utils.formatText(response, variables);
    appendToLog(response, 'system-message');
    
    // 執行動作
    if (globalCmd.action) {
      executeAction(globalCmd.action);
    }
    
    // 播放對應音效
    if (cmd === '/start') {
      audioManager.play('thunder');
      audioManager.playMusic();
    } else if (cmd === '/hint') {
      audioManager.play('success', 50);
    }
  }

  function executeAction(action) {
    switch (action) {
      case 'reset_game_state':
        resetGameState();
        break;
      case 'increment_hint_count':
        gameState.hintCount++;
        ui.updateStatus();
        break;
      case 'save_game_state':
        saveGame();
        break;
      case 'load_game_state':
        loadGame();
        break;
    }
  }

  function handleUserInput(text) {
    if (!storyData || gameState.level === 0) {
      appendToLog('請先輸入 /start 開始遊戲', 'error-message');
      return;
    }
    
    const currentLevelData = storyData.levels.find(l => l.id === gameState.level);
    if (!currentLevelData) {
      appendToLog('遊戲數據錯誤，請重新開始', 'error-message');
      return;
    }
    
    // 檢查分支觸發
    if (currentLevelData.branches) {
      for (const branch of currentLevelData.branches) {
        const triggers = Array.isArray(branch.trigger) ? branch.trigger : [branch.trigger];
        
        if (triggers.some(trigger => text.toLowerCase().includes(trigger.toLowerCase()))) {
          // 檢查所需線索
          if (branch.requires_flags && !branch.requires_flags.every(flag => gameState.flags.includes(flag))) {
            appendToLog('你需要更多線索才能進行這個調查...', 'warning-message');
            return;
          }
          
          // 執行分支
          appendToLog(branch.response, 'branch-message');
          
          if (branch.flag && !gameState.flags.includes(branch.flag)) {
            gameState.flags.push(branch.flag);
            gameState.score += branch.score_bonus || 50;
            ui.updateStatus();
            ui.updateCluesList();
            audioManager.play('success');
            
            // 檢查成就
            checkAchievements();
          }
          
          return;
        }
      }
    }
    
    // 檢查答案
    if (currentLevelData.answers) {
      for (const answer of currentLevelData.answers) {
        const values = Array.isArray(answer.values) ? answer.values : [answer.values];
        
        if (values.some(value => text.toLowerCase() === value.toLowerCase())) {
          // 檢查所需線索
          if (answer.requires_flags && !answer.requires_flags.every(flag => gameState.flags.includes(flag))) {
            appendToLog('你還沒有足夠的線索來支持這個推理...', 'warning-message');
            return;
          }
          
          // 正確答案
          appendToLog(answer.response, 'success-message');
          
          // 更新遊戲狀態
          if (answer.flag && !gameState.flags.includes(answer.flag)) {
            gameState.flags.push(answer.flag);
          }
          
          if (answer.score_bonus) {
            gameState.score += answer.score_bonus;
          }
          
          if (answer.next_level) {
            gameState.level = answer.next_level;
            
            // 顯示新關卡提示
            setTimeout(() => {
              const nextLevelData = storyData.levels.find(l => l.id === answer.next_level);
              if (nextLevelData) {
                appendToLog(nextLevelData.prompt, 'level-prompt');
              }
            }, 1000);
          }
          
          // 檢查是否到達結局
          if (answer.ending || answer.next_state) {
            handleEnding(answer.ending || answer.next_state);
          }
          
          ui.updateStatus();
          ui.updateCluesList();
          audioManager.play('success');
          checkAchievements();
          
          return;
        }
      }
    }
    
    // 檢查特定錯誤回應
    if (currentLevelData.wrong_responses) {
      for (const wrongResponse of currentLevelData.wrong_responses) {
        const values = Array.isArray(wrongResponse.values) ? wrongResponse.values : [wrongResponse.values];
        
        if (values.some(value => text.toLowerCase() === value.toLowerCase())) {
          appendToLog(wrongResponse.response, 'error-message');
          gameState.wrongAttempts++;
          audioManager.play('error');
          return;
        }
      }
    }
    
    // 預設錯誤回應
    const defaultWrong = currentLevelData.default_wrong || currentLevelData.wrong?.response || '請重新思考，或使用 /hint 獲取提示。';
    appendToLog(defaultWrong, 'error-message');
    gameState.wrongAttempts++;
    audioManager.play('error');
  }

  function getCurrentLevelHint() {
    const currentLevelData = storyData.levels.find(l => l.id === gameState.level);
    if (!currentLevelData || !currentLevelData.hints) return '暫無提示';
    
    const hintIndex = Math.min(gameState.hintCount, currentLevelData.hints.length - 1);
    return currentLevelData.hints[hintIndex];
  }

  function getCurrentLevelName() {
    const currentLevelData = storyData.levels.find(l => l.id === gameState.level);
    return currentLevelData?.name || '未知位置';
  }

  function handleEnding(endingType) {
    const ending = storyData.endings?.[endingType];
    if (!ending) return;
    
    appendToLog(ending.description || ending.title, 'ending-message');
    
    // 計算最終分數
    const finalScore = gameState.score + (ending.score_bonus || 0);
    const accuracy = utils.calculateAccuracy();
    const playTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    
    setTimeout(() => {
      appendToLog(`
        🎊 遊戲結束！
        📊 最終統計：
        • 總分：${finalScore}
        • 準確度：${accuracy}%
        • 遊戲時間：${utils.formatTime(playTime)}
        • 收集線索：${gameState.flags.length}/4
        
        感謝遊玩！輸入 /start 重新開始
      `, 'final-score');
    }, 2000);
    
    // 保存最高分
    const highScore = utils.loadFromStorage('halloween_high_score') || 0;
    if (finalScore > highScore) {
      utils.saveToStorage('halloween_high_score', finalScore);
      ui.showAchievement('新紀錄！', `創造了 ${finalScore} 分的新高分！`);
    }
  }

  function checkAchievements() {
    if (!storyData.achievements) return;
    
    for (const achievement of storyData.achievements) {
      if (gameState.achievements.includes(achievement.id)) continue;
      
      let unlocked = false;
      
      switch (achievement.condition) {
        case 'flags_count >= 1':
          unlocked = gameState.flags.length >= 1;
          break;
        case 'hint_count == 0 && game_completed':
          unlocked = gameState.hintCount === 0 && gameState.level >= 7;
          break;
        case 'flags_count == 4 && ending == "perfect_ending"':
          unlocked = gameState.flags.length === 4;
          break;
      }
      
      if (unlocked) {
        gameState.achievements.push(achievement.id);
        ui.showAchievement(achievement.name, achievement.description);
        audioManager.play('success');
      }
    }
  }

  // ==================== 遊戲存檔系統 ====================
  function saveGame() {
    const saveData = {
      ...gameState,
      timestamp: Date.now()
    };
    
    if (utils.saveToStorage('halloween_save', saveData)) {
      appendToLog('💾 遊戲已保存！', 'system-message');
      audioManager.play('success', 30);
    } else {
      appendToLog('❌ 保存失敗，請檢查瀏覽器設定', 'error-message');
    }
  }

  function loadGame() {
    const saveData = utils.loadFromStorage('halloween_save');
    
    if (!saveData) {
      appendToLog('❌ 沒有找到存檔', 'error-message');
      return;
    }
    
    gameState = { ...saveData };
    ui.updateStatus();
    ui.updateCluesList();
    
    // 顯示當前關卡
    const currentLevelData = storyData.levels.find(l => l.id === gameState.level);
    if (currentLevelData) {
      appendToLog('📂 遊戲已載入！', 'system-message');
      appendToLog(currentLevelData.prompt, 'level-prompt');
    }
    
    audioManager.play('success', 30);
  }

  function resetGameState() {
    gameState = {
      level: 0,
      flags: [],
      hintCount: 0,
      score: 0,
      wrongAttempts: 0,
      startTime: Date.now(),
      achievements: [],
      settings: gameState.settings // 保留設定
    };
    
    ui.updateStatus();
    ui.updateCluesList();
    elements.log.innerHTML = '';
  }

  // ==================== 載入系統 ====================
  async function loadGameData() {
    try {
      elements.loadingText.textContent = '載入遊戲數據...';
      elements.loadingProgress.style.width = '20%';
      
      const response = await fetch('scripts/story.json');
      if (!response.ok) throw new Error('無法載入遊戲數據');
      
      storyData = await response.json();
      elements.loadingProgress.style.width = '60%';
      
      elements.loadingText.textContent = '初始化遊戲系統...';
      
      // 載入設定
      const savedSettings = utils.loadFromStorage('halloween_settings');
      if (savedSettings) {
        gameState.settings = { ...gameState.settings, ...savedSettings };
      }
      
      elements.loadingProgress.style.width = '80%';
      elements.loadingText.textContent = '準備完成...';
      
      // 應用設定
      applySettings();
      
      elements.loadingProgress.style.width = '100%';
      
      setTimeout(() => {
        elements.loadingScreen.classList.add('hidden');
        elements.gameContainer.classList.remove('hidden');
        isGameLoaded = true;
        
        // 自動開始遊戲或顯示歡迎訊息
        appendToLog('🎃 歡迎來到萬聖夜驚變！輸入 /start 開始遊戲', 'welcome-message');
      }, 500);
      
    } catch (error) {
      console.error('載入失敗:', error);
      elements.loadingText.textContent = '載入失敗，請重新整理頁面';
      elements.loadingProgress.style.backgroundColor = '#ff4444';
    }
  }

  function applySettings() {
    if (elements.soundToggle) elements.soundToggle.checked = gameState.settings.soundEnabled;
    if (elements.musicToggle) elements.musicToggle.checked = gameState.settings.musicEnabled;
    if (elements.volumeSlider) elements.volumeSlider.value = gameState.settings.volume;
    if (elements.volumeValue) elements.volumeValue.textContent = gameState.settings.volume;
    if (elements.difficultySelect) elements.difficultySelect.value = gameState.settings.difficulty;
  }

  // ==================== 事件監聽器 ====================
  function setupEventListeners() {
    // 主要輸入
    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', handleSendClick);
    }
    
    if (elements.input) {
      elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSendClick();
        }
      });
      
      // 輸入建議
      elements.input.addEventListener('input', utils.debounce((e) => {
        const value = e.target.value.toLowerCase();
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
    
    // 快速按鈕
    if (elements.hintBtn) {
      elements.hintBtn.addEventListener('click', () => processCommand('/hint'));
    }
    
    if (elements.statusBtn) {
      elements.statusBtn.addEventListener('click', () => processCommand('/status'));
    }
    
    if (elements.saveBtn) {
      elements.saveBtn.addEventListener('click', () => processCommand('/save'));
    }
    
    if (elements.loadBtn) {
      elements.loadBtn.addEventListener('click', () => processCommand('/load'));
    }
    
    // 設定面板
    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', () => {
        elements.settingsPanel.classList.remove('hidden');
      });
    }
    
    if (elements.closeSettings) {
      elements.closeSettings.addEventListener('click', () => {
        elements.settingsPanel.classList.add('hidden');
      });
    }
    
    // 設定控制
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
        gameState.settings.volume = volume;
        elements.volumeValue.textContent = volume;
        audioManager.setVolume(volume);
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
          elements.input.value = command;
          ui.hideSuggestions();
          elements.input.focus();
        }
      });
    }
    
    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        elements.settingsPanel.classList.add('hidden');
        elements.confirmDialog.classList.add('hidden');
        ui.hideSuggestions();
      }
    });
  }

  function handleSendClick() {
    if (!isGameLoaded) return;
    
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
    utils.saveToStorage('halloween_settings', gameState.settings);
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
    
    // 設定事件監聽器
    setupEventListeners();
    
    // 載入遊戲數據
    await loadGameData();
    
    // 初始化遊戲狀態
    gameState.startTime = Date.now();
    
    console.log('✅ 遊戲初始化完成');
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
  });

})();
