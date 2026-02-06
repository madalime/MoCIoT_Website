/**
 * Main function to initialize and manage the tilt-controlled maze game.
 * Handles canvas setup, physics, mobile orientation, and user interactions.
 */
(function () {
    /**
     * Canvas element for rendering the maze grid.
     * @type {HTMLCanvasElement}
     */
    const canvas = document.getElementById('levelCanvas');

    /**
     * Canvas element for rendering the ball overlay.
     * @type {HTMLCanvasElement}
     */
    const overlay = document.getElementById('ballCanvas');

    /**
     * Element for displaying messages to the user.
     * @type {HTMLElement}
     */
    const msg = document.getElementById('messageArea');

    /**
     * Overlay element shown at the start of the game.
     * @type {HTMLElement}
     */
    const startOverlay = document.getElementById('startOverlay');

    /**
     * URL parameters for determining the level to load.
     * @type {URLSearchParams}
     */
    const params = new URLSearchParams(location.search);

    /**
     * Requested level number from the URL, defaults to 1 if not provided.
     * @type {number}
     */
    const levelParam = params.get('level') || params.get('l') || '1';
    const requestedLevel = parseInt(levelParam, 10) || 1;

    /**
     * Path to the levels.json file containing level data.
     * @type {string}
     */
    const levelsJsonPath = '../../js/levels/levels.json';

    /**
     * Current level data.
     * @type {Object|null}
     */
    let currentLevel = null;

    /**
     * Rendering information for the maze grid.
     * @type {Object|null}
     */
    let renderInfo = null; // { cols, rows, cellSize }

    /**
     * Starting cell of the maze.
     * @type {Object|null}
     */
    let startCell = null;

    /**
     * Goal cell of the maze.
     * @type {Object|null}
     */
    let goalCell = null;

    /**
     * Flag indicating whether the goal has been reached.
     * @type {boolean}
     */
    let goalReached = false;

    /**
     * ID of the current animation frame.
     * @type {number|null}
     */
    let animationId = null;

    /**
     * Timestamp of the last animation frame.
     * @type {number|null}
     */
    let lastFrameTime = null;

    /**
     * Flag indicating whether the animation is paused.
     * @type {boolean}
     */
    let animationPaused = false;

    /**
     * Ball object representing position and velocity.
     * @type {Object}
     */
    const ball = {
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        radius: 8
    };

    /**
     * State of the device's orientation sensor.
     * @type {Object}
     */
    const sensorState = { accel: { x: 0, y: 0 }, enabled: false, available: false };

    /**
     * Timer state for tracking elapsed play time.
     * @type {Object}
     */
    const timerState = { startTime: 0, elapsedMs: 0, running: false, started: false };

    /**
     * Flag indicating whether the timer is bound.
     * @type {boolean}
     */
    let timerStartBound = false;

    /**
     * Overlay element for landscape orientation instructions.
     * @type {HTMLElement|null}
     */
    let landscapeOverlay = null;

    /**
     * HTML element for screen rotation lock instructions.
     * @type {HTMLElement|null}
     */
    let lockPrompt = null;

    /**
     * Key for storing level completion times in localStorage.
     * @type {string}
     */
    const COMPLETION_STORAGE_KEY = 'levelCompletionTimes';

    /**
     * Key for storing the timestamp of the last user activity in sessionStorage.
     * @type {string}
     */
    const LAST_ACTIVE_KEY = 'lockLastActiveTimestamp';

    /**
     * Threshold for idle time before showing a lock reminder (in milliseconds).
     * @type {number}
     */
    const IDLE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

    /**
     * Timestamp of the last user activity.
     * @type {number}
     */
    let lastActive = Date.now();

    /**
     * Resets the timer state.
     */
    function resetTimer() {
        timerState.startTime = 0;
        timerState.elapsedMs = 0;
        timerState.running = false;
        timerState.started = false;
    }

    /**
     * Starts the timer if it is not already running.
     */
    function startTimer() {
        if (timerState.running) return;
        timerState.startTime = performance.now();
        timerState.running = true;
        timerState.started = true;
    }

    /**
     * Stops the timer if it is running.
     */
    function stopTimer() {
        if (!timerState.running) return;
        timerState.elapsedMs += performance.now() - timerState.startTime;
        timerState.running = false;
    }

    /**
     * Gets the total elapsed time in milliseconds.
     * @returns {number} The elapsed time in milliseconds.
     */
    function getElapsedMs() {
        if (!timerState.running) return timerState.elapsedMs;
        return timerState.elapsedMs + (performance.now() - timerState.startTime);
    }

    /**
     * Formats a time duration in milliseconds as a string (MM:SS.hh).
     * @param {number} ms - The time duration in milliseconds.
     * @returns {string} The formatted time string.
     */
    function formatElapsed(ms) {
        const totalSeconds = ms / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const hundredths = Math.floor((totalSeconds * 100) % 100);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
    }

    /**
     * Loads high scores from localStorage.
     * @returns {Object} An object mapping level numbers to completion times in milliseconds.
     */
    function loadCompletionTimes() {
        try {
            const raw = localStorage.getItem(COMPLETION_STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    /**
     * Persists completion times to localStorage.
     * @param {Object} times - An object mapping level numbers to completion times in milliseconds.
     */
    function persistCompletionTimes(times) {
        try { localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(times)); } catch (_) {}
    }

    /**
     * Saves the completion time for a level if it is the best time.
     * @param {number} levelNumber - The level number.
     * @param {number} elapsedMs - The elapsed time in milliseconds.
     */
    function saveCompletionTime(levelNumber, elapsedMs) {
        const ms = Number(elapsedMs);
        if (!Number.isFinite(ms) || ms < 0) return;
        const times = loadCompletionTimes();
        const existing = Number(times[levelNumber]);
        if (!Number.isFinite(existing) || ms < existing) {
            times[levelNumber] = Math.round(ms);
            persistCompletionTimes(times);
        }
    }

    /**
     * Marks the current time as the last active time.
     */
    function markActive() {
        lastActive = Date.now();
        try { sessionStorage.setItem(LAST_ACTIVE_KEY, String(lastActive)); } catch (_) {}
    }

    /**
     * Gets the last active timestamp from sessionStorage.
     * @returns {number} The last active timestamp.
     */
    function getLastActive() {
        const stored = sessionStorage.getItem(LAST_ACTIVE_KEY);
        if (stored) {
            const num = Number(stored);
            if (!Number.isNaN(num)) {
                return num;
            }
        }
        return 0;
    }

    /**
     * Determines if the lock reminder should be shown based on idle time.
     * @returns {boolean} True if the lock reminder should be shown, false otherwise.
     */
    function shouldShowLockReminder() {
        const now = Date.now();
        const idleFor = now - getLastActive();
        console.log('idleFor', idleFor);
        return idleFor >= IDLE_THRESHOLD_MS;
    }

    /**
     * Checks if the device is in landscape orientation.
     * @returns {boolean} True if the device is in landscape orientation, false otherwise.
     */
    function isLandscape() {
        if (screen.orientation && screen.orientation.type) {
            return screen.orientation.type.startsWith('landscape');
        }
        return window.matchMedia('(orientation: landscape)').matches || window.innerWidth >= window.innerHeight;
    }

    /**
     * Shows the landscape overlay instructing the user to rotate the device.
     */
    function showLandscapeOverlay() {
        if (landscapeOverlay) {
            landscapeOverlay.style.display = 'flex';
            return;
        }
        const overlayEl = document.createElement('div');
        overlayEl.id = 'landscapeOverlay';
        overlayEl.style.position = 'fixed';
        overlayEl.style.inset = '0';
        overlayEl.style.background = 'rgba(0,0,0,0.65)';
        overlayEl.style.display = 'flex';
        overlayEl.style.alignItems = 'center';
        overlayEl.style.justifyContent = 'center';
        overlayEl.style.zIndex = '2000';
        overlayEl.style.color = '#fff';
        overlayEl.style.textAlign = 'center';
        overlayEl.innerHTML = '<div style="max-width:420px;padding:20px 24px;background:rgba(0,0,0,0.55);border-radius:16px;font-size:18px;line-height:1.5;">Please rotate your device to landscape to play.</div>';
        document.body.appendChild(overlayEl);
        landscapeOverlay = overlayEl;
    }

    /**
     * Hides the landscape overlay if it is currently displayed.
     */
    function hideLandscapeOverlay() {
        if (landscapeOverlay) landscapeOverlay.style.display = 'none';
    }

    /**
     * Shows the lock prompt instructing the user to lock the screen rotation.
     */
    function showLockPrompt() {
        if (!shouldShowLockReminder()) return;
        if (lockPrompt) {
            lockPrompt.style.display = 'flex';
            pauseGame();
            markActive();
            return;
        }
        pauseGame();
        const wrap = document.createElement('div');
        wrap.id = 'lockPrompt';
        wrap.style.position = 'fixed';
        wrap.style.inset = '0';
        wrap.style.pointerEvents = 'none';
        wrap.style.zIndex = '1500';
        wrap.style.display = 'flex';
        wrap.style.justifyContent = 'center';
        wrap.style.alignItems = 'flex-start';
        wrap.style.paddingTop = '16px';

        const card = document.createElement('div');
        card.style.pointerEvents = 'auto';
        card.style.background = '#fff';
        card.style.borderRadius = '12px';
        card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        card.style.padding = '12px 14px';
        card.style.display = 'flex';
        card.style.gap = '12px';
        card.style.alignItems = 'center';
        card.style.maxWidth = '520px';

        const text = document.createElement('div');
        text.textContent = 'Please lock screen rotation to landscape for the best experience.';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn btn-sm btn-outline-secondary';
        closeBtn.textContent = 'Dismiss';
        closeBtn.addEventListener('click', () => hideLockPrompt());

        card.appendChild(text);
        card.appendChild(closeBtn);
        wrap.appendChild(card);
        document.body.appendChild(wrap);
        lockPrompt = wrap;
        markActive();
    }

    /**
     * Hides the lock prompt if it is currently displayed.
     */
    function hideLockPrompt() {
        console.log('Hiding lock prompt');
        if (lockPrompt) lockPrompt.style.display = 'none';
        resumeGame();
    }

    /**
     * Handles the landscape state by showing or hiding the appropriate overlays and prompts.
     */
    function handleLandscapeState() {
        if (isLandscape()) {
            hideLandscapeOverlay();
            if (animationPaused) resumeGame();
        } else {
            showLandscapeOverlay();
            pauseGame();
        }
    }

    /**
     * Binds the timer start handler to user interactions, ensuring it is called only once.
     */
    function bindTimerStartOnce() {
        if (timerStartBound) return;
        const handler = () => {
            if (animationPaused) {
                resumeGame();
            } else {
                startTimer();
            }
        };
        const options = { passive: true };
        if (overlay) overlay.addEventListener('pointerdown', handler, options);
        if (canvas) canvas.addEventListener('pointerdown', handler, options);
        // Fallback for any other interaction on the page
        window.addEventListener('pointerdown', handler, options);
        timerStartBound = true;
    }

    /**
     * Pauses the game, stopping all animations and the timer.
     */
    function pauseGame() {
        animationPaused = true;
        stopTimer();
        ball.vel.x = 0;
        ball.vel.y = 0;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    /**
     * Resumes the game, starting the animation loop and timer.
     */
    function resumeGame() {
        if (goalReached) return;
        animationPaused = false;
        startLoop();
        startTimer();
    }

    /**
     * Creates and displays the win modal when the goal is reached.
     */
    function createWinModal() {
        if (document.getElementById('winModalOverlay')) return;
        const overlayEl = document.createElement('div');
        overlayEl.id = 'winModalOverlay';
        overlayEl.setAttribute('role', 'dialog');
        overlayEl.setAttribute('aria-modal', 'true');
        overlayEl.style.position = 'fixed';
        overlayEl.style.inset = '0';
        overlayEl.style.display = 'flex';
        overlayEl.style.alignItems = 'center';
        overlayEl.style.justifyContent = 'center';
        overlayEl.style.background = 'rgba(0,0,0,0.45)';
        overlayEl.style.zIndex = '1060';

        const card = document.createElement('div');
        card.className = 'card text-center p-3';
        card.style.minWidth = '260px';
        card.style.maxWidth = '90%';

        const body = document.createElement('div');
        body.className = 'card-body';

        const title = document.createElement('h5');
        title.className = 'card-title mb-3';
        title.textContent = 'You reached the goal!';

        const btnGroup = document.createElement('div');
        btnGroup.className = 'd-flex gap-2 justify-content-center';

        const restartBtn = document.createElement('button');
        restartBtn.type = 'button';
        restartBtn.className = 'btn btn-outline-secondary';
        restartBtn.textContent = 'retry level';
        restartBtn.addEventListener('click', () => {
            const base = location.pathname.split('?')[0];
            location.href = base + '?level=' + requestedLevel;
        });

        const overviewBtn = document.createElement('button');
        overviewBtn.type = 'button';
        overviewBtn.className = 'btn btn-outline-secondary';
        overviewBtn.textContent = 'level overview';
        overviewBtn.addEventListener('click', () => {
            // navigate to levels overview (../index.html)
            location.href = location.pathname.replace(/\/play\/[^/]*$/, '/index.html');
        });

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn btn-primary';
        nextBtn.textContent = 'next level';
        nextBtn.addEventListener('click', () => {
            const nextLevel = Number(requestedLevel) + 1;
            const base = location.pathname.split('?')[0];
            location.href = base + '?level=' + nextLevel;
        });

        btnGroup.appendChild(restartBtn);
        btnGroup.appendChild(overviewBtn);
        btnGroup.appendChild(nextBtn);

        body.appendChild(title);
        const timeEl = document.createElement('p');
        timeEl.id = 'winModalTime';
        timeEl.className = 'mb-3 text-muted';
        body.appendChild(timeEl);
        body.appendChild(btnGroup);
        card.appendChild(body);
        overlayEl.appendChild(card);

        document.body.appendChild(overlayEl);
    }

    /**
     * Updates the win modal to display the elapsed time.
     */
    function updateWinModalTime() {
        const el = document.getElementById('winModalTime');
        if (!el) return;
        const ms = getElapsedMs();
        el.textContent = 'Time: ' + formatElapsed(ms);
    }

    /**
     * Shows the win modal, stopping the timer and saving the completion time.
     */
    function showWinModal() {
        createWinModal();
        stopTimer();
        const ms = getElapsedMs();
        saveCompletionTime(requestedLevel, ms);
        updateWinModalTime();
        const el = document.getElementById('winModalOverlay');
        if (!el) return;
        el.style.display = 'flex';
        // focus the primary button for keyboard users
        const prim = el.querySelector('.btn-primary');
        if (prim && typeof prim.focus === 'function') prim.focus();
    }

    /**
     * Shows a message to the user in the message area.
     * @param {string} text - The message text.
     * @param {string} [type='danger'] - The message type (e.g., 'success', 'warning', 'danger').
     */
    function showMessage(text, type = 'danger') {
        msg.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
    }

    /**
     * Clears the message area.
     */
    function clearMessage() {
        msg.innerHTML = '';
    }

    /**
     * Clamps a value between a minimum and maximum value.
     * @param {number} val - The value to clamp.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} The clamped value.
     */
    function clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    /**
     * Finds the special cells (start and goal) in the level grid.
     * @param {Array<Array<string>>} grid - The level grid.
     * @returns {Object} An object containing the start and goal cell coordinates.
     */
    function findSpecialCells(grid) {
        let start = null;
        let goal = null;
        for (let r = 0; r < grid.length; r++) {
            const row = grid[r];
            const s = row.indexOf('S');
            if (s !== -1) start = { r, c: s };
            const g = row.indexOf('G');
            if (g !== -1) goal = { r, c: g };
        }
        return { start, goal };
    }

    /**
     * Synchronizes the ball's radius with the cell size.
     * @param {number} cellSize - The size of the grid cell.
     */
    function syncBallRadius(cellSize) {
        ball.radius = Math.max(3, Math.min(cellSize * 0.35, cellSize * 0.45));
    }

    /**
     * Synchronizes the overlay size with the rendering information.
     */
    function syncOverlaySize() {
        if (!renderInfo || !overlay) return;
        const dpr = window.devicePixelRatio || 1;
        const widthCss = renderInfo.cols * renderInfo.cellSize;
        const heightCss = renderInfo.rows * renderInfo.cellSize;
        overlay.style.width = `${widthCss}px`;
        overlay.style.height = `${heightCss}px`;
        overlay.width = Math.floor(widthCss * dpr);
        overlay.height = Math.floor(heightCss * dpr);
        const ctx = overlay.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, widthCss, heightCss);
    }

    /**
     * Places the ball at the starting position.
     */
    function placeBallAtStart() {
        if (!renderInfo || !startCell) return;
        syncBallRadius(renderInfo.cellSize);
        ball.pos.x = (startCell.c + 0.5) * renderInfo.cellSize;
        ball.pos.y = (startCell.r + 0.5) * renderInfo.cellSize;
        ball.vel.x = 0;
        ball.vel.y = 0;
        goalReached = false;
        drawBall();
    }

    /**
     * Rescales the ball's position and radius based on the new cell size.
     * @param {number} oldCellSize - The old size of the grid cell.
     */
    function rescaleBall(oldCellSize) {
        if (!oldCellSize || !renderInfo) return;
        const scale = renderInfo.cellSize / oldCellSize;
        ball.pos.x *= scale;
        ball.pos.y *= scale;
        syncBallRadius(renderInfo.cellSize);
    }

    /**
     * Checks if a cell is a wall based on the current level data.
     * @param {number} col - The column index of the cell.
     * @param {number} row - The row index of the cell.
     * @returns {boolean} True if the cell is a wall, false otherwise.
     */
    function isWall(col, row) {
        if (!currentLevel || !currentLevel.grid) return false;
        if (row < 0 || col < 0) return true;
        if (row >= currentLevel.grid.length || col >= currentLevel.grid[0].length) return true;
        return currentLevel.grid[row][col] === '#';
    }

    /**
     * Computes the acceleration values from the device's orientation sensor.
     * @returns {Object} An object containing the x and y acceleration values.
     */
    function computeAcceleration() {
        let ax = 0;
        let ay = 0;
        if (sensorState.enabled && sensorState.available) {
            ax = sensorState.accel.x;
            ay = sensorState.accel.y;
        }
        return { ax, ay };
    }

    /**
     * Performs a single step of physics simulation, updating the ball's position and velocity.
     * @param {number} dt - The time delta for the simulation step.
     */
    function stepPhysics(dt) {
        if (!renderInfo) return;
        const { ax, ay } = computeAcceleration();
        const friction = 1.8; // per second
        ball.vel.x = (ball.vel.x + ax * dt) * Math.exp(-friction * dt);
        ball.vel.y = (ball.vel.y + ay * dt) * Math.exp(-friction * dt);

        const cellSize = renderInfo.cellSize;
        const radius = ball.radius;

        const speed = Math.hypot(ball.vel.x, ball.vel.y);
        const maxTravelPerSubStep = cellSize * 0.45;
        const steps = Math.max(1, Math.ceil(speed * dt / Math.max(1, maxTravelPerSubStep)));
        const stepDt = dt / steps;

        for (let i = 0; i < steps; i++) {
            const nextX = ball.pos.x + ball.vel.x * stepDt;
            const nextY = ball.pos.y + ball.vel.y * stepDt;
            const resolved = resolveCircleCollisions(nextX, nextY, radius, cellSize);
            ball.pos.x = resolved.x;
            ball.pos.y = resolved.y;
        }

        if (!goalReached && goalCell) {
            const cellR = Math.floor(ball.pos.y / cellSize);
            const cellC = Math.floor(ball.pos.x / cellSize);
            if (cellR === goalCell.r && cellC === goalCell.c) {
                goalReached = true;
                pauseGame();
                showWinModal();
            }
        }
    }

    /**
     * Resolves circle collisions for the ball, adjusting its position and velocity.
     * @param {number} nextX - The proposed next x position of the ball.
     * @param {number} nextY - The proposed next y position of the ball.
     * @param {number} radius - The radius of the ball.
     * @param {number} cellSize - The size of the grid cell.
     * @returns {Object} The resolved x and y coordinates.
     */
    function resolveCircleCollisions(nextX, nextY, radius, cellSize) {
        let cx = nextX;
        let cy = nextY;
        const maxIter = 4;
        const maxX = renderInfo.cols * cellSize - radius;
        const maxY = renderInfo.rows * cellSize - radius;
        for (let iter = 0; iter < maxIter; iter++) {
            let collided = false;
            const minRow = Math.max(0, Math.floor((cy - radius) / cellSize));
            const maxRow = Math.min(renderInfo.rows - 1, Math.floor((cy + radius) / cellSize));
            const minCol = Math.max(0, Math.floor((cx - radius) / cellSize));
            const maxCol = Math.min(renderInfo.cols - 1, Math.floor((cx + radius) / cellSize));
            for (let row = minRow; row <= maxRow; row++) {
                for (let col = minCol; col <= maxCol; col++) {
                    if (!isWall(col, row)) continue;
                    const x0 = col * cellSize;
                    const y0 = row * cellSize;
                    const x1 = x0 + cellSize;
                    const y1 = y0 + cellSize;
                    const closestX = clamp(cx, x0, x1);
                    const closestY = clamp(cy, y0, y1);
                    const dx = cx - closestX;
                    const dy = cy - closestY;
                    const distSq = dx * dx + dy * dy;
                    const radSq = radius * radius;
                    if (distSq < radSq - 1e-6) {
                        const dist = Math.sqrt(Math.max(distSq, 0));
                        let nx = 0;
                        let ny = 0;
                        if (dist > 0) {
                            nx = dx / dist;
                            ny = dy / dist;
                        } else {
                            const leftPen = Math.abs(cx - x0);
                            const rightPen = Math.abs(x1 - cx);
                            const topPen = Math.abs(cy - y0);
                            const bottomPen = Math.abs(y1 - cy);
                            const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
                            if (minPen === leftPen) {
                                nx = -1;
                            } else if (minPen === rightPen) {
                                nx = 1;
                            } else if (minPen === topPen) {
                                ny = -1;
                            } else {
                                ny = 1;
                            }
                        }
                        const penetration = radius - dist + 0.01;
                        cx += nx * penetration;
                        cy += ny * penetration;
                        const vDotN = ball.vel.x * nx + ball.vel.y * ny;
                        if (vDotN < 0) {
                            ball.vel.x -= vDotN * nx;
                            ball.vel.y -= vDotN * ny;
                        }
                        collided = true;
                    }
                }
            }
            if (!collided) break;
        }
        cx = clamp(cx, radius, maxX);
        cy = clamp(cy, radius, maxY);
        return { x: cx, y: cy };
    }

    /**
     * Draws the ball on the overlay canvas at its current position.
     */
    function drawBall() {
        if (!overlay || !renderInfo) return;
        const ctx = overlay.getContext('2d');
        const width = renderInfo.cols * renderInfo.cellSize;
        const height = renderInfo.rows * renderInfo.cellSize;
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.fillStyle = '#212529';
        ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f8f9fa';
        ctx.lineWidth = Math.max(1, ball.radius * 0.1);
        ctx.stroke();
    }

    /**
     * Main animation loop, updating the game state and rendering the ball.
     * @param {number} timestamp - The current timestamp.
     */
    function loop(timestamp) {
        if (animationPaused) {
            animationId = null;
            return;
        }
        if (!currentLevel || !renderInfo) return;
        if (lastFrameTime === null) lastFrameTime = timestamp;
        const dt = Math.min(0.032, Math.max(0.001, (timestamp - lastFrameTime) / 1000));
        lastFrameTime = timestamp;
        stepPhysics(dt);
        drawBall();
        if (animationPaused) {
            animationId = null;
            return;
        }
        animationId = requestAnimationFrame(loop);
    }

    /**
     * Starts the animation loop.
     */
    function startLoop() {
        if (animationId) cancelAnimationFrame(animationId);
        animationPaused = false;
        lastFrameTime = null;
        animationId = requestAnimationFrame(loop);
    }

    /**
     * Handles device orientation events, updating the sensor state.
     * @param {DeviceOrientationEvent} event - The device orientation event.
     */
    function handleOrientation(event) {
        sensorState.available = true;
        const gamma = clamp(event.gamma || 0, -50, 50); // left-right
        const beta = clamp(event.beta || 0, -50, 50); // front-back
        const angle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0;
        let xTilt = gamma;
        let yTilt = beta;
        switch (angle) {
            case 90: xTilt = beta; yTilt = -gamma; break;
            case -90:
            case 270: xTilt = -beta; yTilt = gamma; break;
            case 180: xTilt = -gamma; yTilt = -beta; break;
            default: break;
        }
        const normX = clamp(xTilt / 45, -1, 1);
        const normY = clamp(yTilt / 45, -1, 1);
        const accelScale = 900; // px/s^2
        sensorState.accel.x = normX * accelScale;
        sensorState.accel.y = normY * accelScale;
    }

    /**
     * Attaches the orientation event listener if not already enabled.
     */
    const attachOrientationListener = () => {
        if (sensorState.enabled) return;
        sensorState.enabled = true;
        window.addEventListener('deviceorientation', handleOrientation, true);
    };

    /**
     * Callback function for when orientation permission is granted.
     */
    function onOrientationPermissionGranted() {
        attachOrientationListener();
        if (startOverlay) startOverlay.classList.add('d-none');
        showLockPrompt();
        placeBallAtStart();
        startTimer();
    }

    /**
     * Callback function for when orientation permission is denied.
     * @param {string} reason - The reason for denial.
     */
    function onOrientationPermissionDenied(reason) {
        const suffix = reason ? (': ' + reason) : '';
        showMessage('Orientation permission denied' + suffix, 'warning');
        if (startOverlay) startOverlay.classList.add('d-none');
    }

    /**
     * Prompts the user to start the game on mobile devices
     */
    function promptToStartOnMobile() {
        handleLandscapeState();

        if (!startOverlay) {
            attachOrientationListener();
            showLockPrompt();
            bindTimerStartOnce();
            return;
        }

        startOverlay.classList.remove('d-none');
        startOverlay.addEventListener('click', () => {
            startOverlay.classList.add('d-none');
            attachOrientationListener();
            showLockPrompt();
            bindTimerStartOnce();
        })
    }

    /**
     * Draws the grid on the main canvas based on the level data.
     * @param {Array<Array<string>>} grid - The level grid.
     */
    function drawGrid(grid) {
        try {
            if (!grid || !grid.length) return;
            const rows = grid.length;
            const cols = grid[0].length || 1;

            // Estimate available vertical space: viewport height minus top of the main container with a smaller margin
            const container = document.querySelector('.container');
            const reserved = container ? Math.round(container.getBoundingClientRect().top + 8) : 24;
            const availHeight = Math.max(120, window.innerHeight - reserved);

            // Cap the height to a sensible maximum to avoid huge canvases on very large displays
            const maxHeight = Math.min(availHeight, 1200);

            // Compute a width that preserves the grid's aspect ratio based on the chosen maxHeight,
            // but don't exceed viewport width limits.
            const aspectWidth = Math.max(200, Math.floor(maxHeight * (cols / Math.max(1, rows))));

            // Prevent the centered canvas from overlapping the fixed back button in the top-left.
            // If a back button exists, compute its right edge and require a small gap on both sides.
            const backBtn = document.querySelector('a[aria-label="Back"]');
            const gap = 12; // pixels of spacing to keep between button and canvas edge
            let safeWidthLimit = Math.floor(window.innerWidth * 0.95);
            if (backBtn) {
                const br = backBtn.getBoundingClientRect().right || 0;
                const allowed = Math.floor(window.innerWidth - 2 * (br + gap));
                if (!Number.isNaN(allowed)) {
                    if (allowed > 0) {
                        safeWidthLimit = Math.min(safeWidthLimit, allowed);
                    } else {
                        safeWidthLimit = Math.min(safeWidthLimit, 200);
                    }
                }
            }

            const maxWidth = Math.min(aspectWidth, safeWidthLimit, 1200);

            // Ensure the play area reserves the computed vertical space so we can center the canvas inside it
            const playArea = document.querySelector('.play-area');
            if (playArea) playArea.style.minHeight = `${maxHeight}px`;

            const oldCellSize = renderInfo ? renderInfo.cellSize : null;
            const renderResult = window.LevelRenderer.renderGridToCanvas(canvas, grid, { maxWidth, maxHeight, minCell: 8, drawGridLines: true });

            if (renderResult) {
                const renderedHeight = renderResult.rows * renderResult.cellSize;
                if (aspectWidth > maxWidth && renderedHeight < maxHeight) {
                    const topGap = Math.floor((maxHeight - renderedHeight) / 2);
                    canvas.style.marginTop = `${topGap}px`;
                    if (overlay) overlay.style.marginTop = `${topGap}px`;
                } else {
                    canvas.style.marginTop = '0px';
                    if (overlay) overlay.style.marginTop = '0px';
                }
                renderInfo = renderResult;
                syncOverlaySize();
                if (oldCellSize) {
                    rescaleBall(oldCellSize);
                } else {
                    placeBallAtStart();
                }
                drawBall();
            }
        } catch (e) {
            console.error('Render failed', e);
            showMessage('Failed to render level: ' + e.message, 'danger');
        }
    }

    /**
     * Renders the specified level by loading its data and initializing the game state.
     * @param {Object} levelObj - The level object containing grid and metadata.
     */
    function renderLevel(levelObj) {
        if (!levelObj) return;
        currentLevel = levelObj;
        resetTimer();
        timerStartBound = false;
        bindTimerStartOnce();
        clearMessage();
        const specials = findSpecialCells(levelObj.grid);
        startCell = specials.start;
        goalCell = specials.goal;
        if (!startCell) showMessage('Level is missing a start cell (S).', 'warning');
        if (!goalCell) showMessage('Level is missing a goal cell (G).', 'warning');
        drawGrid(levelObj.grid);
        placeBallAtStart();
        startLoop();
    }

    // Fetch levels
    fetch(levelsJsonPath)
        .then(res => {
            if (!res.ok) throw new Error('Failed to load levels.json: ' + res.status);
            return res.json();
        })
        .then(levels => {
            if (!Array.isArray(levels) || levels.length === 0) {
                showMessage('No levels available.', 'warning');
                return;
            }
            const found = levels.find(l => Number(l.level) === Number(requestedLevel));
            if (!found) {
                location.href = location.pathname.replace(/\/play\/[^/]*$/, '/completed.html');
                return;
            }
            if (!found.grid || !found.grid.length) {
                showMessage('Level grid is empty.', 'warning');
                return;
            }
            const width = found.grid[0].length;
            const ok = found.grid.every(r => r.length === width);
            if (!ok) {
                showMessage('Level grid rows are not uniform in width.', 'warning');
                return;
            }
            renderLevel(found);
        })
        .catch(err => {
            console.error(err);
            showMessage('Unable to load levels.json.', 'danger');
        });

    // redraw on resize to keep crispness and fit
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (!currentLevel) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => drawGrid(currentLevel.grid), 150);
    });

    window.addEventListener('orientationchange', handleLandscapeState);
    const mql = window.matchMedia('(orientation: landscape)');
    if (mql) {
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', handleLandscapeState);
        } else if (typeof mql.addListener === 'function') {
            mql.addListener(handleLandscapeState);
        }
    }

    window.LevelGame = Object.assign(window.LevelGame || {}, {
        orientationGranted: onOrientationPermissionGranted,
        orientationDenied: onOrientationPermissionDenied,
    });

    const permOverlay = document.getElementById('permissionOverlay');
    const permBtn = document.getElementById('permissionButton');

    function hidePermOverlay() { if (permOverlay) permOverlay.classList.add('d-none'); }
    function showPermOverlay() { if (permOverlay) permOverlay.classList.remove('d-none'); }

    function requestMotionPermission(evt) {
        if (evt) evt.preventDefault();
        if (!window.DeviceOrientationEvent || typeof DeviceOrientationEvent.requestPermission !== 'function') {
            hidePermOverlay();
            return;
        }
        DeviceOrientationEvent.requestPermission().then(result => {
            if (result === 'granted') {
                hidePermOverlay();
                if (window.LevelGame && typeof window.LevelGame.orientationGranted === 'function') {
                    window.LevelGame.orientationGranted();
                }
            } else {
                hidePermOverlay();
                if (window.LevelGame && typeof window.LevelGame.orientationDenied === 'function') {
                    window.LevelGame.orientationDenied(result);
                }
            }
        }).catch(err => {
            hidePermOverlay();
            if (window.LevelGame && typeof window.LevelGame.orientationDenied === 'function') {
                window.LevelGame.orientationDenied(err && err.message ? err.message : String(err));
            }
        });
    }

    const needsPermission = window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (needsPermission && permOverlay && permBtn) {
        showPermOverlay();
        permBtn.addEventListener('click', requestMotionPermission, { passive: false });
        permBtn.addEventListener('touchend', requestMotionPermission, { passive: false });
    } else {
        promptToStartOnMobile();
    }

 })();
