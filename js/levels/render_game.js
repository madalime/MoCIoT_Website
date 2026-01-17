(function () {
    const canvas = document.getElementById('levelCanvas');
    const overlay = document.getElementById('ballCanvas');
    const msg = document.getElementById('messageArea');
    const startOverlay = document.getElementById('startOverlay');

    // Get level param from URL
    const params = new URLSearchParams(location.search);
    const levelParam = params.get('level') || params.get('l') || '1';
    const requestedLevel = parseInt(levelParam, 10) || 1;

    // Path from this page (levels/play/index.html) to levels.json
    const levelsJsonPath = '../../js/levels/levels.json';

    let currentLevel = null;
    let renderInfo = null; // { cols, rows, cellSize }
    let startCell = null;
    let goalCell = null;
    let goalReached = false;
    let animationId = null;
    let lastFrameTime = null;

    const ball = {
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        radius: 8
    };

    const sensorState = { accel: { x: 0, y: 0 }, enabled: false, available: false };
    const keyState = { left: false, right: false, up: false, down: false };

    function isTouchDevice() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    }

    function showMessage(text, type = 'danger') {
        msg.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
    }

    function clearMessage() {
        msg.innerHTML = '';
    }

    function clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

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

    function syncBallRadius(cellSize) {
        ball.radius = Math.max(3, Math.min(cellSize * 0.35, cellSize * 0.45));
    }

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

    function rescaleBall(oldCellSize) {
        if (!oldCellSize || !renderInfo) return;
        const scale = renderInfo.cellSize / oldCellSize;
        ball.pos.x *= scale;
        ball.pos.y *= scale;
        syncBallRadius(renderInfo.cellSize);
    }

    function isWall(col, row) {
        if (!currentLevel || !currentLevel.grid) return false;
        if (row < 0 || col < 0) return true;
        if (row >= currentLevel.grid.length || col >= currentLevel.grid[0].length) return true;
        return currentLevel.grid[row][col] === '#';
    }

    function computeAcceleration() {
        let ax = 0;
        let ay = 0;
        if (sensorState.enabled && sensorState.available) {
            ax += sensorState.accel.x;
            ay += sensorState.accel.y;
        }
        const keyAccel = 700;
        if (keyState.left) ax -= keyAccel;
        if (keyState.right) ax += keyAccel;
        if (keyState.up) ay -= keyAccel;
        if (keyState.down) ay += keyAccel;
        return { ax, ay };
    }

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
                showMessage('You reached the goal! Tilt or use arrows to play again.', 'success');
            }
        }
    }

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
                            if (minPen === leftPen) nx = -1; else if (minPen === rightPen) nx = 1; else if (minPen === topPen) ny = -1; else ny = 1;
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

    function loop(timestamp) {
        if (!currentLevel || !renderInfo) return;
        if (lastFrameTime === null) lastFrameTime = timestamp;
        const dt = Math.min(0.032, Math.max(0.001, (timestamp - lastFrameTime) / 1000));
        lastFrameTime = timestamp;
        stepPhysics(dt);
        drawBall();
        animationId = requestAnimationFrame(loop);
    }

    function startLoop() {
        if (animationId) cancelAnimationFrame(animationId);
        lastFrameTime = null;
        animationId = requestAnimationFrame(loop);
    }

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

    function setupOrientation(userInitiated = false) {
        if (typeof DeviceOrientationEvent === 'undefined') {
            return;
        }

        const attachListener = () => {
            if (sensorState.enabled) return;
            sensorState.enabled = true;
            window.addEventListener('deviceorientation', handleOrientation, true);
        };

        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            if (!userInitiated) return; // need an explicit tap on iOS
            DeviceOrientationEvent.requestPermission().then(result => {
                if (result === 'granted') attachListener();
            }).catch(() => {});
        } else {
            if (userInitiated || !isTouchDevice()) {
                attachListener();
            }
        }
    }

    function promptToStartOnMobile() {
        if (!startOverlay) {
            setupOrientation(false);
            return;
        }
        if (!isTouchDevice()) {
            startOverlay.classList.add('d-none');
            setupOrientation(false);
            return;
        }
        startOverlay.classList.remove('d-none');
        const begin = () => {
            startOverlay.classList.add('d-none');
            setupOrientation(true);
            placeBallAtStart();
        };
        startOverlay.addEventListener('click', begin, { once: true });
        startOverlay.addEventListener('touchstart', begin, { once: true });
    }

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

    function renderLevel(levelObj) {
        if (!levelObj) return;
        currentLevel = levelObj;
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
                showMessage('Requested level ' + requestedLevel + ' not found.', 'warning');
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
            promptToStartOnMobile();
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

})();
