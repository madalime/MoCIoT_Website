/**
 * Immediately Invoked Function Expression to encapsulate the LevelRenderer module.
 */
(function(){
  /**
   * Renders a grid representation onto a given canvas element.
   * Exposed as LevelRenderer.renderGridToCanvas(canvas, grid, options).
   *
   * @param {HTMLCanvasElement} canvas - The canvas element where the grid will be rendered.
   * @param {Array<Array<string>>} grid - A 2D array representing the grid. Each cell contains a character.
   * @param {Object} [options={}] - Configuration options for rendering.
   * @param {number} [options.maxWidth=800] - Maximum width of the grid in pixels.
   * @param {number} [options.maxHeight=600] - Maximum height of the grid in pixels.
   * @param {number} [options.minCell=4] - Minimum size of a grid cell in pixels.
   * @param {boolean} [options.drawGridLines=true] - Whether to draw grid lines.
   * @returns {Object|null} An object containing grid dimensions and cell size, or null if rendering fails.
   */
  function renderGridToCanvas(canvas, grid, options = {}){
    if (!canvas || !grid || !grid.length) return null;
    const opts = Object.assign({ maxWidth: 800, maxHeight: 600, minCell: 4, drawGridLines: true }, options);

    const rows = grid.length;
    const cols = grid[0].length;

    // Ensure all rows have the same number of columns
    if (!grid.every(r => r.length === cols)) {
      throw new Error('Grid rows are not uniform width');
    }

    // Compute cell size (CSS pixels)
    const cellSize = Math.max(opts.minCell, Math.floor(Math.min(opts.maxWidth / cols, opts.maxHeight / rows)));

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cols * cellSize}px`;
    canvas.style.height = `${rows * cellSize}px`;
    canvas.width = Math.floor(cols * cellSize * dpr);
    canvas.height = Math.floor(rows * cellSize * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Colors for grid elements
    const COLORS = { '#': '#dc3545', 'S': '#0d6efd', 'G': '#198754', '.': '#f8f9fa' };

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++){
        const row = grid[r];
        for (let c = 0; c < cols; c++){
            const ch = row[c];
            ctx.fillStyle = COLORS[ch] || COLORS['.']; // Default to floor color for unknown characters
            ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);

            if (opts.drawGridLines){
                ctx.strokeStyle = 'rgba(0,0,0,0.06)';
                ctx.lineWidth = 1;
                ctx.strokeRect(c * cellSize + 0.5, r * cellSize + 0.5, cellSize - 1, cellSize - 1);
            }

            if (ch === 'S' || ch === 'G'){
                const padding = Math.max(1, Math.floor(cellSize * 0.15));
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillRect(c * cellSize + padding, r * cellSize + padding, cellSize - padding * 2, cellSize - padding * 2);
                ctx.beginPath();
                ctx.fillStyle = (ch === 'S') ? COLORS['S'] : COLORS['G'];
                ctx.arc(c * cellSize + cellSize / 2, r * cellSize + cellSize / 2, Math.max(1, cellSize * 0.18), 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    return { cols, rows, cellSize };
  }

  // Expose the renderGridToCanvas function on the global LevelRenderer object
  window.LevelRenderer = window.LevelRenderer || {};
  window.LevelRenderer.renderGridToCanvas = renderGridToCanvas;
})();
