(function () {
    const canvas = document.getElementById('levelCanvas');
    const msg = document.getElementById('messageArea');

    // colors and drawing are handled by the shared LevelRenderer

    // Get level param from URL
    const params = new URLSearchParams(location.search);
    const levelParam = params.get('level') || params.get('l') || '1';
    const requestedLevel = parseInt(levelParam, 10) || 1;

    // Path from this page (levels/play/index.html) to levels.json
    const levelsJsonPath = '../../js/levels/levels.json';

    let currentLevel = null;

    function showMessage(text, type = 'danger') {
        msg.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
    }

    function clearMessage() {
        msg.innerHTML = '';
    }

    function drawGrid(grid) {
        // Delegate drawing to shared renderer with larger max size for the play canvas
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
                // For a centered canvas, left edge = (windowWidth - canvasWidth)/2.
                // To ensure left edge >= br + gap: canvasWidth <= windowWidth - 2*(br + gap)
                const allowed = Math.floor(window.innerWidth - 2 * (br + gap));
                if (!Number.isNaN(allowed)) {
                    if (allowed > 0) {
                        safeWidthLimit = Math.min(safeWidthLimit, allowed);
                    } else {
                        // extreme case: back button too wide for centered canvas; fall back to a small safe width
                        safeWidthLimit = Math.min(safeWidthLimit, 200);
                    }
                }
            }

            const maxWidth = Math.min(aspectWidth, safeWidthLimit, 1200);

            // Ensure the play area reserves the computed vertical space so we can center the canvas inside it
            const playArea = document.querySelector('.play-area');
            if (playArea) playArea.style.minHeight = `${maxHeight}px`;

            const renderResult = window.LevelRenderer.renderGridToCanvas(canvas, grid, { maxWidth, maxHeight, minCell: 8, drawGridLines: true });

            // If width limited (aspectWidth > maxWidth) and the rendered height is smaller than maxHeight,
            // vertically center the canvas inside the reserved play-area by adding top margin.
            if (renderResult) {
                const renderedHeight = renderResult.rows * renderResult.cellSize; // CSS pixels
                if (aspectWidth > maxWidth && renderedHeight < maxHeight) {
                    const topGap = Math.floor((maxHeight - renderedHeight) / 2);
                    canvas.style.marginTop = `${topGap}px`;
                } else {
                    canvas.style.marginTop = '0px';
                }
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
        drawGrid(levelObj.grid);
        // Start button removed: no action required here.
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
            // validate grid shape (all rows same length)
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

            // render
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

})();