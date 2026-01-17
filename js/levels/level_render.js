(function(){
  // Shared renderer for level grids. Exposes LevelRenderer.renderGridToCanvas(canvas, grid, options)
  // options: { maxWidth, maxHeight, minCell, drawGridLines }
  function renderGridToCanvas(canvas, grid, options = {}){
    if (!canvas || !grid || !grid.length) return null;
    const opts = Object.assign({ maxWidth: 800, maxHeight: 600, minCell: 4, drawGridLines: true }, options);

    const rows = grid.length;
    const cols = grid[0].length;

    // ensure rectangular
    if (!grid.every(r => r.length === cols)) {
      throw new Error('Grid rows are not uniform width');
    }

    // compute cell size (CSS pixels)
    const cellSize = Math.max(opts.minCell, Math.floor(Math.min(opts.maxWidth / cols, opts.maxHeight / rows)));

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cols * cellSize}px`;
    canvas.style.height = `${rows * cellSize}px`;
    canvas.width = Math.floor(cols * cellSize * dpr);
    canvas.height = Math.floor(rows * cellSize * dpr);

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Colors
        const COLORS = { '#': '#dc3545', 'S': '#0d6efd', 'G': '#198754', '.': '#f8f9fa' };

        // clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let r = 0; r < rows; r++){
            const row = grid[r];
            for (let c = 0; c < cols; c++){
                const ch = row[c] || '.';
                ctx.fillStyle = COLORS[ch] || COLORS['.'];
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

    // expose on global
    window.LevelRenderer = window.LevelRenderer || {};
    window.LevelRenderer.renderGridToCanvas = renderGridToCanvas;
})();
