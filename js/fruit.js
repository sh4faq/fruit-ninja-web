// Fruit class - photorealistic fruit rendering with advanced canvas techniques

// Static cache for pre-rendered fruits
const FruitCache = {
    cache: {},
    halfCache: {},

    getKey(type, radius, isHalf = false, halfSide = null) {
        const r = Math.round(radius);
        return isHalf ? `${type.name}_${r}_${halfSide}` : `${type.name}_${r}`;
    },

    get(type, radius) {
        const key = this.getKey(type, radius);
        return this.cache[key] || null;
    },

    set(type, radius, canvas) {
        const key = this.getKey(type, radius);
        this.cache[key] = canvas;
    },

    getHalf(type, radius, halfSide) {
        const key = this.getKey(type, radius, true, halfSide);
        return this.halfCache[key] || null;
    },

    setHalf(type, radius, halfSide, canvas) {
        const key = this.getKey(type, radius, true, halfSide);
        this.halfCache[key] = canvas;
    }
};

class Fruit {
    constructor(canvas, type = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.type = type || Utils.randomFrom(FRUIT_TYPES);

        this.radius = Math.round(GAME_CONFIG.fruitRadius + Utils.random(-10, 10));

        this.x = Utils.random(this.radius + 100, canvas.width - this.radius - 100);
        this.y = canvas.height + this.radius;

        const angle = Utils.random(-0.3, 0.3);
        const speed = Utils.random(GAME_CONFIG.minFruitSpeed, GAME_CONFIG.maxFruitSpeed);
        this.vx = Math.sin(angle) * speed * 0.8;
        this.vy = -speed * 1.1;

        this.rotation = 0;
        this.rotationSpeed = Utils.random(-0.1, 0.1);

        this.isSliced = false;
        this.isOffScreen = false;
        this.sliceAngle = 0;

        this.isHalf = false;
        this.halfSide = null;
    }

    update() {
        if (this.isOffScreen) return;
        this.vy += GAME_CONFIG.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        if (this.y > this.canvas.height + this.radius * 2) {
            this.isOffScreen = true;
        }
    }

    draw() {
        if (this.isOffScreen) return;

        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.isHalf) {
            this.drawHalfCached(ctx);
        } else {
            this.drawWholeCached(ctx);
        }

        ctx.restore();
    }

    drawWholeCached(ctx) {
        let cached = FruitCache.get(this.type, this.radius);

        if (!cached) {
            const size = Math.ceil(this.radius * 3);
            cached = document.createElement('canvas');
            cached.width = size;
            cached.height = size;
            const offCtx = cached.getContext('2d');
            offCtx.translate(size / 2, size / 2);
            this.drawWhole(offCtx);
            FruitCache.set(this.type, this.radius, cached);
        }

        const size = cached.width;
        ctx.drawImage(cached, -size / 2, -size / 2);
    }

    drawHalfCached(ctx) {
        let cached = FruitCache.getHalf(this.type, this.radius, this.halfSide);

        if (!cached) {
            const size = Math.ceil(this.radius * 3);
            cached = document.createElement('canvas');
            cached.width = size;
            cached.height = size;
            const offCtx = cached.getContext('2d');
            offCtx.translate(size / 2, size / 2);
            this.drawHalf(offCtx);
            FruitCache.setHalf(this.type, this.radius, this.halfSide, cached);
        }

        const size = cached.width;
        ctx.drawImage(cached, -size / 2, -size / 2);
    }

    drawWhole(ctx) {
        const r = this.radius;
        switch(this.type.name) {
            case 'apple': this.drawApple(ctx, r); break;
            case 'orange': this.drawOrange(ctx, r); break;
            case 'watermelon': this.drawWatermelon(ctx, r); break;
            case 'coconut': this.drawCoconut(ctx, r); break;
            case 'lemon': this.drawLemon(ctx, r); break;
            case 'grape': this.drawGrape(ctx, r); break;
            case 'kiwi': this.drawKiwi(ctx, r); break;
            case 'peach': this.drawPeach(ctx, r); break;
            default: this.drawGenericFruit(ctx, r, this.type);
        }
    }

    // ============ HELPER: soft shadow under fruit ============
    _drawShadow(ctx, r, rx = r, ry = r) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(4, 5, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.filter = 'blur(4px)';
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
    }

    // ============ HELPER: specular highlight (sharp white spot) ============
    _drawSpecular(ctx, x, y, size) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, size);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        g.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        g.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
    }

    // ============ HELPER: broad diffuse highlight ============
    _drawDiffuseHighlight(ctx, x, y, rx, ry, angle) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
        g.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        g.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
    }

    // ============ HELPER: ambient occlusion ring (dark edge) ============
    _drawAO(ctx, r, color = 'rgba(0,0,0,0.2)') {
        const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, color);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
    }

    // ==================== APPLE ====================
    drawApple(ctx, r) {
        this._drawShadow(ctx, r);

        // Apple body shape
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.82);
        ctx.bezierCurveTo(r * 0.85, -r * 0.88, r * 1.1, -r * 0.25, r * 0.92, r * 0.42);
        ctx.bezierCurveTo(r * 0.78, r * 1.02, r * 0.28, r * 1.06, 0, r * 0.95);
        ctx.bezierCurveTo(-r * 0.28, r * 1.06, -r * 0.78, r * 1.02, -r * 0.92, r * 0.42);
        ctx.bezierCurveTo(-r * 1.1, -r * 0.25, -r * 0.85, -r * 0.88, 0, -r * 0.82);
        ctx.closePath();

        // Base color - rich deep red with warm gradient
        const base = ctx.createRadialGradient(-r * 0.15, -r * 0.1, 0, 0, r * 0.1, r * 1.3);
        base.addColorStop(0, '#ff4040');
        base.addColorStop(0.25, '#e63535');
        base.addColorStop(0.5, '#cc2929');
        base.addColorStop(0.75, '#a31e1e');
        base.addColorStop(1, '#7a1515');
        ctx.fillStyle = base;
        ctx.fill();

        // Green patch (like real apples have near stem)
        ctx.save();
        ctx.clip();
        const greenPatch = ctx.createRadialGradient(r * 0.1, -r * 0.6, 0, r * 0.1, -r * 0.6, r * 0.5);
        greenPatch.addColorStop(0, 'rgba(80, 160, 50, 0.35)');
        greenPatch.addColorStop(0.6, 'rgba(80, 160, 50, 0.12)');
        greenPatch.addColorStop(1, 'rgba(80, 160, 50, 0)');
        ctx.fillStyle = greenPatch;
        ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);

        // Warm color variation patches
        const warm = ctx.createRadialGradient(r * 0.3, r * 0.2, 0, r * 0.3, r * 0.2, r * 0.6);
        warm.addColorStop(0, 'rgba(200, 30, 20, 0.3)');
        warm.addColorStop(1, 'rgba(200, 30, 20, 0)');
        ctx.fillStyle = warm;
        ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
        ctx.restore();

        // Rebuild clip path for AO
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.82);
        ctx.bezierCurveTo(r * 0.85, -r * 0.88, r * 1.1, -r * 0.25, r * 0.92, r * 0.42);
        ctx.bezierCurveTo(r * 0.78, r * 1.02, r * 0.28, r * 1.06, 0, r * 0.95);
        ctx.bezierCurveTo(-r * 0.28, r * 1.06, -r * 0.78, r * 1.02, -r * 0.92, r * 0.42);
        ctx.bezierCurveTo(-r * 1.1, -r * 0.25, -r * 0.85, -r * 0.88, 0, -r * 0.82);
        ctx.closePath();

        // Ambient occlusion (darker edges)
        ctx.save();
        ctx.clip();
        const ao = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.1);
        ao.addColorStop(0, 'rgba(0,0,0,0)');
        ao.addColorStop(0.85, 'rgba(0,0,0,0)');
        ao.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = ao;
        ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
        ctx.restore();

        // Broad diffuse highlight (upper left)
        this._drawDiffuseHighlight(ctx, -r * 0.3, -r * 0.35, r * 0.4, r * 0.28, -0.4);

        // Specular highlight (sharp white spot)
        this._drawSpecular(ctx, -r * 0.32, -r * 0.42, r * 0.18);

        // Secondary tiny specular
        this._drawSpecular(ctx, -r * 0.15, -r * 0.55, r * 0.07);

        // Stem
        ctx.beginPath();
        ctx.moveTo(-1, -r * 0.78);
        ctx.bezierCurveTo(0, -r * 1.0, 3, -r * 1.15, 6, -r * 1.22);
        ctx.strokeStyle = '#4a3520';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        // Stem highlight
        ctx.strokeStyle = 'rgba(120, 90, 60, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Leaf
        ctx.beginPath();
        ctx.moveTo(6, -r * 1.18);
        ctx.quadraticCurveTo(r * 0.55, -r * 1.42, r * 0.45, -r * 1.02);
        ctx.quadraticCurveTo(r * 0.25, -r * 1.22, 6, -r * 1.18);
        const leafGrad = ctx.createLinearGradient(6, -r * 1.4, r * 0.45, -r * 1.0);
        leafGrad.addColorStop(0, '#2d8a3e');
        leafGrad.addColorStop(0.5, '#3cb44b');
        leafGrad.addColorStop(1, '#228833');
        ctx.fillStyle = leafGrad;
        ctx.fill();

        // Leaf vein
        ctx.beginPath();
        ctx.moveTo(8, -r * 1.16);
        ctx.quadraticCurveTo(r * 0.35, -r * 1.28, r * 0.4, -r * 1.08);
        ctx.strokeStyle = 'rgba(25, 80, 30, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // ==================== ORANGE ====================
    drawOrange(ctx, r) {
        this._drawShadow(ctx, r);

        // Main sphere
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);

        const base = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r * 1.1);
        base.addColorStop(0, '#ffb74d');
        base.addColorStop(0.3, '#ff9800');
        base.addColorStop(0.6, '#f57c00');
        base.addColorStop(0.85, '#e65100');
        base.addColorStop(1, '#bf360c');
        ctx.fillStyle = base;
        ctx.fill();

        // Peel texture - many small bumps
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < 80; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * r * 0.92;
            const bx = Math.cos(angle) * dist;
            const by = Math.sin(angle) * dist;
            const bumpR = 1.5 + Math.random() * 2.5;

            ctx.beginPath();
            ctx.arc(bx, by, bumpR, 0, Math.PI * 2);
            ctx.fillStyle = Math.random() > 0.5
                ? 'rgba(255, 200, 120, 0.18)'
                : 'rgba(200, 100, 0, 0.12)';
            ctx.fill();
        }
        ctx.restore();

        // Ambient occlusion
        this._drawAO(ctx, r, 'rgba(120, 40, 0, 0.2)');

        // Subsurface scattering glow (warm orange light passing through)
        const sss = ctx.createRadialGradient(r * 0.4, r * 0.3, 0, r * 0.4, r * 0.3, r * 0.7);
        sss.addColorStop(0, 'rgba(255, 180, 80, 0.15)');
        sss.addColorStop(1, 'rgba(255, 180, 80, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = sss;
        ctx.fill();

        // Diffuse highlight
        this._drawDiffuseHighlight(ctx, -r * 0.3, -r * 0.3, r * 0.38, r * 0.25, -0.5);

        // Specular
        this._drawSpecular(ctx, -r * 0.3, -r * 0.35, r * 0.16);
        this._drawSpecular(ctx, -r * 0.12, -r * 0.48, r * 0.06);

        // Navel (bottom dimple)
        ctx.beginPath();
        ctx.arc(0, r * 0.72, r * 0.14, 0, Math.PI * 2);
        const navelG = ctx.createRadialGradient(0, r * 0.72, 0, 0, r * 0.72, r * 0.14);
        navelG.addColorStop(0, 'rgba(180, 80, 0, 0.5)');
        navelG.addColorStop(0.6, 'rgba(200, 100, 20, 0.3)');
        navelG.addColorStop(1, 'rgba(200, 100, 20, 0)');
        ctx.fillStyle = navelG;
        ctx.fill();

        // Tiny stem dimple at top
        ctx.beginPath();
        ctx.arc(0, -r * 0.82, r * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 60, 20, 0.4)';
        ctx.fill();
    }

    // ==================== WATERMELON ====================
    drawWatermelon(ctx, r) {
        const rx = r * 1.2;
        const ry = r * 0.9;
        this._drawShadow(ctx, r, rx, ry);

        // Main body
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

        const base = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 0, 0, 0, rx);
        base.addColorStop(0, '#4caf50');
        base.addColorStop(0.4, '#388e3c');
        base.addColorStop(0.7, '#2e7d32');
        base.addColorStop(1, '#1b5e20');
        ctx.fillStyle = base;
        ctx.fill();

        // Dark stripes
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();

        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(i * r * 0.32, -ry * 1.1);
            ctx.bezierCurveTo(
                i * r * 0.34 + r * 0.05, -ry * 0.3,
                i * r * 0.34 - r * 0.05, ry * 0.3,
                i * r * 0.32, ry * 1.1
            );
            const stripeW = 10 + Math.random() * 6;
            ctx.lineWidth = stripeW;
            ctx.strokeStyle = 'rgba(27, 80, 20, 0.55)';
            ctx.lineCap = 'round';
            ctx.stroke();

            // Stripe inner lighter line
            ctx.lineWidth = stripeW * 0.3;
            ctx.strokeStyle = 'rgba(50, 120, 40, 0.2)';
            ctx.stroke();
        }
        ctx.restore();

        // Ambient occlusion
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        const ao = ctx.createRadialGradient(0, 0, Math.min(rx, ry) * 0.6, 0, 0, rx);
        ao.addColorStop(0, 'rgba(0,0,0,0)');
        ao.addColorStop(0.8, 'rgba(0,0,0,0)');
        ao.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = ao;
        ctx.fill();

        // Highlight
        this._drawDiffuseHighlight(ctx, -rx * 0.3, -ry * 0.3, rx * 0.35, ry * 0.22, -0.3);
        this._drawSpecular(ctx, -rx * 0.28, -ry * 0.35, r * 0.14);

        // Subtle waxy sheen
        ctx.beginPath();
        ctx.ellipse(-rx * 0.15, -ry * 0.15, rx * 0.6, ry * 0.4, -0.2, 0, Math.PI * 2);
        const sheen = ctx.createRadialGradient(-rx * 0.15, -ry * 0.15, 0, -rx * 0.15, -ry * 0.15, rx * 0.6);
        sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
        sheen.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen;
        ctx.fill();
    }

    // ==================== COCONUT ====================
    drawCoconut(ctx, r) {
        this._drawShadow(ctx, r);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);

        const base = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
        base.addColorStop(0, '#a07050');
        base.addColorStop(0.3, '#8b5e3c');
        base.addColorStop(0.6, '#6d4228');
        base.addColorStop(1, '#3e2415');
        ctx.fillStyle = base;
        ctx.fill();

        // Fibrous hair texture
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < 50; i++) {
            const sa = Math.random() * Math.PI * 2;
            const len = r * 0.25 + Math.random() * r * 0.6;
            const startR = r * 0.15 + Math.random() * r * 0.3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(sa) * startR, Math.sin(sa) * startR);
            const cx = Math.cos(sa + 0.2) * len;
            const cy = Math.sin(sa + 0.2) * len;
            ctx.quadraticCurveTo(cx, cy, Math.cos(sa + 0.4) * len * 0.9, Math.sin(sa + 0.4) * len * 0.9);
            ctx.strokeStyle = `rgba(${60 + Math.random() * 40}, ${30 + Math.random() * 30}, ${15 + Math.random() * 15}, ${0.15 + Math.random() * 0.2})`;
            ctx.lineWidth = 0.8 + Math.random() * 1.2;
            ctx.stroke();
        }
        ctx.restore();

        this._drawAO(ctx, r, 'rgba(30, 15, 5, 0.3)');

        // Three eyes
        const eyes = [[-r * 0.22, -r * 0.08], [r * 0.22, -r * 0.08], [0, r * 0.22]];
        eyes.forEach(([ex, ey]) => {
            ctx.beginPath();
            ctx.ellipse(ex, ey, r * 0.1, r * 0.13, 0, 0, Math.PI * 2);
            const eyeG = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 0.13);
            eyeG.addColorStop(0, '#1a0e05');
            eyeG.addColorStop(0.7, '#2d1a0c');
            eyeG.addColorStop(1, '#3e2415');
            ctx.fillStyle = eyeG;
            ctx.fill();
        });

        this._drawDiffuseHighlight(ctx, -r * 0.35, -r * 0.35, r * 0.3, r * 0.2, -0.5);
        this._drawSpecular(ctx, -r * 0.35, -r * 0.4, r * 0.12);
    }

    // ==================== LEMON ====================
    drawLemon(ctx, r) {
        const rx = r * 1.2;
        const ry = r * 0.82;
        this._drawShadow(ctx, r, rx, ry);

        // Lemon shape with pointed ends
        ctx.beginPath();
        ctx.moveTo(-rx * 1.05, 0);
        ctx.bezierCurveTo(-rx * 0.95, -ry * 0.85, -rx * 0.4, -ry * 1.05, 0, -ry * 0.98);
        ctx.bezierCurveTo(rx * 0.4, -ry * 1.05, rx * 0.95, -ry * 0.85, rx * 1.05, 0);
        ctx.bezierCurveTo(rx * 0.95, ry * 0.85, rx * 0.4, ry * 1.05, 0, ry * 0.98);
        ctx.bezierCurveTo(-rx * 0.4, ry * 1.05, -rx * 0.95, ry * 0.85, -rx * 1.05, 0);
        ctx.closePath();

        const base = ctx.createRadialGradient(-r * 0.2, -r * 0.15, 0, 0, 0, rx * 1.2);
        base.addColorStop(0, '#fff59d');
        base.addColorStop(0.3, '#ffee58');
        base.addColorStop(0.55, '#fdd835');
        base.addColorStop(0.8, '#f9a825');
        base.addColorStop(1, '#f57f17');
        ctx.fillStyle = base;
        ctx.fill();

        // Skin texture pores
        ctx.save();
        ctx.clip();
        for (let i = 0; i < 50; i++) {
            const px = (Math.random() - 0.5) * rx * 2.2;
            const py = (Math.random() - 0.5) * ry * 2.2;
            // Only draw inside the lemon shape
            if ((px * px) / (rx * rx) + (py * py) / (ry * ry) < 1) {
                ctx.beginPath();
                ctx.arc(px, py, 1 + Math.random() * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = Math.random() > 0.5
                    ? 'rgba(255, 245, 100, 0.3)'
                    : 'rgba(200, 160, 20, 0.15)';
                ctx.fill();
            }
        }
        ctx.restore();

        // Rebuild path for AO
        ctx.beginPath();
        ctx.moveTo(-rx * 1.05, 0);
        ctx.bezierCurveTo(-rx * 0.95, -ry * 0.85, -rx * 0.4, -ry * 1.05, 0, -ry * 0.98);
        ctx.bezierCurveTo(rx * 0.4, -ry * 1.05, rx * 0.95, -ry * 0.85, rx * 1.05, 0);
        ctx.bezierCurveTo(rx * 0.95, ry * 0.85, rx * 0.4, ry * 1.05, 0, ry * 0.98);
        ctx.bezierCurveTo(-rx * 0.4, ry * 1.05, -rx * 0.95, ry * 0.85, -rx * 1.05, 0);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        const ao = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, rx * 1.1);
        ao.addColorStop(0, 'rgba(0,0,0,0)');
        ao.addColorStop(0.85, 'rgba(0,0,0,0)');
        ao.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = ao;
        ctx.fillRect(-rx * 1.2, -ry * 1.2, rx * 2.4, ry * 2.4);
        ctx.restore();

        this._drawDiffuseHighlight(ctx, -r * 0.35, -r * 0.25, r * 0.4, r * 0.22, -0.3);
        this._drawSpecular(ctx, -r * 0.35, -r * 0.32, r * 0.15);
        this._drawSpecular(ctx, -r * 0.15, -r * 0.45, r * 0.06);

        // Tiny nub at each end
        ctx.beginPath();
        ctx.arc(rx * 1.0, 0, r * 0.06, 0, Math.PI * 2);
        ctx.fillStyle = '#d4ac0d';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-rx * 1.0, 0, r * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = '#c9a20a';
        ctx.fill();
    }

    // ==================== GRAPE BUNCH ====================
    drawGrape(ctx, r) {
        this._drawShadow(ctx, r);

        // Grape positions (clustered)
        const grapes = [
            { x: 0, y: -r * 0.48, s: r * 0.4 },
            { x: -r * 0.36, y: -r * 0.12, s: r * 0.38 },
            { x: r * 0.36, y: -r * 0.12, s: r * 0.38 },
            { x: -r * 0.18, y: r * 0.28, s: r * 0.36 },
            { x: r * 0.18, y: r * 0.28, s: r * 0.36 },
            { x: 0, y: r * 0.58, s: r * 0.33 },
        ];

        // Draw each grape with individual lighting
        grapes.forEach(({ x: gx, y: gy, s: gs }) => {
            ctx.beginPath();
            ctx.arc(gx, gy, gs, 0, Math.PI * 2);

            const g = ctx.createRadialGradient(gx - gs * 0.25, gy - gs * 0.25, 0, gx, gy, gs);
            g.addColorStop(0, '#c39bd3');
            g.addColorStop(0.3, '#9b59b6');
            g.addColorStop(0.65, '#7d3c98');
            g.addColorStop(1, '#512e5f');
            ctx.fillStyle = g;
            ctx.fill();

            // Grape AO (darkens where grapes overlap)
            const gao = ctx.createRadialGradient(gx, gy, gs * 0.6, gx, gy, gs);
            gao.addColorStop(0, 'rgba(0,0,0,0)');
            gao.addColorStop(1, 'rgba(40, 10, 50, 0.25)');
            ctx.fillStyle = gao;
            ctx.fill();

            // Specular on each grape
            this._drawSpecular(ctx, gx - gs * 0.25, gy - gs * 0.3, gs * 0.22);
        });

        // Stem
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.quadraticCurveTo(2, -r * 1.1, 0, -r * 1.25);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(100, 70, 40, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // ==================== KIWI ====================
    drawKiwi(ctx, r) {
        const rx = r * 1.1;
        const ry = r * 0.85;
        this._drawShadow(ctx, r, rx, ry);

        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

        const base = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 0, 0, 0, rx);
        base.addColorStop(0, '#a59275');
        base.addColorStop(0.3, '#8d7557');
        base.addColorStop(0.6, '#7a6245');
        base.addColorStop(1, '#5c4530');
        ctx.fillStyle = base;
        ctx.fill();

        // Fuzzy hair texture
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * rx * 0.95;
            const hx = Math.cos(angle) * dist;
            const hy = Math.sin(angle) * dist * (ry / rx);
            const hairLen = 2 + Math.random() * 4;
            const hairAngle = angle + (Math.random() - 0.5) * 0.8;

            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx + Math.cos(hairAngle) * hairLen, hy + Math.sin(hairAngle) * hairLen);
            ctx.strokeStyle = `rgba(${100 + Math.random() * 60}, ${75 + Math.random() * 40}, ${50 + Math.random() * 30}, ${0.2 + Math.random() * 0.25})`;
            ctx.lineWidth = 0.5 + Math.random() * 0.8;
            ctx.stroke();
        }
        ctx.restore();

        this._drawDiffuseHighlight(ctx, -rx * 0.3, -ry * 0.25, rx * 0.3, ry * 0.2, -0.3);
        this._drawSpecular(ctx, -rx * 0.3, -ry * 0.3, r * 0.1);
    }

    // ==================== PEACH ====================
    drawPeach(ctx, r) {
        this._drawShadow(ctx, r);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);

        // Peach base - soft pinkish-orange
        const base = ctx.createRadialGradient(-r * 0.15, -r * 0.2, 0, 0, 0, r);
        base.addColorStop(0, '#ffd9c0');
        base.addColorStop(0.3, '#ffb89e');
        base.addColorStop(0.5, '#ff9a76');
        base.addColorStop(0.75, '#f47850');
        base.addColorStop(1, '#d4542a');
        ctx.fillStyle = base;
        ctx.fill();

        // Red blush on one side
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();

        const blush = ctx.createRadialGradient(r * 0.35, -r * 0.1, 0, r * 0.35, -r * 0.1, r * 0.65);
        blush.addColorStop(0, 'rgba(220, 60, 30, 0.35)');
        blush.addColorStop(0.5, 'rgba(220, 60, 30, 0.15)');
        blush.addColorStop(1, 'rgba(220, 60, 30, 0)');
        ctx.fillStyle = blush;
        ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);

        // Yellow patch on opposite side
        const yellowPatch = ctx.createRadialGradient(-r * 0.4, r * 0.3, 0, -r * 0.4, r * 0.3, r * 0.5);
        yellowPatch.addColorStop(0, 'rgba(255, 220, 120, 0.2)');
        yellowPatch.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = yellowPatch;
        ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);

        // Velvety texture (very subtle dots)
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * r * 0.9;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 180, 0.15)';
            ctx.fill();
        }
        ctx.restore();

        // Crease line (the peach seam)
        ctx.beginPath();
        ctx.moveTo(r * 0.02, -r * 0.88);
        ctx.bezierCurveTo(r * 0.12, -r * 0.3, r * 0.08, r * 0.3, r * 0.02, r * 0.88);
        ctx.strokeStyle = 'rgba(180, 60, 25, 0.3)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Crease shadow side
        ctx.beginPath();
        ctx.moveTo(r * 0.04, -r * 0.86);
        ctx.bezierCurveTo(r * 0.14, -r * 0.3, r * 0.1, r * 0.3, r * 0.04, r * 0.86);
        ctx.strokeStyle = 'rgba(120, 40, 15, 0.15)';
        ctx.lineWidth = 4;
        ctx.stroke();

        this._drawAO(ctx, r, 'rgba(120, 40, 10, 0.18)');

        this._drawDiffuseHighlight(ctx, -r * 0.32, -r * 0.38, r * 0.32, r * 0.22, -0.5);
        this._drawSpecular(ctx, -r * 0.33, -r * 0.42, r * 0.16);
        this._drawSpecular(ctx, -r * 0.15, -r * 0.52, r * 0.06);

        // Stem
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.quadraticCurveTo(3, -r * 1.02, 5, -r * 1.1);
        ctx.strokeStyle = '#4a3520';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Leaf
        ctx.beginPath();
        ctx.moveTo(5, -r * 1.06);
        ctx.quadraticCurveTo(r * 0.45, -r * 1.28, r * 0.38, -r * 0.95);
        ctx.quadraticCurveTo(r * 0.2, -r * 1.12, 5, -r * 1.06);
        const leafG = ctx.createLinearGradient(5, -r * 1.3, r * 0.4, -r * 0.95);
        leafG.addColorStop(0, '#388e3c');
        leafG.addColorStop(1, '#2e7d32');
        ctx.fillStyle = leafG;
        ctx.fill();
    }

    drawGenericFruit(ctx, r, type) {
        this._drawShadow(ctx, r);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
        grad.addColorStop(0, type.highlight || type.color);
        grad.addColorStop(0.7, type.color);
        grad.addColorStop(1, type.shadow || type.color);
        ctx.fillStyle = grad;
        ctx.fill();

        this._drawSpecular(ctx, -r * 0.3, -r * 0.35, r * 0.15);
    }

    // ==================== SLICED HALVES ====================
    drawHalf(ctx) {
        const r = this.radius;
        const type = this.type;
        const isLeft = this.halfSide === 'left';
        const startAngle = isLeft ? Math.PI * 0.5 : -Math.PI * 0.5;
        const endAngle = isLeft ? Math.PI * 1.5 : Math.PI * 0.5;

        // Shadow
        ctx.beginPath();
        ctx.arc(3, 3, r, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();

        // Outer skin
        ctx.beginPath();
        ctx.arc(0, 0, r, startAngle, endAngle);
        ctx.closePath();

        const skinG = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
        skinG.addColorStop(0, type.highlight || type.color);
        skinG.addColorStop(0.6, type.color);
        skinG.addColorStop(1, type.shadow || type.color);
        ctx.fillStyle = skinG;
        ctx.fill();

        // Inner flesh - realistic gradient from white center to flesh color
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.85, startAngle, endAngle);
        ctx.closePath();

        const fleshG = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.85);
        fleshG.addColorStop(0, '#fffef5');
        fleshG.addColorStop(0.15, '#fff8e8');
        fleshG.addColorStop(0.4, type.innerColor);
        fleshG.addColorStop(0.8, type.innerColor);
        fleshG.addColorStop(1, type.shadow || type.innerColor);
        ctx.fillStyle = fleshG;
        ctx.fill();

        // Rind border between skin and flesh
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Seeds for watermelon
        if (type.name === 'watermelon') {
            ctx.fillStyle = '#1a1a1a';
            for (let i = 0; i < 8; i++) {
                const sa = startAngle + (endAngle - startAngle) * (0.15 + 0.7 * (i / 8));
                const sd = r * (0.35 + Math.random() * 0.25);
                const sx = Math.cos(sa) * sd;
                const sy = Math.sin(sa) * sd;
                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(sa + Math.PI / 2);
                ctx.beginPath();
                ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // Kiwi seeds
        if (type.name === 'kiwi') {
            // White starburst center
            const cx = isLeft ? -r * 0.15 : r * 0.15;
            ctx.beginPath();
            ctx.arc(cx, 0, r * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 240, 0.6)';
            ctx.fill();

            // Radial seed lines
            for (let i = 0; i < 10; i++) {
                const la = (i / 10) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(la) * r * 0.1, Math.sin(la) * r * 0.1);
                ctx.lineTo(cx + Math.cos(la) * r * 0.55, Math.sin(la) * r * 0.55);
                ctx.strokeStyle = 'rgba(255, 255, 230, 0.2)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Seeds scattered along ring
            ctx.fillStyle = '#1a1a1a';
            for (let i = 0; i < 18; i++) {
                const sa = (i / 18) * Math.PI * 2;
                const sd = r * (0.35 + Math.random() * 0.15);
                const sx = cx + Math.cos(sa) * sd;
                const sy = Math.sin(sa) * sd;
                ctx.beginPath();
                ctx.ellipse(sx, sy, 2.5, 1.2, sa, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Orange inner segments
        if (type.name === 'orange') {
            const cx = isLeft ? -r * 0.05 : r * 0.05;
            for (let i = 0; i < 8; i++) {
                const sa = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx, 0);
                ctx.lineTo(cx + Math.cos(sa) * r * 0.7, Math.sin(sa) * r * 0.7);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            // Center pith
            ctx.beginPath();
            ctx.arc(cx, 0, r * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
        }

        // Lemon segments
        if (type.name === 'lemon') {
            const cx = isLeft ? -r * 0.05 : r * 0.05;
            for (let i = 0; i < 8; i++) {
                const sa = (i / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx, 0);
                ctx.lineTo(cx + Math.cos(sa) * r * 0.65, Math.sin(sa) * r * 0.65);
                ctx.strokeStyle = 'rgba(255, 255, 220, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Apple core in center
        if (type.name === 'apple') {
            const cx = isLeft ? -r * 0.05 : r * 0.05;
            // Seed cavity
            ctx.beginPath();
            ctx.ellipse(cx, 0, r * 0.08, r * 0.2, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200, 180, 140, 0.4)';
            ctx.fill();
            // Seeds
            for (let s = -1; s <= 1; s += 2) {
                ctx.beginPath();
                ctx.ellipse(cx, s * r * 0.08, 3, 5, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#3e2723';
                ctx.fill();
            }
        }

        // Slice edge line
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Juice drip
        ctx.beginPath();
        ctx.ellipse(isLeft ? -2 : 2, r * 0.35, 3, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = type.innerColor;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Outline
        ctx.beginPath();
        ctx.arc(0, 0, r, startAngle, endAngle);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    checkSlice(x1, y1, x2, y2) {
        if (this.isSliced || this.isOffScreen) return false;
        return Utils.lineIntersectsCircle(x1, y1, x2, y2, this.x, this.y, this.radius);
    }

    slice(sliceAngle = 0) {
        this.isSliced = true;
        this.sliceAngle = sliceAngle;

        const halves = [];

        const leftHalf = new Fruit(this.canvas, this.type);
        leftHalf.x = this.x;
        leftHalf.y = this.y;
        leftHalf.radius = this.radius;
        leftHalf.rotation = this.rotation;
        leftHalf.isHalf = true;
        leftHalf.halfSide = 'left';
        leftHalf.vx = this.vx - 3;
        leftHalf.vy = this.vy - 2;
        leftHalf.rotationSpeed = -0.15;
        leftHalf.isSliced = true;
        halves.push(leftHalf);

        const rightHalf = new Fruit(this.canvas, this.type);
        rightHalf.x = this.x;
        rightHalf.y = this.y;
        rightHalf.radius = this.radius;
        rightHalf.rotation = this.rotation;
        rightHalf.isHalf = true;
        rightHalf.halfSide = 'right';
        rightHalf.vx = this.vx + 3;
        rightHalf.vy = this.vy - 2;
        rightHalf.rotationSpeed = 0.15;
        rightHalf.isSliced = true;
        halves.push(rightHalf);

        return halves;
    }
}

// Bomb class
class Bomb {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.radius = 45;

        this.x = Utils.random(this.radius + 100, canvas.width - this.radius - 100);
        this.y = canvas.height + this.radius;

        const angle = Utils.random(-0.2, 0.2);
        const speed = Utils.random(10, 14);
        this.vx = Math.sin(angle) * speed * 0.8;
        this.vy = -speed * 1.1;

        this.rotation = 0;
        this.rotationSpeed = Utils.random(-0.03, 0.03);
        this.sparkPhase = 0;

        this.isSliced = false;
        this.isOffScreen = false;
        this.isBomb = true;
    }

    update() {
        if (this.isOffScreen) return;
        this.vy += GAME_CONFIG.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.sparkPhase += 0.3;

        if (this.y > this.canvas.height + this.radius * 2) {
            this.isOffScreen = true;
        }
    }

    draw() {
        if (this.isOffScreen) return;

        const ctx = this.ctx;
        const r = this.radius;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Shadow
        ctx.beginPath();
        ctx.arc(4, 5, r * 1.02, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();

        // Bomb body - dark metallic sphere
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const bombG = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
        bombG.addColorStop(0, '#555555');
        bombG.addColorStop(0.3, '#3a3a3a');
        bombG.addColorStop(0.6, '#222222');
        bombG.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = bombG;
        ctx.fill();

        // Metallic shine
        const shine = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, -r * 0.3, -r * 0.35, r * 0.3);
        shine.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        shine.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.35, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = shine;
        ctx.fill();

        // Danger X
        ctx.fillStyle = '#e74c3c';
        ctx.font = `bold ${r * 0.55}px Impact, Arial Black, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(231, 76, 60, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillText('X', 0, 0);
        ctx.shadowBlur = 0;

        // Fuse holder
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.88, r * 0.18, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5d4037';
        ctx.fill();

        // Fuse rope
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.95);
        ctx.bezierCurveTo(8, -r - 12, -5, -r - 22, 8, -r - 32);
        ctx.strokeStyle = '#8d6e63';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Spark
        const sparkSize = 7 + Math.sin(this.sparkPhase) * 3;
        const sparkX = 8;
        const sparkY = -r - 32;

        // Glow
        const glow = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, sparkSize * 2.5);
        glow.addColorStop(0, 'rgba(255, 200, 50, 0.7)');
        glow.addColorStop(0.4, 'rgba(255, 120, 0, 0.3)');
        glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Spark core
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6600';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffdd00';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, sparkSize * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Outline
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    checkSlice(x1, y1, x2, y2) {
        if (this.isSliced || this.isOffScreen) return false;
        return Utils.lineIntersectsCircle(x1, y1, x2, y2, this.x, this.y, this.radius);
    }
}

// ==================== SPECIAL FRUIT (Arcade powerups) ====================
class SpecialFruit {
    constructor(canvas, specialType) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.type = SPECIAL_FRUIT_TYPES[specialType];
        this.specialType = specialType; // 'freeze', 'frenzy', 'double'
        this.radius = 50;

        this.x = Utils.random(this.radius + 100, canvas.width - this.radius - 100);
        this.y = canvas.height + this.radius;

        const angle = Utils.random(-0.2, 0.2);
        const speed = Utils.random(12, 15);
        this.vx = Math.sin(angle) * speed * 0.8;
        this.vy = -speed * 1.1;

        this.rotation = 0;
        this.rotationSpeed = Utils.random(-0.06, 0.06);
        this.pulsePhase = Math.random() * Math.PI * 2;

        this.isSliced = false;
        this.isOffScreen = false;
        this.isSpecial = true;
    }

    update() {
        if (this.isOffScreen) return;
        this.vy += GAME_CONFIG.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;
        this.pulsePhase += 0.08;

        if (this.y > this.canvas.height + this.radius * 2) {
            this.isOffScreen = true;
        }
    }

    draw() {
        if (this.isOffScreen) return;

        const ctx = this.ctx;
        const r = this.radius;
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.06;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(pulse, pulse);

        // Outer aura glow
        const aura = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.8);
        aura.addColorStop(0, this.type.color + '30');
        aura.addColorStop(0.6, this.type.color + '10');
        aura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();

        // Shadow
        ctx.beginPath();
        ctx.arc(3, 4, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        // Main body
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        const bodyG = ctx.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
        bodyG.addColorStop(0, this.type.highlight);
        bodyG.addColorStop(0.5, this.type.color);
        bodyG.addColorStop(1, this.type.shadow);
        ctx.fillStyle = bodyG;
        ctx.fill();

        // Inner pattern based on type
        if (this.specialType === 'freeze') {
            this._drawFreezePattern(ctx, r);
        } else if (this.specialType === 'frenzy') {
            this._drawFrenzyPattern(ctx, r);
        } else if (this.specialType === 'double') {
            this._drawDoublePattern(ctx, r);
        }

        // Specular highlight
        const spec = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0, -r * 0.3, -r * 0.35, r * 0.3);
        spec.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        spec.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.35, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = spec;
        ctx.fill();

        // Border ring
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = this.type.highlight + '80';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    _drawFreezePattern(ctx, r) {
        // Snowflake / ice crystal pattern
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const len = r * 0.55;
            const ex = Math.cos(angle) * len;
            const ey = Math.sin(angle) * len;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            // Branch tips
            const bLen = r * 0.2;
            for (let side = -1; side <= 1; side += 2) {
                const branchAngle = angle + side * 0.5;
                ctx.beginPath();
                ctx.moveTo(ex * 0.6, ey * 0.6);
                ctx.lineTo(ex * 0.6 + Math.cos(branchAngle) * bLen, ey * 0.6 + Math.sin(branchAngle) * bLen);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    _drawFrenzyPattern(ctx, r) {
        // Lightning bolt / burst lines
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Central lightning bolt
        ctx.beginPath();
        ctx.moveTo(-r * 0.15, -r * 0.5);
        ctx.lineTo(r * 0.05, -r * 0.1);
        ctx.lineTo(-r * 0.08, -r * 0.05);
        ctx.lineTo(r * 0.18, r * 0.5);
        ctx.stroke();
        // Radiating sparks
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const inner = r * 0.5;
            const outer = r * 0.7;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawDoublePattern(ctx, r) {
        // "x2" text
        ctx.save();
        ctx.font = `bold ${r * 0.7}px Impact, Arial Black, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText('x2', 0, 2);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    checkSlice(x1, y1, x2, y2) {
        if (this.isSliced || this.isOffScreen) return false;
        return Utils.lineIntersectsCircle(x1, y1, x2, y2, this.x, this.y, this.radius);
    }
}
