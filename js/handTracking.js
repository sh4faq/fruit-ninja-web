// Hand tracking using MediaPipe Hands (GPU-accelerated via WebGL internally)

class HandTracker {
    constructor(videoElement, onResultsCallback) {
        this.video = videoElement;
        this.onResultsCallback = onResultsCallback;
        this.hands = null;
        this.camera = null;
        this.isReady = false;

        // Store hand data
        this.landmarks = null;
        this.allHandsLandmarks = [];
        this.indexFingerTip = null;
        this.previousIndexTip = null;

        // All 5 fingertips: thumb(4), index(8), middle(12), ring(16), pinky(20)
        this.fingertipIndices = [4, 8, 12, 16, 20];
        this.fingerTips = [null, null, null, null, null];           // smoothed (for display)
        this.previousFingerTips = [null, null, null, null, null];
        this.rawFingerTips = [null, null, null, null, null];        // unsmoothed (for slice detection)
        this.previousRawFingerTips = [null, null, null, null, null];
        this.fingerVelocities = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];

        // For velocity calculation
        this.velocity = { x: 0, y: 0 };
        this.lastUpdateTime = 0;

        // Hand persistence - reduced to prevent ghost slices
        this.lastValidLandmarks = [];
        this.framesWithoutHands = 0;
        this.maxPersistenceFrames = 4;

        // Position smoothing (reduce jitter) - higher = more responsive
        this.smoothingFactor = 0.7;

        // Frame tracking
        this.frameCount = 0;
        this.processEveryN = 1;
        this.isProcessing = false;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                this.hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                this.hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0,            // Lite model — ~2x faster than full
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.3      // Lower = re-detects less often = faster
                });

                this.hands.onResults((results) => this.onResults(results));

                this.camera = new Camera(this.video, {
                    onFrame: async () => {
                        this.frameCount++;
                        if (this.frameCount % this.processEveryN !== 0 || this.isProcessing) return;
                        this.isProcessing = true;
                        try {
                            await this.hands.send({ image: this.video });
                        } catch (e) {
                            // Silently handle send errors (can happen if tab is backgrounded)
                        }
                        this.isProcessing = false;
                    },
                    width: 480,
                    height: 360,
                    facingMode: 'user'
                });

                this.camera.start()
                    .then(() => {
                        this.isReady = true;
                        resolve();
                    })
                    .catch(reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    onResults(results) {
        const now = performance.now();
        const deltaTime = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        // Store previous positions for slice detection
        this.previousIndexTip = this.indexFingerTip ? { ...this.indexFingerTip } : null;
        for (let f = 0; f < 5; f++) {
            this.previousFingerTips[f] = this.fingerTips[f] ? { ...this.fingerTips[f] } : null;
            this.previousRawFingerTips[f] = this.rawFingerTips[f] ? { ...this.rawFingerTips[f] } : null;
        }

        // Store all hands landmarks with persistence
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.allHandsLandmarks = results.multiHandLandmarks;
            this.lastValidLandmarks = results.multiHandLandmarks;
            this.framesWithoutHands = 0;
        } else {
            this.framesWithoutHands++;
            if (this.framesWithoutHands <= this.maxPersistenceFrames && this.lastValidLandmarks.length > 0) {
                this.allHandsLandmarks = this.lastValidLandmarks;
            } else {
                this.allHandsLandmarks = [];
                this.lastValidLandmarks = [];
            }
        }

        if (this.allHandsLandmarks.length > 0) {
            this.landmarks = this.allHandsLandmarks[0];

            const canvasWidth = window.innerWidth;
            const canvasHeight = window.innerHeight;

            for (let f = 0; f < 5; f++) {
                const lmIdx = this.fingertipIndices[f];
                const tip = this.landmarks[lmIdx];
                const rawTip = {
                    x: (1 - tip.x) * canvasWidth,
                    y: tip.y * canvasHeight,
                    z: tip.z
                };

                // Store raw (unsmoothed) position for accurate slice detection
                this.rawFingerTips[f] = rawTip;

                // Smoothed position for display/visuals
                if (this.fingerTips[f]) {
                    this.fingerTips[f] = {
                        x: this.fingerTips[f].x + (rawTip.x - this.fingerTips[f].x) * this.smoothingFactor,
                        y: this.fingerTips[f].y + (rawTip.y - this.fingerTips[f].y) * this.smoothingFactor,
                        z: rawTip.z
                    };
                } else {
                    this.fingerTips[f] = rawTip;
                }

                if (this.previousRawFingerTips[f] && deltaTime > 0) {
                    this.fingerVelocities[f] = {
                        x: (rawTip.x - this.previousRawFingerTips[f].x) / (deltaTime / 16.67),
                        y: (rawTip.y - this.previousRawFingerTips[f].y) / (deltaTime / 16.67)
                    };
                }
            }

            this.indexFingerTip = this.fingerTips[1];
            this.velocity = this.fingerVelocities[1];
        } else {
            this.landmarks = null;
            this.indexFingerTip = null;
            this.velocity = { x: 0, y: 0 };
            for (let f = 0; f < 5; f++) {
                this.fingerTips[f] = null;
                this.rawFingerTips[f] = null;
                this.fingerVelocities[f] = { x: 0, y: 0 };
            }
        }

        // Only send callback for real detections (not persisted ones)
        if (this.framesWithoutHands > 0) return;

        if (this.onResultsCallback) {
            this.onResultsCallback({
                landmarks: this.landmarks,
                allHands: this.allHandsLandmarks,
                indexTip: this.indexFingerTip,
                previousTip: this.previousIndexTip,
                velocity: this.velocity,
                isSlicing: this.isSlicing()
            });
        }
    }

    isSlicing() {
        const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
        return speed > 2;
    }

    getSliceLine() {
        if (!this.indexFingerTip || !this.previousIndexTip) return null;

        return {
            x1: this.previousIndexTip.x,
            y1: this.previousIndexTip.y,
            x2: this.indexFingerTip.x,
            y2: this.indexFingerTip.y
        };
    }

    drawLandmarks(ctx) {
        if (!this.allHandsLandmarks || this.allHandsLandmarks.length === 0) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        const landmarks = this.allHandsLandmarks[0];
        const pts = [];
        for (let i = 0; i < 21; i++) {
            pts[i] = {
                x: (1 - landmarks[i].x) * width,
                y: landmarks[i].y * height
            };
        }

        const connections = [
            [0,5],[5,9],[9,13],[13,17],[0,17],
            [5,6],[6,7],[7,8],
            [9,10],[10,11],[11,12],
        ];

        ctx.beginPath();
        for (let c = 0; c < connections.length; c++) {
            const a = connections[c][0], b = connections[c][1];
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const tipIndices = [4, 8, 12, 16, 20];
        for (let f = 0; f < 5; f++) {
            const idx = tipIndices[f];
            const curr = this.fingerTips[f];
            const prev = this.previousFingerTips[f];
            let isMoving = false;
            if (curr && prev) {
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                isMoving = Math.sqrt(dx * dx + dy * dy) > 5;
            }

            if (isMoving) {
                ctx.beginPath();
                ctx.arc(pts[idx].x, pts[idx].y, 16, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(150, 200, 255, 0.2)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(pts[idx].x, pts[idx].y, isMoving ? 7 : 4, 0, Math.PI * 2);
            ctx.fillStyle = isMoving ? 'rgba(200, 230, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
        }
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
        }
    }
}
