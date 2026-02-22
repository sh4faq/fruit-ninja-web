// Main game controller - Full mode system with Classic, Arcade, Zen

class FruitNinjaGame {
    constructor() {
        // DOM elements
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { desynchronized: true });
        this.video = document.getElementById('webcam');

        // Camera monitor (PiP)
        this.camMonitor = document.getElementById('camera-monitor');
        this.camCtx = this.camMonitor.getContext('2d');
        this.camMonitor.width = 200;
        this.camMonitor.height = 150;

        // Screens
        this.loadingScreen = document.getElementById('loading');
        this.mainMenu = document.getElementById('main-menu');
        this.gameoverScreen = document.getElementById('gameover-screen');

        // HUD elements
        this.uiOverlay = document.getElementById('ui-overlay');
        this.scoreDisplay = document.getElementById('score');
        this.bestScoreDisplay = document.getElementById('best-score');
        this.modeIndicator = document.getElementById('mode-indicator');
        this.levelIndicator = document.getElementById('level-indicator');
        this.levelNumber = document.getElementById('level-number');
        this.livesDisplay = document.getElementById('lives-display');
        this.lifeElements = [
            document.getElementById('life-1'),
            document.getElementById('life-2'),
            document.getElementById('life-3')
        ];
        this.timerContainer = document.getElementById('timer-container');
        this.timerFill = document.getElementById('timer-fill');
        this.timerText = document.getElementById('timer-text');
        this.powerupDisplay = document.getElementById('powerup-display');
        this.comboDisplay = document.getElementById('combo-display');
        this.comboText = document.getElementById('combo');

        // Chapter/wave HUD elements
        this.chapterNameHud = document.getElementById('chapter-name-hud');
        this.levelProgressFill = document.getElementById('level-progress-fill');
        this.waveCounter = document.getElementById('wave-counter');
        this.chapterOverlay = document.getElementById('chapter-overlay');
        this.chapterNumberLabel = document.getElementById('chapter-number-label');
        this.chapterNameDisplay = document.getElementById('chapter-name-display');
        this.chapterSlashLine = document.getElementById('chapter-slash-line');
        this.chapterTagline = document.getElementById('chapter-tagline');

        // Game over elements
        this.gameoverModeLabel = document.getElementById('gameover-mode-label');
        this.finalScoreDisplay = document.getElementById('final-score');
        this.finalBestDisplay = document.getElementById('final-best');
        this.finalLevelRow = document.getElementById('final-level-row');
        this.finalLevel = document.getElementById('final-level');
        this.finalChapterRow = document.getElementById('final-chapter-row');
        this.finalChapter = document.getElementById('final-chapter');

        // Game state
        this.isPlaying = false;
        this.currentMode = 'classic';
        this.modeConfig = null;
        this.score = 0;
        this.combo = 0;
        this.lastSliceTime = 0;
        this.lives = 3;

        // Level system
        this.level = 1;
        this.fruitsSlicedThisLevel = 0;
        this.totalFruitsSliced = 0;

        // Wave/chapter system (Classic mode)
        this.wave = {
            enabled: false,
            currentWave: 0,
            totalWaves: 3,
            fruitsInWave: 3,
            fruitsSpawnedInWave: 0,
            fruitsResolvedInWave: 0,
            totalFruitsInLevel: 0,
            fruitsResolvedInLevel: 0,
            state: 'idle',        // idle, spawning, clearing, pause, level_complete, chapter_transition
            pauseEndTime: 0,
            waveSpawnDelay: 400,
            nextSpawnTime: 0,
        };
        this.currentChapter = null;
        this.chapterVignetteColor = null;

        // Timer (Arcade/Zen)
        this.timeRemaining = 0;
        this.timerStartTime = 0;

        // Arcade powerups
        this.activePowerups = {
            freeze: { active: false, endTime: 0, duration: 5000 },
            frenzy: { active: false, endTime: 0, duration: 5000 },
            double: { active: false, endTime: 0, duration: 8000 },
        };

        // Best scores per mode
        this.bestScores = {
            classic: parseInt(localStorage.getItem('fnBest_classic') || '0', 10),
            arcade: parseInt(localStorage.getItem('fnBest_arcade') || '0', 10),
            zen: parseInt(localStorage.getItem('fnBest_zen') || '0', 10),
        };

        // Settings
        this.settings = this.loadSettings();

        // Game objects
        this.fruits = [];
        this.halves = [];
        this.bombs = [];
        this.specialFruits = [];

        // Systems
        this.effects = new EffectsManager();
        this.handTracker = null;

        // Timing
        this.lastSpawnTime = 0;
        this.spawnInterval = 1500;
        this.lastFrameTime = 0;

        // Difficulty preset
        this.difficultyPreset = DIFFICULTY_PRESETS[this.settings.difficulty];

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.onHandResults = this.onHandResults.bind(this);
        this.drawHandsLoop = this.drawHandsLoop.bind(this);

        // Initialize
        this.init();
    }

    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('fnSettings') || 'null');
            return { ...DEFAULT_SETTINGS, ...saved };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    saveSettings() {
        localStorage.setItem('fnSettings', JSON.stringify(this.settings));
    }

    // ==================== INITIALIZATION ====================
    async init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        try {
            this.handTracker = new HandTracker(this.video, this.onHandResults);
            await this.handTracker.initialize();

            this.loadingScreen.classList.add('hidden');
            this.mainMenu.classList.remove('hidden');

            this.drawHandsLoop();
        } catch (error) {
            console.error('Failed to initialize hand tracking:', error);
            this.loadingScreen.querySelector('.loading-content').innerHTML = `
                <p style="color: #e74c3c;">Failed to initialize camera</p>
                <p class="loading-sub">Please allow camera access and refresh the page</p>
            `;
        }

        this.setupMenuHandlers();
        this.updateMenuBestScores();
        this.applySettingsToUI();
    }

    setupMenuHandlers() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const tabId = 'tab-' + btn.dataset.tab;
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Mode card clicks -> start game
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                this.startGame(card.dataset.mode);
            });
        });

        // Game over buttons
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.startGame(this.currentMode);
        });
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showMainMenu();
        });

        // Settings: option groups (sensitivity, difficulty)
        document.querySelectorAll('.setting-options').forEach(group => {
            group.querySelectorAll('.setting-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.setting-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const settingName = group.dataset.setting;
                    this.settings[settingName] = btn.dataset.value;
                    this.saveSettings();
                    this.applySettings();
                });
            });
        });

        // Settings: camera mirror toggle
        document.getElementById('mirror-toggle').addEventListener('click', () => {
            const btn = document.getElementById('mirror-toggle');
            this.settings.cameraMirror = !this.settings.cameraMirror;
            btn.classList.toggle('active', this.settings.cameraMirror);
            btn.textContent = this.settings.cameraMirror ? 'ON' : 'OFF';
            this.saveSettings();
            this.applySettings();
        });

        // Settings: reset scores
        document.getElementById('reset-scores-btn').addEventListener('click', () => {
            document.getElementById('reset-confirm').classList.remove('hidden');
        });
        document.getElementById('reset-yes').addEventListener('click', () => {
            this.resetAllScores();
            document.getElementById('reset-confirm').classList.add('hidden');
        });
        document.getElementById('reset-no').addEventListener('click', () => {
            document.getElementById('reset-confirm').classList.add('hidden');
        });
    }

    applySettingsToUI() {
        // Sensitivity
        const sensGroup = document.querySelector('[data-setting="sensitivity"]');
        if (sensGroup) {
            sensGroup.querySelectorAll('.setting-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.value === this.settings.sensitivity);
            });
        }

        // Difficulty
        const diffGroup = document.querySelector('[data-setting="difficulty"]');
        if (diffGroup) {
            diffGroup.querySelectorAll('.setting-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.value === this.settings.difficulty);
            });
        }

        // Camera mirror
        const mirrorBtn = document.getElementById('mirror-toggle');
        mirrorBtn.classList.toggle('active', this.settings.cameraMirror);
        mirrorBtn.textContent = this.settings.cameraMirror ? 'ON' : 'OFF';
    }

    applySettings() {
        this.difficultyPreset = DIFFICULTY_PRESETS[this.settings.difficulty];

        // Apply sensitivity to hand tracker
        if (this.handTracker) {
            const sens = SENSITIVITY_MAP[this.settings.sensitivity];
            this.handTracker.smoothingFactor = sens.smoothing;
        }

        // Camera mirror
        this.video.style.transform = this.settings.cameraMirror ? 'scaleX(-1)' : 'none';
    }

    resetAllScores() {
        this.bestScores = { classic: 0, arcade: 0, zen: 0 };
        localStorage.removeItem('fnBest_classic');
        localStorage.removeItem('fnBest_arcade');
        localStorage.removeItem('fnBest_zen');
        this.updateMenuBestScores();
    }

    updateMenuBestScores() {
        document.getElementById('best-classic').textContent = this.bestScores.classic;
        document.getElementById('best-arcade').textContent = this.bestScores.arcade;
        document.getElementById('best-zen').textContent = this.bestScores.zen;
    }

    // ==================== DRAW HANDS (MENU) ====================
    drawHandsLoop() {
        if (!this.isPlaying && this.handTracker) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.effects.update();
            this.effects.draw(this.ctx);
            this.handTracker.drawLandmarks(this.ctx);

            // Status pill
            this.ctx.save();
            const numHands = this.handTracker.allHandsLandmarks ? this.handTracker.allHandsLandmarks.length : 0;
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.roundRect(15, this.canvas.height - 50, numHands > 0 ? 170 : 360, 35, 8);
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.arc(35, this.canvas.height - 32, 6, 0, Math.PI * 2);
            this.ctx.fillStyle = numHands > 0 ? '#4caf50' : '#e74c3c';
            this.ctx.fill();

            this.ctx.font = '14px "Segoe UI", Arial, sans-serif';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            if (numHands > 0) {
                this.ctx.fillText('Hand detected', 52, this.canvas.height - 28);
            } else {
                this.ctx.fillText('Show your hand to the camera to begin', 52, this.canvas.height - 28);
            }
            this.ctx.restore();
        }
        requestAnimationFrame(this.drawHandsLoop);
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // ==================== GAME START ====================
    startGame(mode) {
        this.currentMode = mode;
        this.modeConfig = MODE_CONFIGS[mode];

        // Reset state
        this.isPlaying = true;
        this.score = 0;
        this.combo = 0;
        this.lives = this.modeConfig.maxLives;
        this.level = 1;
        this.fruitsSlicedThisLevel = 0;
        this.totalFruitsSliced = 0;
        this.fruits = [];
        this.halves = [];
        this.bombs = [];
        this.specialFruits = [];
        this.lastSpawnTime = 0;
        this.effects.clearTrail();

        // Clear fruit render cache
        FruitCache.cache = {};
        FruitCache.halfCache = {};

        // Reset powerups
        Object.keys(this.activePowerups).forEach(key => {
            this.activePowerups[key].active = false;
            this.activePowerups[key].endTime = 0;
        });

        // Apply difficulty preset
        this.difficultyPreset = DIFFICULTY_PRESETS[this.settings.difficulty];

        // Set spawn interval from mode config + difficulty
        this.spawnInterval = this.modeConfig.fruitSpawnInterval * this.difficultyPreset.spawnMult;

        // Timer setup
        if (this.modeConfig.hasTimer) {
            this.timeRemaining = this.modeConfig.timerDuration;
            this.timerStartTime = performance.now();
        }

        // Update HUD
        this.scoreDisplay.textContent = '0';
        this.bestScoreDisplay.textContent = this.bestScores[mode];
        this.modeIndicator.textContent = this.modeConfig.name;

        // Show/hide HUD elements based on mode
        this.uiOverlay.classList.remove('hidden');

        // Lives (Classic only)
        if (this.modeConfig.maxLives <= 10) {
            this.livesDisplay.classList.remove('hidden');
            this.lifeElements.forEach(el => el.classList.remove('lost'));
        } else {
            this.livesDisplay.classList.add('hidden');
        }

        // Level indicator
        if (this.modeConfig.hasLevels) {
            this.levelIndicator.classList.remove('hidden');
            this.levelNumber.textContent = '1';
        } else {
            this.levelIndicator.classList.add('hidden');
        }

        // Wave/chapter system (Classic mode with chapters)
        if (this.modeConfig.hasChapters) {
            this.wave.enabled = true;
            this.wave.state = 'chapter_transition';
            this.currentChapter = CHAPTER_CONFIG.getChapterForLevel(1);
            this.updateChapterVisuals();
            this.showChapterTransition(1);
        } else {
            this.wave.enabled = false;
            this.wave.state = 'idle';
            if (this.chapterNameHud) this.chapterNameHud.textContent = '';
            if (this.levelProgressFill) this.levelProgressFill.style.width = '0%';
            if (this.waveCounter) this.waveCounter.textContent = '';
        }

        // Timer
        if (this.modeConfig.hasTimer) {
            this.timerContainer.classList.remove('hidden');
            this.timerFill.style.width = '100%';
            this.timerFill.className = '';
            this.timerText.textContent = this.modeConfig.timerDuration;
        } else {
            this.timerContainer.classList.add('hidden');
        }

        // Powerup display (Arcade only)
        if (this.modeConfig.hasSpecialFruits) {
            this.powerupDisplay.classList.remove('hidden');
            document.querySelectorAll('.powerup-pill').forEach(p => p.classList.remove('active'));
        } else {
            this.powerupDisplay.classList.add('hidden');
        }

        this.comboDisplay.classList.add('hidden');

        // Hide screens
        this.mainMenu.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');

        // Start game loop
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.gameLoop);
    }

    showMainMenu() {
        this.isPlaying = false;
        this.uiOverlay.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
        this.hideChapterTransition();
        clearTimeout(this._chapterTransitionTimer);
        this.updateMenuBestScores();
    }

    // ==================== LIVES ====================
    loseLife() {
        this.lives--;
        const lostIndex = this.modeConfig.maxLives - this.lives - 1;
        if (lostIndex >= 0 && lostIndex < this.lifeElements.length) {
            this.lifeElements[lostIndex].classList.add('lost');
        }

        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    // ==================== GAME OVER ====================
    gameOver() {
        this.isPlaying = false;

        // Update best score for this mode
        if (this.score > this.bestScores[this.currentMode]) {
            this.bestScores[this.currentMode] = this.score;
            localStorage.setItem('fnBest_' + this.currentMode, this.score.toString());
        }

        // Game over screen
        this.gameoverModeLabel.textContent = this.modeConfig.name + ' Mode';
        this.finalScoreDisplay.textContent = this.score;
        this.finalBestDisplay.textContent = this.bestScores[this.currentMode];

        if (this.modeConfig.hasLevels) {
            this.finalLevelRow.style.display = '';
            this.finalLevel.textContent = this.level;
        } else {
            this.finalLevelRow.style.display = 'none';
        }

        // Show chapter info on game over (Classic only)
        if (this.modeConfig.hasChapters && this.currentChapter) {
            this.finalChapterRow.style.display = '';
            this.finalChapter.textContent = toRoman(this.currentChapter.id) + ' - ' + this.currentChapter.name;
        } else {
            this.finalChapterRow.style.display = 'none';
        }

        // Clean up chapter transition if active
        this.hideChapterTransition();
        clearTimeout(this._chapterTransitionTimer);

        this.uiOverlay.classList.add('hidden');
        this.gameoverScreen.classList.remove('hidden');
    }

    // ==================== HAND RESULTS ====================
    onHandResults(data) {
        const tracker = this.handTracker;
        if (tracker && tracker.landmarks) {
            // Use smoothed positions for visual trail (looks cleaner)
            for (let f = 0; f < 5; f++) {
                const curr = tracker.fingerTips[f];
                const prev = tracker.previousFingerTips[f];
                if (!curr || !prev) continue;
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                if (Math.sqrt(dx * dx + dy * dy) > 3) {
                    this.effects.updateSliceTrail(curr.x, curr.y, f);
                }
            }
        }

        if (!this.isPlaying) return;
        if (!tracker || !tracker.landmarks) return;

        // Use RAW (unsmoothed) positions for slice detection - no lag
        for (let f = 0; f < 5; f++) {
            const curr = tracker.rawFingerTips[f];
            const prev = tracker.previousRawFingerTips[f];
            if (!curr || !prev) continue;

            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 3) continue;

            this.checkSlices({ x1: prev.x, y1: prev.y, x2: curr.x, y2: curr.y });
        }
    }

    // ==================== SLICE DETECTION ====================
    checkSlices(sliceLine) {
        const { x1, y1, x2, y2 } = sliceLine;
        let slicedThisFrame = 0;

        // Check regular fruits
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];
            if (fruit.isSliced || fruit.isOffScreen) continue;
            if (fruit.checkSlice(x1, y1, x2, y2)) {
                const halves = fruit.slice();
                this.halves.push(...halves);
                this.effects.addSplatter(fruit.x, fruit.y, fruit.type.color);
                slicedThisFrame++;
                this.addScore(fruit.x, fruit.y, fruit.type.points);
                this.fruitsSlicedThisLevel++;
                this.totalFruitsSliced++;

                // Track wave resolution for sliced fruits
                if (this.wave.enabled && (this.wave.state === 'spawning' || this.wave.state === 'clearing')) {
                    this.wave.fruitsResolvedInWave++;
                    this.wave.fruitsResolvedInLevel++;
                    this.updateProgressBar();
                }

                this.fruits.splice(i, 1);
            }
        }

        // Check special fruits (Arcade)
        for (let i = this.specialFruits.length - 1; i >= 0; i--) {
            const sf = this.specialFruits[i];
            if (sf.isSliced || sf.isOffScreen) continue;
            if (sf.checkSlice(x1, y1, x2, y2)) {
                sf.isSliced = true;
                this.effects.addSplatter(sf.x, sf.y, sf.type.color);
                this.activatePowerup(sf.specialType);
                this.specialFruits.splice(i, 1);
            }
        }

        // Check bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            if (bomb.checkSlice(x1, y1, x2, y2)) {
                bomb.isSliced = true;
                if (this.modeConfig.bombPenalty === 'gameover') {
                    this.gameOver();
                    return;
                } else if (this.modeConfig.bombPenalty === 'points') {
                    this.score = Math.max(0, this.score - this.modeConfig.bombPointPenalty);
                    this.scoreDisplay.textContent = this.score;
                    this.effects.addScorePopup(bomb.x, bomb.y, -this.modeConfig.bombPointPenalty);
                }
                this.bombs.splice(i, 1);
            }
        }

        // Update combo
        if (slicedThisFrame > 0) {
            const now = performance.now();
            if (now - this.lastSliceTime < GAME_CONFIG.comboTimeWindow) {
                this.combo += slicedThisFrame;
            } else {
                this.combo = slicedThisFrame;
            }
            this.lastSliceTime = now;
            this.updateComboDisplay();
        }
    }

    // ==================== SCORING ====================
    addScore(x, y, basePoints) {
        let points = basePoints;

        // Combo multiplier
        if (this.combo > 1) {
            points *= this.combo;
        }

        // Double points powerup (Arcade)
        if (this.activePowerups.double.active) {
            points *= 2;
        }

        if (this.combo > 1 || this.activePowerups.double.active) {
            this.effects.addScorePopup(x, y, points, true);
        } else {
            this.effects.addScorePopup(x, y, points);
        }

        this.score += points;
        this.scoreDisplay.textContent = this.score;

        // Update best score in real-time
        if (this.score > this.bestScores[this.currentMode]) {
            this.bestScoreDisplay.textContent = this.score;
        }
    }

    updateComboDisplay() {
        if (this.combo > 1) {
            this.comboText.textContent = `x${this.combo} COMBO`;
            this.comboDisplay.classList.remove('hidden');
            this.comboDisplay.style.animation = 'none';
            this.comboDisplay.offsetHeight;
            this.comboDisplay.style.animation = null;
        } else {
            this.comboDisplay.classList.add('hidden');
        }
    }

    // ==================== LEVEL SYSTEM ====================
    checkLevelUp() {
        if (!this.modeConfig.hasLevels) return;
        if (this.level >= LEVEL_CONFIG.maxLevel) return;

        // Wave-based modes advance via wave completion, not fruit count
        if (this.wave.enabled) return;

        if (this.fruitsSlicedThisLevel >= LEVEL_CONFIG.fruitsPerLevel) {
            this.fruitsSlicedThisLevel = 0;
            this.level++;
            this.levelNumber.textContent = this.level;

            // Update spawn/speed from level config
            const lvlCfg = LEVEL_CONFIG.getLevel(this.level);
            this.spawnInterval = this.modeConfig.fruitSpawnInterval * lvlCfg.spawnMult * this.difficultyPreset.spawnMult;

            // Show level-up effect
            this.effects.showLevelUp(this.level);
        }
    }

    getCurrentLevelConfig() {
        return LEVEL_CONFIG.getLevel(this.level);
    }

    // ==================== WAVE / CHAPTER SYSTEM ====================
    getCurrentChapter() {
        return CHAPTER_CONFIG.getChapterForLevel(this.level);
    }

    initLevelWaves(level) {
        const chapter = CHAPTER_CONFIG.getChapterForLevel(level);
        const levelIdx = Math.max(0, chapter.levels.indexOf(level));
        // If level isn't in chapter.levels (endless), use last index
        const idx = levelIdx >= 0 ? levelIdx : chapter.levels.length - 1;

        this.wave.totalWaves = chapter.wavesPerLevel[idx] || 3;
        this.wave.currentWave = 0;
        this.wave.fruitsResolvedInLevel = 0;

        // Calculate total fruits in level for progress bar
        this.wave.totalFruitsInLevel = 0;
        for (let w = 0; w < this.wave.totalWaves; w++) {
            const min = chapter.fruitsPerWave[idx] || 3;
            const max = chapter.fruitsPerWaveMax[idx] || 5;
            this.wave.totalFruitsInLevel += Math.round((min + max) / 2);
        }

        this.currentChapter = chapter;
        this.initWave(0);
    }

    initWave(waveIndex) {
        const chapter = this.currentChapter;
        const levelIdx = Math.max(0, chapter.levels.indexOf(this.level));
        const idx = levelIdx >= 0 ? levelIdx : chapter.levels.length - 1;

        const min = chapter.fruitsPerWave[idx] || 3;
        const max = chapter.fruitsPerWaveMax[idx] || 5;

        this.wave.currentWave = waveIndex;
        this.wave.fruitsInWave = Utils.randomInt(min, max);
        this.wave.fruitsSpawnedInWave = 0;
        this.wave.fruitsResolvedInWave = 0;
        this.wave.state = 'spawning';
        this.wave.nextSpawnTime = performance.now() + 300; // small initial delay

        this.updateProgressBar();
    }

    updateWaveSystem(now) {
        if (!this.wave.enabled) return;
        const w = this.wave;

        switch (w.state) {
            case 'spawning':
                if (now >= w.nextSpawnTime && w.fruitsSpawnedInWave < w.fruitsInWave) {
                    this.spawnWaveFruit();
                    w.fruitsSpawnedInWave++;
                    w.nextSpawnTime = now + w.waveSpawnDelay;
                }
                // All fruits spawned, wait for them to clear
                if (w.fruitsSpawnedInWave >= w.fruitsInWave) {
                    w.state = 'clearing';
                }
                break;

            case 'clearing':
                // Wait until all fruits from this wave are resolved (sliced or off-screen)
                if (w.fruitsResolvedInWave >= w.fruitsInWave) {
                    // Are there more waves in this level?
                    if (w.currentWave + 1 < w.totalWaves) {
                        w.state = 'pause';
                        w.pauseEndTime = now + (this.currentChapter.wavePause || 1000);
                    } else {
                        w.state = 'level_complete';
                    }
                }
                break;

            case 'pause':
                if (now >= w.pauseEndTime) {
                    this.initWave(w.currentWave + 1);
                }
                break;

            case 'level_complete':
                this.advanceLevel();
                break;

            case 'chapter_transition':
                // Handled by timeout in showChapterTransition
                break;
        }
    }

    spawnWaveFruit() {
        const lvlCfg = this.getCurrentLevelConfig();
        const speedMult = lvlCfg.speedMult * this.difficultyPreset.speedMult;

        const fruit = new Fruit(this.canvas);
        fruit.vx *= speedMult;
        fruit.vy *= speedMult;
        this.fruits.push(fruit);

        // Bomb spawning within wave
        if (this.modeConfig.hasBombs) {
            const bombChance = lvlCfg.bombChance * this.difficultyPreset.bombMult;
            if (this.score > GAME_CONFIG.minScoreForBombs && Math.random() < bombChance) {
                setTimeout(() => {
                    if (this.isPlaying) {
                        const bomb = new Bomb(this.canvas);
                        bomb.vx *= speedMult;
                        bomb.vy *= speedMult;
                        this.bombs.push(bomb);
                    }
                }, 200);
            }
        }
    }

    advanceLevel() {
        if (this.level >= LEVEL_CONFIG.maxLevel) return;

        this.level++;
        this.levelNumber.textContent = this.level;

        // Update spawn config for new level
        const lvlCfg = LEVEL_CONFIG.getLevel(this.level);
        this.spawnInterval = this.modeConfig.fruitSpawnInterval * lvlCfg.spawnMult * this.difficultyPreset.spawnMult;
        this.wave.waveSpawnDelay = Math.max(200, 400 - (this.level - 1) * 15);

        // Check if entering a new chapter
        if (CHAPTER_CONFIG.isNewChapter(this.level)) {
            // Show chapter transition (which will init waves after)
            const chapter = CHAPTER_CONFIG.getChapterForLevel(this.level);
            const accent = chapter.accent || '#f5c842';
            this.effects.showLevelUp(this.level, accent);
            this.showChapterTransition(this.level);
        } else {
            // Same chapter, just show level-up and start next level's waves
            const accent = this.currentChapter ? this.currentChapter.accent : null;
            this.effects.showLevelUp(this.level, accent);
            this.initLevelWaves(this.level);
            this.updateChapterVisuals();
        }
    }

    showChapterTransition(level) {
        const chapter = CHAPTER_CONFIG.getChapterForLevel(level);
        this.wave.state = 'chapter_transition';

        // Populate overlay
        if (this.chapterNumberLabel) this.chapterNumberLabel.textContent = 'CHAPTER ' + toRoman(chapter.id);
        if (this.chapterNameDisplay) {
            this.chapterNameDisplay.textContent = chapter.name;
            this.chapterNameDisplay.style.color = chapter.accent;
        }
        if (this.chapterSlashLine) {
            this.chapterSlashLine.style.background = `linear-gradient(90deg, transparent, ${chapter.accent}99, transparent)`;
        }
        if (this.chapterTagline) this.chapterTagline.textContent = chapter.tagline;

        // Show overlay
        if (this.chapterOverlay) {
            this.chapterOverlay.classList.remove('hidden');
            // Re-trigger animations
            this.chapterOverlay.style.animation = 'none';
            this.chapterOverlay.offsetHeight;
            this.chapterOverlay.style.animation = null;

            const content = document.getElementById('chapter-transition-content');
            if (content) {
                content.style.animation = 'none';
                content.offsetHeight;
                content.style.animation = null;
            }
        }

        // Hide after delay and start waves
        clearTimeout(this._chapterTransitionTimer);
        this._chapterTransitionTimer = setTimeout(() => {
            this.hideChapterTransition();
            this.initLevelWaves(level);
            this.updateChapterVisuals();
        }, 3000);
    }

    hideChapterTransition() {
        if (this.chapterOverlay) {
            this.chapterOverlay.classList.add('hidden');
        }
    }

    updateChapterVisuals() {
        const chapter = this.currentChapter || this.getCurrentChapter();
        if (!chapter) return;

        // Update HUD chapter name
        if (this.chapterNameHud) {
            this.chapterNameHud.textContent = chapter.name;
            this.chapterNameHud.style.color = chapter.accent;
        }

        // Update progress bar accent
        if (this.levelProgressFill) {
            this.levelProgressFill.style.background = `linear-gradient(90deg, ${chapter.accent}, ${chapter.accent}cc)`;
        }

        // Store vignette color
        this.chapterVignetteColor = chapter.vignette;
    }

    updateProgressBar() {
        if (!this.wave.enabled) return;
        const w = this.wave;

        // Update wave counter text
        if (this.waveCounter) {
            this.waveCounter.textContent = `${w.currentWave + 1}/${w.totalWaves}`;
        }

        // Update progress fill based on fruits resolved in level
        if (this.levelProgressFill && w.totalFruitsInLevel > 0) {
            const pct = Math.min(100, (w.fruitsResolvedInLevel / w.totalFruitsInLevel) * 100);
            this.levelProgressFill.style.width = pct + '%';
        }
    }

    drawChapterVignette(ctx) {
        if (!this.chapterVignetteColor) return;

        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, this.chapterVignetteColor);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    // ==================== ARCADE POWERUPS ====================
    activatePowerup(type) {
        const now = performance.now();
        const pu = this.activePowerups[type];
        pu.active = true;
        pu.endTime = now + pu.duration;

        // Show powerup pill
        const pill = document.getElementById('powerup-' + type);
        if (pill) pill.classList.add('active');
    }

    updatePowerups() {
        const now = performance.now();
        Object.keys(this.activePowerups).forEach(key => {
            const pu = this.activePowerups[key];
            if (pu.active && now >= pu.endTime) {
                pu.active = false;
                const pill = document.getElementById('powerup-' + key);
                if (pill) pill.classList.remove('active');
            } else if (pu.active) {
                // Update timer display
                const remaining = Math.ceil((pu.endTime - now) / 1000);
                const pill = document.getElementById('powerup-' + key);
                if (pill) {
                    const timerEl = pill.querySelector('.powerup-timer');
                    if (timerEl) timerEl.textContent = remaining + 's';
                }
            }
        });
    }

    // ==================== SPAWNING ====================
    spawnFruit() {
        const lvlCfg = this.getCurrentLevelConfig();
        const speedMult = lvlCfg.speedMult * this.difficultyPreset.speedMult;

        // Frenzy mode: spawn more fruits
        const baseCount = this.activePowerups.frenzy.active ? Utils.randomInt(3, 6) : Utils.randomInt(1, 3);

        for (let i = 0; i < baseCount; i++) {
            setTimeout(() => {
                if (!this.isPlaying) return;
                const fruit = new Fruit(this.canvas);
                // Apply level speed multiplier
                fruit.vx *= speedMult;
                fruit.vy *= speedMult;
                // Apply freeze (slow everything)
                if (this.activePowerups.freeze.active) {
                    fruit.vx *= 0.5;
                    fruit.vy *= 0.5;
                }
                this.fruits.push(fruit);
            }, i * 150);
        }

        // Bomb spawning
        if (this.modeConfig.hasBombs) {
            const bombChance = lvlCfg.bombChance * this.difficultyPreset.bombMult;
            if (this.score > GAME_CONFIG.minScoreForBombs && Math.random() < bombChance) {
                setTimeout(() => {
                    if (this.isPlaying) {
                        const bomb = new Bomb(this.canvas);
                        bomb.vx *= speedMult;
                        bomb.vy *= speedMult;
                        this.bombs.push(bomb);
                    }
                }, 200);
            }
        }

        // Special fruit spawning (Arcade)
        if (this.modeConfig.hasSpecialFruits && Math.random() < this.modeConfig.specialFruitChance) {
            const types = ['freeze', 'frenzy', 'double'];
            const type = Utils.randomFrom(types);
            setTimeout(() => {
                if (this.isPlaying) {
                    const sf = new SpecialFruit(this.canvas, type);
                    sf.vx *= speedMult;
                    sf.vy *= speedMult;
                    this.specialFruits.push(sf);
                }
            }, 300);
        }
    }

    // ==================== TIMER ====================
    updateTimer() {
        if (!this.modeConfig.hasTimer) return;

        const elapsed = (performance.now() - this.timerStartTime) / 1000;

        // Freeze powerup pauses timer
        if (this.activePowerups.freeze.active) {
            this.timerStartTime += 16.67; // offset by ~1 frame
        }

        this.timeRemaining = Math.max(0, this.modeConfig.timerDuration - elapsed);
        const seconds = Math.ceil(this.timeRemaining);
        const pct = (this.timeRemaining / this.modeConfig.timerDuration) * 100;

        this.timerText.textContent = seconds;
        this.timerFill.style.width = pct + '%';

        // Color states
        if (pct <= 15) {
            this.timerFill.className = 'danger';
        } else if (pct <= 35) {
            this.timerFill.className = 'warning';
        } else {
            this.timerFill.className = '';
        }

        if (this.timeRemaining <= 0) {
            this.gameOver();
        }
    }

    // ==================== UPDATE ====================
    update(deltaTime) {
        const now = performance.now();

        // Timer
        this.updateTimer();

        // Powerups
        if (this.modeConfig.hasSpecialFruits) {
            this.updatePowerups();
        }

        // Wave system (Classic with chapters) vs continuous spawning (Arcade/Zen)
        if (this.wave.enabled) {
            this.updateWaveSystem(now);
        } else {
            // Continuous spawning for Arcade/Zen
            const effectiveInterval = this.activePowerups.frenzy.active
                ? this.spawnInterval * 0.5
                : this.spawnInterval;

            if (now - this.lastSpawnTime > effectiveInterval) {
                this.spawnFruit();
                this.lastSpawnTime = now;
            }
        }

        // Update game objects
        const freezeActive = this.activePowerups.freeze.active;
        this.fruits.forEach(fruit => {
            if (freezeActive) {
                // Slow down existing fruits during freeze
                fruit.vy += GAME_CONFIG.gravity * 0.5;
                fruit.x += fruit.vx * 0.5;
                fruit.y += fruit.vy * 0.5;
                fruit.rotation += fruit.rotationSpeed * 0.5;
                if (fruit.y > fruit.canvas.height + fruit.radius * 2) {
                    fruit.isOffScreen = true;
                }
            } else {
                fruit.update();
            }
        });
        this.halves.forEach(half => half.update());
        this.bombs.forEach(bomb => bomb.update());
        this.specialFruits.forEach(sf => sf.update());

        // Check for missed fruits (Classic: lose life; Arcade/Zen: no penalty)
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];
            if (fruit.isOffScreen && !fruit.isSliced) {
                if (this.modeConfig.maxLives <= 10) {
                    this.loseLife();
                }
                // Track wave resolution for missed fruits
                if (this.wave.enabled && (this.wave.state === 'spawning' || this.wave.state === 'clearing')) {
                    this.wave.fruitsResolvedInWave++;
                    this.wave.fruitsResolvedInLevel++;
                    this.updateProgressBar();
                }
                this.fruits.splice(i, 1);
            }
        }

        // Clean up off-screen objects
        this.fruits = this.fruits.filter(f => !f.isOffScreen);
        this.halves = this.halves.filter(h => !h.isOffScreen);
        this.bombs = this.bombs.filter(b => !b.isOffScreen);
        this.specialFruits = this.specialFruits.filter(sf => !sf.isOffScreen);

        // Update effects
        this.effects.update();

        // Reset combo if too much time passed
        if (now - this.lastSliceTime > GAME_CONFIG.comboTimeWindow && this.combo > 0) {
            this.combo = 0;
            this.comboDisplay.classList.add('hidden');
        }

        // Check level-up (non-wave modes only)
        this.checkLevelUp();
    }

    // ==================== DRAW ====================
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Chapter vignette (drawn first, behind everything)
        if (this.wave.enabled) {
            this.drawChapterVignette(ctx);
        }

        this.fruits.forEach(fruit => fruit.draw());
        this.halves.forEach(half => half.draw());
        this.bombs.forEach(bomb => bomb.draw());
        this.specialFruits.forEach(sf => sf.draw());

        this.effects.draw(ctx);

        if (this.handTracker) {
            this.handTracker.drawLandmarks(ctx);
        }

        // Draw camera monitor (PiP) — video feed + hand skeleton
        this.drawCameraMonitor();
    }

    drawCameraMonitor() {
        const mc = this.camCtx;
        const mw = this.camMonitor.width;
        const mh = this.camMonitor.height;

        // Draw mirrored video feed
        mc.save();
        mc.translate(mw, 0);
        mc.scale(-1, 1);
        mc.drawImage(this.video, 0, 0, mw, mh);
        mc.restore();

        // Draw hand skeleton overlay
        if (!this.handTracker || !this.handTracker.allHandsLandmarks || this.handTracker.allHandsLandmarks.length === 0) return;

        const landmarks = this.handTracker.allHandsLandmarks[0];
        const pts = [];
        for (let i = 0; i < 21; i++) {
            pts[i] = {
                x: (1 - landmarks[i].x) * mw,
                y: landmarks[i].y * mh
            };
        }

        // Connections
        const connections = [
            [0,1],[1,2],[2,3],[3,4],       // Thumb
            [0,5],[5,6],[6,7],[7,8],       // Index
            [5,9],[9,10],[10,11],[11,12],   // Middle
            [9,13],[13,14],[14,15],[15,16], // Ring
            [13,17],[17,18],[18,19],[19,20],// Pinky
            [0,17]                          // Palm base
        ];

        mc.beginPath();
        for (const [a, b] of connections) {
            mc.moveTo(pts[a].x, pts[a].y);
            mc.lineTo(pts[b].x, pts[b].y);
        }
        mc.strokeStyle = 'rgba(0, 255, 128, 0.7)';
        mc.lineWidth = 1.5;
        mc.stroke();

        // Joints
        for (let i = 0; i < 21; i++) {
            mc.beginPath();
            mc.arc(pts[i].x, pts[i].y, 2.5, 0, Math.PI * 2);
            mc.fillStyle = [4,8,12,16,20].includes(i) ? '#00ff80' : 'rgba(255,255,255,0.8)';
            mc.fill();
        }
    }

    // ==================== GAME LOOP ====================
    gameLoop(timestamp) {
        if (!this.isPlaying) return;

        const deltaTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(this.gameLoop);
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new FruitNinjaGame();
});
