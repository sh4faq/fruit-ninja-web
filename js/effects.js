// Visual effects - particles, slice trails, juice splatter

class Particle {
    constructor(x, y, color, options = {}) {
        this.x = x;
        this.y = y;
        this.color = color;

        this.size = options.size || Utils.random(3, 8);
        this.vx = options.vx || Utils.random(-5, 5);
        this.vy = options.vy || Utils.random(-8, -2);
        this.gravity = options.gravity || 0.3;
        this.life = options.life || 1;
        this.decay = options.decay || Utils.random(0.02, 0.04);
        this.rotation = Utils.random(0, Math.PI * 2);
        this.rotationSpeed = Utils.random(-0.2, 0.2);
    }

    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
        ctx.globalAlpha = 1;
    }

    isDead() {
        return this.life <= 0;
    }
}

class JuiceSplatter {
    constructor(x, y, color) {
        this.particles = [];

        // Juice droplets burst outward
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y, color, {
                size: Utils.random(4, 14),
                vx: Utils.random(-14, 14),
                vy: Utils.random(-14, 4),
                gravity: 0.4,
                decay: Utils.random(0.03, 0.05)
            }));
        }
    }

    update() {
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => !p.isDead());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    isDead() {
        return this.particles.length === 0;
    }
}

// Official Fruit Ninja style blade trail - thin white-blue luminous slash
class SliceTrail {
    constructor() {
        this.points = [];
        this.maxPoints = GAME_CONFIG.sliceTrailLength;
    }

    addPoint(x, y) {
        this.points.unshift({ x, y, life: 1, time: performance.now() });
        if (this.points.length > this.maxPoints) {
            this.points.pop();
        }
    }

    update() {
        this.points.forEach(point => {
            point.life -= 0.1;
        });
        this.points = this.points.filter(p => p.life > 0);
    }

    draw(ctx) {
        if (this.points.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Outer glow - wider, soft blue
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.strokeStyle = 'rgba(120, 180, 255, 0.25)';
        ctx.lineWidth = 24;
        ctx.stroke();

        // Mid glow - medium white-blue
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.strokeStyle = 'rgba(180, 210, 255, 0.5)';
        ctx.lineWidth = 10;
        ctx.stroke();

        // Core - bright white, thin (the actual blade edge)
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    clear() {
        this.points = [];
    }
}

class ScorePopup {
    constructor(x, y, score, isCombo = false) {
        this.x = x;
        this.y = y;
        this.score = score;
        this.isCombo = isCombo;
        this.life = 1;
        this.vy = -3;
        this.scale = isCombo ? 1.5 : 1;
    }

    update() {
        this.y += this.vy;
        this.vy *= 0.95;
        this.life -= 0.025;
        if (this.scale > 1) this.scale *= 0.97;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);

        const fontSize = this.isCombo ? 38 : 28;
        ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
        ctx.textAlign = 'center';

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(`+${this.score}`, 2, 2);

        // Text color
        ctx.fillStyle = this.isCombo ? '#ffcc00' : '#ffffff';
        ctx.fillText(`+${this.score}`, 0, 0);

        // Glow for combos
        if (this.isCombo) {
            ctx.shadowColor = 'rgba(255, 200, 0, 0.6)';
            ctx.shadowBlur = 10;
            ctx.fillText(`+${this.score}`, 0, 0);
        }

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// Effects manager
class EffectsManager {
    constructor() {
        this.splatters = [];
        this.popups = [];
        // One independent trail per finger (5 fingers)
        this.sliceTrails = [new SliceTrail(), new SliceTrail(), new SliceTrail(), new SliceTrail(), new SliceTrail()];
        this.sliceTrail = this.sliceTrails[1]; // index finger default
    }

    addSplatter(x, y, color) {
        if (this.splatters.length >= 6) {
            this.splatters.shift();
        }
        this.splatters.push(new JuiceSplatter(x, y, color));
    }

    addScorePopup(x, y, score, isCombo = false) {
        if (this.popups.length >= 8) {
            this.popups.shift();
        }
        this.popups.push(new ScorePopup(x, y, score, isCombo));
    }

    updateSliceTrail(x, y, fingerIndex) {
        if (x !== null && y !== null && fingerIndex >= 0 && fingerIndex < 5) {
            this.sliceTrails[fingerIndex].addPoint(x, y);
        }
    }

    update() {
        this.splatters.forEach(s => s.update());
        this.splatters = this.splatters.filter(s => !s.isDead());

        this.popups.forEach(p => p.update());
        this.popups = this.popups.filter(p => !p.isDead());

        for (let i = 0; i < 5; i++) {
            this.sliceTrails[i].update();
        }
    }

    draw(ctx) {
        // Draw blade trails first (behind everything else)
        for (let i = 0; i < 5; i++) {
            this.sliceTrails[i].draw(ctx);
        }
        this.splatters.forEach(s => s.draw(ctx));
        this.popups.forEach(p => p.draw(ctx));
    }

    clearTrail() {
        for (let i = 0; i < 5; i++) {
            this.sliceTrails[i].clear();
        }
    }

    showLevelUp(level, accentColor) {
        const overlay = document.getElementById('levelup-overlay');
        const numberEl = document.getElementById('levelup-number');
        if (!overlay || !numberEl) return;

        numberEl.textContent = level;
        overlay.classList.remove('hidden');

        // Apply chapter accent color if provided
        const textEl = document.getElementById('levelup-text');
        if (textEl) {
            if (accentColor) {
                textEl.style.color = accentColor;
                textEl.style.textShadow = `0 4px 0 rgba(0,0,0,0.4), 0 0 60px ${accentColor}66, 4px 4px 10px rgba(0,0,0,0.9)`;
            } else {
                textEl.style.color = '';
                textEl.style.textShadow = '';
            }

            // Force re-trigger animation
            textEl.style.animation = 'none';
            textEl.offsetHeight; // reflow
            textEl.style.animation = null;
        }

        // Hide after animation completes
        clearTimeout(this._levelUpTimer);
        this._levelUpTimer = setTimeout(() => {
            overlay.classList.add('hidden');
        }, 1500);
    }
}
