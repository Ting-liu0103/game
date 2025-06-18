// ===== app.js (完整修正版) =====
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

  // 修正後的常量定義 - 移除 MAX_HINTS 冗餘
  const GAME_CONSTANTS = {
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

  // 新增獲取最大提示數的函數
  const getMaxHints = () => {
    return storyData?.game_config?.max_hints || 3;
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
    errorSound: document.getElementById('error-sound'),
    achievementsList: document.getElementById('achievements-list')
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

  // 成就系統
  const achievementSystem = {
    // 安全的條件解析器
    evaluateCondition(conditionString, gameContext) {
      if (!conditionString || typeof conditionString !== 'string') {
        return false;
      }

      try {
        // 創建安全的評估環境
        const safeContext = this.createSafeContext(gameContext);
        
        // 使用 Function 構造器而非 eval，提高安全性
        const evaluator = new Function('context', `
          with (context) {
            try {
              return !!(${conditionString});
            } catch (e) {
              console.warn('條件評估錯誤:', e.message);
              return false;
            }
          }
        `);

        return evaluator(safeContext);
      } catch (error) {
        console.error('成就條件解析失敗:', error);
        return false;
      }
    },

    // 創建安全的評估上下文
    createSafeContext(gameContext) {
      return {
        flags_count: gameContext.flags?.length || 0,
        hint_count: gameContext.hintCount || 0,
        game_completed: gameContext.isGameCompleted || false,
        ending: gameContext.currentEnding || null,
        ultimate_truth_discovered: gameContext.achievements?.includes('truth_master') || false,
        level: gameContext.level || 0,
        score: gameContext.score || 0,
        wrong_attempts: gameContext.wrongAttempts || 0
      };
    },

    // 檢查並解鎖成就
    checkAchievements() {
      if (!storyData?.achievements) return;

      const gameContext = {
        flags: gameState.flags,
        hintCount: gameState.hintCount,
        isGameCompleted: gameState.isGameCompleted,
        currentEnding: gameState.currentEnding,
        achievements: gameState.achievements,
        level: gameState.level,
        score: gameState.score,
        wrongAttempts: gameState.wrongAttempts
      };

      storyData.achievements.forEach(achievement => {
        // 跳過已解鎖的成就
        if (gameState.achievements.includes(achievement.id)) {
          return;
        }

        // 評估成就條件
        if (this.evaluateCondition(achievement.condition, gameContext)) {
          this.unlockAchievement(achievement);
        }
      });
    },

    // 解鎖成就
    unlockAchievement(achievement) {
      if (!gameState.achievements.includes(achievement.id)) {
        gameState.achievements.push(achievement.id);
        
        // 顯示成就解鎖通知
        gameLogic.addMessage(
          `🏆 成就解鎖！\n【${achievement.name}】\n${achievement.description}`,
          'achievement-message'
        );

        // 播放成就音效
        audioManager.play('success');
        
        // 更新 UI
        this.updateAchievementsUI();
      }
    },

    // 更新成就 UI 顯示
    updateAchievementsUI() {
      if (!elements.achievementsList) return;

      const achievementsHtml = storyData.achievements.map(achievement => {
        const isUnlocked = gameState.achievements.includes(achievement.id);
        const statusClass = isUnlocked ? 'unlocked' : 'locked';
        const icon = isUnlocked ? '🏆' : '🔒';
        
        return `
          <div class="achievement ${statusClass}">
            <span class="achievement-icon">${icon}</span>
            <span class="achievement-name">${achievement.name}</span>
            ${isUnlocked ? `<div class="achievement-desc">${achievement.description}</div>` : ''}
          </div>
        `;
      }).join('');

      elements.achievementsList.innerHTML = achievementsHtml;
    }
  };

  // UI 更新函數
  const ui = {
    updateStatus() {
      const currentLevel = utils.getCurrentLevel();
      const levelData = this.getCurrentLevelData();
      const maxHints = getMaxHints(); // 使用動態獲取的最大提示數

      if (elements.currentLocation) {
        elements.currentLocation.textContent = levelData?.name || '準備開始';
      }

      if (elements.cluesCount) {
        elements.cluesCount.textContent = `線索: ${gameState.flags.length}/4`;
      }

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
      const storyPath = './story.json';
      try {
        const response = await fetch(storyPath);
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

    // 實現 getCurrentHint 函數
    getCurrentHint() {
      if (!storyData?.levels || gameState.level <= 0) {
        return '目前沒有可用的提示';
      }

      const currentLevelData = storyData.levels.find(level => level.id === gameState.level);
      if (!currentLevelData?.hints || !Array.isArray(currentLevelData.hints)) {
        return '此關卡沒有提示';
      }

      const maxHints = getMaxHints();
      const hintIndex = Math.min(gameState.hintCount, currentLevelData.hints.length - 1);
      
      if (gameState.hintCount >= maxHints) {
        return '已達到最大提示次數';
      }

      return currentLevelData.hints[hintIndex] || '沒有更多提示了';
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
          max_hints: getMaxHints(), // 使用動態獲取的最大提示數
          remaining_hints: Math.max(0, getMaxHints() - gameState.hintCount),
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
      }

      return false;
    },

    // 擴展關卡輸入處理
    handleLevelInput(input) {
      const currentLevelData = ui.getCurrentLevelData();
      if (!currentLevelData) {
        this.addMessage('❌ 找不到當前關卡數據', 'error-message');
        return;
      }

      const inputLower = input.toLowerCase().trim();

      // 處理特殊跳過邏輯
      if (inputLower === '跳過' && gameState.level === 2) {
        this.handleSkipLogic();
        return;
      }

      // 處理分支觸發
      if (this.handleBranches(currentLevelData, input)) {
        return;
      }

      // 處理答案檢查
      this.checkAnswers(currentLevelData, input);
    },

    // 新增跳過邏輯處理
    handleSkipLogic() {
      if (gameState.level === 2 && gameState.flags.includes('B')) {
        this.addMessage('🛤️ 你選擇跳過暗道探索，回到主線劇情...', 'system-message');
        this.addMessage('🚪 通往餐廳的秘密通道已開啟！', 'system-message');
        
        // 直接進入下一關
        gameState.level = 3;
        gameState.score += 50; // 給予少量分數
        
        ui.updateStatus();
        this.showCurrentLevel();
        audioManager.play('success');
      } else {
        this.addMessage('❌ 目前無法使用跳過功能', 'error-message');
      }
    },

    handleBranches(levelData, input) {
      if (!levelData.branches) return false;

      for (const branch of levelData.branches) {
        if (branch.trigger && branch.trigger.some(trigger => 
          input.toLowerCase().includes(trigger.toLowerCase())
        )) {
          // 檢查是否需要特定線索
          if (branch.requires_flags && !utils.checkRequiredFlags(branch.requires_flags)) {
            this.addMessage('❌ 你需要更多線索才能進行這個調查', 'error-message');
            return true;
          }

          // 執行分支邏輯
          this.addMessage(branch.response, 'system-message');

          // 添加線索
          if (branch.flag && !gameState.flags.includes(branch.flag)) {
            gameState.flags.push(branch.flag);
            ui.updateCluesList();
          }

          // 加分
          if (branch.score_bonus) {
            gameState.score += branch.score_bonus;
          }

          ui.updateStatus();
          achievementSystem.checkAchievements();
          return true;
        }
      }

      return false;
    },

    checkAnswers(levelData, input) {
      if (!levelData.answers) {
        this.addMessage('❌ 此關卡沒有配置答案', 'error-message');
        return;
      }

      const inputLower = input.toLowerCase().trim();
      let correctAnswer = null;

      // 檢查所有可能的答案
      for (const answer of levelData.answers) {
        if (!answer.values) continue;

        // 檢查是否需要特定線索
        if (answer.requires_flags && !utils.checkRequiredFlags(answer.requires_flags)) {
          continue;
        }

        // 檢查答案匹配
        const isMatch = answer.values.some(value => 
          inputLower === value.toLowerCase() || 
          inputLower.includes(value.toLowerCase())
        );

        if (isMatch) {
          correctAnswer = answer;
          break;
        }
      }

      if (correctAnswer) {
        this.handleCorrectAnswer(correctAnswer);
      } else {
        this.handleWrongAnswer(levelData, input);
      }
    },

    handleCorrectAnswer(answer) {
      // 顯示正確回應
      this.addMessage(answer.response, 'success-message');

      // 加分
      if (answer.score_bonus) {
        gameState.score += answer.score_bonus;
      }

      // 添加線索
      if (answer.flag && !gameState.flags.includes(answer.flag)) {
        gameState.flags.push(answer.flag);
        ui.updateCluesList();
      }

      // 檢查成就
      if (answer.achievement) {
        if (!gameState.achievements.includes(answer.achievement)) {
          gameState.achievements.push(answer.achievement);
        }
      }

      // 進入下一關或結束遊戲
      if (answer.next_level) {
        gameState.level = answer.next_level;
        setTimeout(() => {
          this.showCurrentLevel();
        }, 2000);
      } else if (answer.ending) {
        this.endGame(answer.ending);
      }

      ui.updateStatus();
      achievementSystem.checkAchievements();
      audioManager.play('success');
    },

    handleWrongAnswer(levelData, input) {
      gameState.wrongAttempts++;

      // 檢查特定錯誤回應
      if (levelData.wrong_responses) {
        for (const wrongResponse of levelData.wrong_responses) {
          if (wrongResponse.values && wrongResponse.values.some(value => 
            input.toLowerCase().includes(value.toLowerCase())
          )) {
            this.addMessage(wrongResponse.response, 'error-message');
            ui.updateStatus();
            audioManager.play('error');
            return;
          }

          if (wrongResponse.pattern) {
            const regex = new RegExp(wrongResponse.pattern, 'i');
            if (regex.test(input)) {
              this.addMessage(wrongResponse.response, 'error-message');
              ui.updateStatus();
              audioManager.play('error');
              return;
            }
          }
        }
      }

      // 使用默認錯誤回應
      const defaultWrong = levelData.default_wrong || '❌ 請重新思考，或使用 `/hint` 獲取提示。';
      this.addMessage(defaultWrong, 'error-message');
      ui.updateStatus();
      audioManager.play('error');
    },

    showCurrentLevel() {
      const levelData = ui.getCurrentLevelData();
      if (!levelData) {
        this.addMessage('❌ 找不到關卡數據', 'error-message');
        return;
      }

      this.addMessage(levelData.prompt, 'level-prompt');
      ui.updateStatus();
    },

    executeAction(action) {
      switch (action) {
        case 'reset_game_state':
          this.resetGame();
          break;
        case 'increment_hint_count':
          gameState.hintCount++;
          break;
        case 'save_game_state':
          this.saveGame();
          break;
        case 'load_game_state':
          this.loadGame();
          break;
        default:
          console.warn('未知動作:', action);
      }
    },

    endGame(ending) {
      gameState.isGameCompleted = true;
      gameState.currentEnding = ending;
      
      // 檢查最終成就
      achievementSystem.checkAchievements();
      
      // 保存遊戲狀態
      this.saveGame();
    },

    saveGame() {
      const saveData = {
        gameState: { ...gameState },
        timestamp: Date.now()
      };

      if (utils.saveToStorage(GAME_CONSTANTS.SAVE_KEY, saveData)) {
        this.addMessage('💾 遊戲進度已保存！', 'system-message');
      } else {
        this.addMessage('❌ 保存失敗', 'error-message');
      }
    },

    loadGame() {
      const saveData = utils.loadFromStorage(GAME_CONSTANTS.SAVE_KEY);
      if (saveData && saveData.gameState) {
        gameState = { ...gameState, ...saveData.gameState };
        ui.updateStatus();
        ui.updateCluesList();
        achievementSystem.updateAchievementsUI();
        this.addMessage('📂 遊戲進度已載入！', 'system-message');
        
        if (gameState.level > 0) {
          this.showCurrentLevel();
        }
      } else {
        this.addMessage('❌ 沒有找到保存的遊戲', 'error-message');
      }
    },

    resetGame() {
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
        settings: gameState.settings // 保留設定
      };

      ui.updateStatus();
      ui.updateCluesList();
      achievementSystem.updateAchievementsUI();
      this.addMessage('🔄 遊戲已重置，準備開始新的調查...', 'system-message');
    }
  };

  // 事件監聽器設置
  const setupEventListeners = () => {
    // 輸入處理
    if (elements.input) {
      elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const input = elements.input.value.trim();
          if (input) {
            gameLogic.processInput(input);
            elements.input.value = '';
          }
        }
      });
    }

    if (elements.sendBtn) {
      elements.sendBtn.addEventListener('click', () => {
        const input = elements.input.value.trim();
        if (input) {
          gameLogic.processInput(input);
          elements.input.value = '';
        }
      });
    }

    // 快速按鈕
    if (elements.hintBtn) {
      elements.hintBtn.addEventListener('click', () => {
        gameLogic.processInput('/hint');
      });
    }

    if (elements.statusBtn) {
      elements.statusBtn.addEventListener('click', () => {
        gameLogic.processInput('/status');
      });
    }

    if (elements.saveBtn) {
      elements.saveBtn.addEventListener('click', () => {
        gameLogic.processInput('/save');
      });
    }

    if (elements.loadBtn) {
      elements.loadBtn.addEventListener('click', () => {
        gameLogic.processInput('/load');
      });
    }

    // 設定面板
    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', () => {
        if (elements.settingsPanel) {
          elements.settingsPanel.style.display = 'flex';
        }
      });
    }

    if (elements.closeSettings) {
      elements.closeSettings.addEventListener('click', () => {
        if (elements.settingsPanel) {
          elements.settingsPanel.style.display = 'none';
        }
      });
    }

    // 音效設定
    if (elements.soundToggle) {
      elements.soundToggle.addEventListener('change', (e) => {
        gameState.settings.soundEnabled = e.target.checked;
        utils.saveToStorage(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
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
        utils.saveToStorage(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
      });
    }

    if (elements.volumeSlider) {
      elements.volumeSlider.addEventListener('input', (e) => {
        const volume = parseInt(e.target.value);
        audioManager.setVolume(volume);
        if (elements.volumeValue) {
          elements.volumeValue.textContent = volume;
        }
        utils.saveToStorage(GAME_CONSTANTS.SETTINGS_KEY, gameState.settings);
      });
    }

    // 重置遊戲
    if (elements.resetGame) {
      elements.resetGame.addEventListener('click', () => {
        if (confirm('確定要重置遊戲嗎？所有進度將會丟失！')) {
          gameLogic.resetGame();
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
        }
      });
    }
  };

  // 初始化遊戲
  const initGame = async () => {
    console.log('初始化遊戲...');

    // 載入設定
    const savedSettings = utils.loadFromStorage(GAME_CONSTANTS.SETTINGS_KEY);
    if (savedSettings) {
      gameState.settings = { ...gameState.settings, ...savedSettings };
    }

    // 設置事件監聽器
    setupEventListeners();

    // 載入故事數據
    const dataLoaded = await gameLogic.loadStoryData();
    if (!dataLoaded) {
      return;
    }

    // 初始化 UI
    ui.updateStatus();
    ui.updateCluesList();
    achievementSystem.updateAchievementsUI();

    // 應用設定
    if (elements.soundToggle) {
      elements.soundToggle.checked = gameState.settings.soundEnabled;
    }
    if (elements.musicToggle) {
      elements.musicToggle.checked = gameState.settings.musicEnabled;
    }
    if (elements.volumeSlider) {
      elements.volumeSlider.value = gameState.settings.volume;
    }
    if (elements.volumeValue) {
      elements.volumeValue.textContent = gameState.settings.volume;
    }

    // 開始背景音樂
    if (gameState.settings.musicEnabled) {
      audioManager.playMusic();
    }

    // 顯示歡迎訊息
    gameLogic.addMessage('🎭 歡迎來到萬聖夜驚變：化裝舞會謎案！', 'system-message');
    gameLogic.addMessage('輸入 `/start` 開始你的推理之旅', 'system-message');

    isGameLoaded = true;
    console.log('遊戲初始化完成');
  };

  // 當 DOM 載入完成後初始化遊戲
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }

})();
