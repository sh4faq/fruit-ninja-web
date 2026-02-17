// Polyfill for roundRect (older browsers)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

const Utils = {
    random: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomFrom: (arr) => arr[Math.floor(Math.random() * arr.length)],
    distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    pointInCircle: (px, py, cx, cy, radius) => Utils.distance(px, py, cx, cy) <= radius,
    lineIntersectsCircle: (x1, y1, x2, y2, cx, cy, radius) => {
        const dx = x2 - x1, dy = y2 - y1;
        const fx = x1 - cx, fy = y1 - cy;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;
        let disc = b * b - 4 * a * c;
        if (disc < 0) return false;
        disc = Math.sqrt(disc);
        const t1 = (-b - disc) / (2 * a);
        const t2 = (-b + disc) / (2 * a);
        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    },
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    degToRad: (deg) => deg * (Math.PI / 180),
    radToDeg: (rad) => rad * (180 / Math.PI),
    easeOutQuad: (t) => t * (2 - t),
    easeInQuad: (t) => t * t,
    easeOutBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

// ==================== FRUIT TYPES ====================
const FRUIT_TYPES = [
    { name: 'apple', color: '#e74c3c', innerColor: '#fadbd8', highlight: '#ff6b6b', shadow: '#c0392b', points: 1 },
    { name: 'orange', color: '#f39c12', innerColor: '#fdebd0', highlight: '#f5b041', shadow: '#d68910', points: 1 },
    { name: 'watermelon', color: '#27ae60', innerColor: '#ff6b6b', highlight: '#2ecc71', shadow: '#1e8449', points: 3 },
    { name: 'coconut', color: '#8b5a2b', innerColor: '#fdfefe', highlight: '#a0522d', shadow: '#5d4037', points: 2 },
    { name: 'lemon', color: '#f1c40f', innerColor: '#fcf3cf', highlight: '#f4d03f', shadow: '#d4ac0d', points: 1 },
    { name: 'grape', color: '#8e44ad', innerColor: '#e8daef', highlight: '#9b59b6', shadow: '#6c3483', points: 1 },
    { name: 'kiwi', color: '#795548', innerColor: '#a5d610', highlight: '#8d6e63', shadow: '#5d4037', points: 2 },
    { name: 'peach', color: '#ffab91', innerColor: '#fff3e0', highlight: '#ffccbc', shadow: '#e64a19', points: 1 }
];

// Arcade-only special fruit types
const SPECIAL_FRUIT_TYPES = {
    freeze:  { name: 'freeze',  color: '#00bcd4', innerColor: '#e0f7fa', highlight: '#4dd0e1', shadow: '#00838f', points: 0, special: 'freeze' },
    frenzy:  { name: 'frenzy',  color: '#ff1744', innerColor: '#ffcdd2', highlight: '#ff5252', shadow: '#c62828', points: 0, special: 'frenzy' },
    double:  { name: 'double',  color: '#ffd600', innerColor: '#fff9c4', highlight: '#ffff00', shadow: '#f9a825', points: 0, special: 'double' },
};

// ==================== GAME MODE CONFIGS ====================
const MODE_CONFIGS = {
    classic: {
        name: 'Classic',
        description: '3 lives. Miss a fruit = lose a life. Bombs = game over.',
        icon: '&#9876;',
        maxLives: 3,
        hasTimer: false,
        hasBombs: true,
        bombPenalty: 'gameover',
        hasSpecialFruits: false,
        hasLevels: true,
        hasChapters: true,
        fruitSpawnInterval: 1500,
        gravity: 0.15,
        minFruitSpeed: 12,
        maxFruitSpeed: 16,
    },
    arcade: {
        name: 'Arcade',
        description: '60 seconds. Special fruits & powerups. Bombs = -10 pts.',
        icon: '&#9201;',
        maxLives: 999,
        hasTimer: true,
        timerDuration: 60,
        hasBombs: true,
        bombPenalty: 'points',
        bombPointPenalty: 10,
        hasSpecialFruits: true,
        specialFruitChance: 0.08,
        hasLevels: true,
        fruitSpawnInterval: 1300,
        gravity: 0.15,
        minFruitSpeed: 12,
        maxFruitSpeed: 17,
    },
    zen: {
        name: 'Zen',
        description: '90 seconds of peace. No bombs. No pressure. Just slice.',
        icon: '&#9775;',
        maxLives: 999,
        hasTimer: true,
        timerDuration: 90,
        hasBombs: false,
        bombPenalty: 'none',
        hasSpecialFruits: false,
        hasLevels: false,
        fruitSpawnInterval: 1200,
        gravity: 0.12,
        minFruitSpeed: 10,
        maxFruitSpeed: 14,
    }
};

// ==================== LEVEL PROGRESSION ====================
// Each level adjusts spawn interval, speed, and bomb chance
const LEVEL_CONFIG = {
    fruitsPerLevel: 15,    // Fruits sliced to advance
    maxLevel: 99,
    // Per-level multipliers (applied to base mode config)
    levels: {
        1:  { spawnMult: 1.0,  speedMult: 1.0,  bombChance: 0.04 },
        2:  { spawnMult: 0.93, speedMult: 1.05, bombChance: 0.05 },
        3:  { spawnMult: 0.86, speedMult: 1.10, bombChance: 0.06 },
        4:  { spawnMult: 0.80, speedMult: 1.15, bombChance: 0.07 },
        5:  { spawnMult: 0.74, speedMult: 1.22, bombChance: 0.08 },
        6:  { spawnMult: 0.68, speedMult: 1.30, bombChance: 0.10 },
        7:  { spawnMult: 0.62, speedMult: 1.38, bombChance: 0.12 },
        8:  { spawnMult: 0.56, speedMult: 1.46, bombChance: 0.14 },
        9:  { spawnMult: 0.50, speedMult: 1.55, bombChance: 0.16 },
        10: { spawnMult: 0.45, speedMult: 1.65, bombChance: 0.18 },
    },
    // For levels > 10, use this formula
    getLevel(lvl) {
        if (lvl <= 10) return this.levels[lvl] || this.levels[10];
        // Beyond 10, keep scaling but slower
        return {
            spawnMult: Math.max(0.3, 0.45 - (lvl - 10) * 0.015),
            speedMult: 1.65 + (lvl - 10) * 0.08,
            bombChance: Math.min(0.25, 0.18 + (lvl - 10) * 0.01),
        };
    }
};

// ==================== DIFFICULTY PRESETS ====================
const DIFFICULTY_PRESETS = {
    easy:   { speedMult: 0.8, spawnMult: 1.2, bombMult: 0.6, label: 'Easy' },
    normal: { speedMult: 1.0, spawnMult: 1.0, bombMult: 1.0, label: 'Normal' },
    hard:   { speedMult: 1.25, spawnMult: 0.75, bombMult: 1.4, label: 'Hard' },
};

// ==================== SETTINGS DEFAULTS ====================
const DEFAULT_SETTINGS = {
    sensitivity: 'medium',   // low, medium, high
    cameraMirror: true,
    difficulty: 'normal',    // easy, normal, hard
};

const SENSITIVITY_MAP = {
    low:    { velocityThreshold: 6, smoothing: 0.55 },
    medium: { velocityThreshold: 4, smoothing: 0.7 },
    high:   { velocityThreshold: 2, smoothing: 0.85 },
};

// ==================== SHARED GAME CONFIG (base, overridden by mode) ====================
const GAME_CONFIG = {
    fruitRadius: 55,
    sliceTrailLength: 12,
    comboTimeWindow: 1000,
    minScoreForBombs: 80,
    gravity: 0.15,
    minFruitSpeed: 12,
    maxFruitSpeed: 16,
};

// ==================== CHAPTER SYSTEM ====================
function toRoman(num) {
    const vals = [10, 9, 5, 4, 1];
    const syms = ['X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    for (let i = 0; i < vals.length; i++) {
        while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    }
    return result;
}

const CHAPTER_CONFIG = {
    chapters: [
        {
            id: 1,
            name: 'The Dojo',
            tagline: 'Begin your training',
            levels: [1, 2],
            accent: '#c49a6c',
            vignette: 'rgba(80, 50, 20, 0.12)',
            wavesPerLevel: [3, 4],
            fruitsPerWave: [3, 4],
            fruitsPerWaveMax: [5, 6],
            wavePause: 1200,
        },
        {
            id: 2,
            name: 'Bamboo Grove',
            tagline: 'The blade grows sharper',
            levels: [3, 4, 5],
            accent: '#6dba5e',
            vignette: 'rgba(30, 80, 20, 0.10)',
            wavesPerLevel: [4, 5, 5],
            fruitsPerWave: [4, 5, 5],
            fruitsPerWaveMax: [6, 7, 8],
            wavePause: 1100,
        },
        {
            id: 3,
            name: 'The Marketplace',
            tagline: 'Faster hands, richer bounty',
            levels: [6, 7],
            accent: '#e8a642',
            vignette: 'rgba(100, 70, 10, 0.10)',
            wavesPerLevel: [5, 6],
            fruitsPerWave: [5, 6],
            fruitsPerWaveMax: [8, 9],
            wavePause: 1000,
        },
        {
            id: 4,
            name: 'Shadow Temple',
            tagline: 'Darkness tests the worthy',
            levels: [8, 9, 10],
            accent: '#8a5ecf',
            vignette: 'rgba(50, 20, 80, 0.12)',
            wavesPerLevel: [6, 6, 7],
            fruitsPerWave: [6, 6, 7],
            fruitsPerWaveMax: [9, 10, 10],
            wavePause: 900,
        },
        {
            id: 5,
            name: "Dragon's Peak",
            tagline: 'Only legends survive',
            levels: [11, 12, 13],
            accent: '#e74c3c',
            vignette: 'rgba(100, 20, 10, 0.12)',
            wavesPerLevel: [7, 7, 8],
            fruitsPerWave: [7, 7, 8],
            fruitsPerWaveMax: [10, 11, 12],
            wavePause: 800,
        },
    ],

    getChapterForLevel(level) {
        for (const chapter of this.chapters) {
            if (chapter.levels.includes(level)) return chapter;
        }
        // Beyond defined chapters: endless scaling
        return {
            id: Math.floor((level - 14) / 3) + 6,
            name: 'The Endless Path',
            tagline: 'No master ever rests',
            levels: [level],
            accent: '#e74c3c',
            vignette: 'rgba(100, 20, 10, 0.12)',
            wavesPerLevel: [Math.min(10, 7 + Math.floor((level - 13) / 2))],
            fruitsPerWave: [Math.min(10, 7 + Math.floor((level - 13) / 3))],
            fruitsPerWaveMax: [Math.min(15, 10 + Math.floor((level - 13) / 2))],
            wavePause: Math.max(600, 800 - (level - 13) * 20),
        };
    },

    isNewChapter(level) {
        return this.chapters.some(ch => ch.levels[0] === level);
    },

    getLevelIndexInChapter(level) {
        const chapter = this.getChapterForLevel(level);
        return Math.max(0, chapter.levels.indexOf(level));
    }
};
