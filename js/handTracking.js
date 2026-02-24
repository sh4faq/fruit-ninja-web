// Hand tracking using MediaPipe Hands + Face Detection for 3D parallax
// Both GPU-accelerated via WebGL internally

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

        // ===== Face/Head tracking for 3D parallax =====
        this.faceDetection = null;
        this.faceDetectInterval = null;
        this.isFaceProcessing = false;
        // Head offset: -1 to 1 (0 = centered). Used by game for parallax.
        this.headOffset = { x: 0, y: 0 };
        // Smoothing for head — at ~6fps detection, 0.25 gives smooth but responsive feel
        this.headSmoothing = 0.25;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                // ===== Hand tracking setup =====
                this.hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                this.hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 0,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.3
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
                            // Silently handle send errors
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
                        // Start face detection on a separate timer (doesn't block hands)
                        this.initFaceDetection();
                        resolve();
                    })
                    .catch(reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    // ===== Face detection for head parallax =====
    initFaceDetection() {
        try {
            this.faceDetection = new FaceDetection({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }
            });

            this.faceDetection.setOptions({
                model: 'short',          // Short-range model — faster, good for webcam distance
                minDetectionConfidence: 0.5
            });

            this.faceDetection.onResults((results) => this.onFaceResults(results));

            // Run face detection at ~6fps on its own timer (head moves slowly)
            this.faceDetectInterval = setInterval(async () => {
                if (this.isFaceProcessing || this.video.readyState < 2) return;
                this.isFaceProcessing = true;
                try {
                    await this.faceDetection.send({ image: this.video });
                } catch (e) {
                    // Silently handle
                }
                this.isFaceProcessing = false;
            }, 166);
        } catch (e) {
            console.warn('Face detection unavailable — parallax disabled', e);
        }
    }

    onFaceResults(results) {
        if (!results.detections || results.detections.length === 0) return;

        const face = results.detections[0];
        let centerX = 0.5, centerY = 0.5;

        // Prefer nose-tip landmark (index 2) — more precise than bbox center
        if (face.landmarks && face.landmarks.length > 2) {
            const nose = face.landmarks[2];
            centerX = (typeof nose.x === 'number') ? nose.x : (nose[0] ?? 0.5);
            centerY = (typeof nose.y === 'number') ? nose.y : (nose[1] ?? 0.5);
        }
        // Fallback: bounding box center (handle all possible formats)
        else if (face.boundingBox) {
            const bb = face.boundingBox;
            centerX = bb.xCenter ?? ((bb.xMin ?? bb.originX ?? 0) + (bb.width ?? 0) / 2);
            centerY = bb.yCenter ?? ((bb.yMin ?? bb.originY ?? 0) + (bb.height ?? 0) / 2);
        }

        // Convert to -1 to 1 range (0 = centered)
        // Mirror X so leaning right = positive offset
        const rawX = -(centerX - 0.5) * 2;
        const rawY = -(centerY - 0.5) * 2;

        // Store raw for PiP visualization
        this._faceRaw = { x: centerX, y: centerY };

        this.headOffset.x += (rawX - this.headOffset.x) * this.headSmoothing;
        this.headOffset.y += (rawY - this.headOffset.y) * this.headSmoothing;
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

                this.rawFingerTips[f] = rawTip;

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
        if (this.faceDetectInterval) {
            clearInterval(this.faceDetectInterval);
        }
    }
}
