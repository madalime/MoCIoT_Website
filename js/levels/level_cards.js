/**
 * Key used to store level completion times in localStorage.
 */
const COMPLETION_STORAGE_KEY = 'levelCompletionTimes';

/**
 * Loads the level completion times from localStorage.
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
 * Formats a time duration in milliseconds into a string (MM:SS.HH).
 * @param {number|null} ms - Time in milliseconds.
 * @returns {string} Formatted time string or '-' if input is null.
 */
function formatMs(ms) {
    if (ms == null) return '-';
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((totalSeconds * 100) % 100);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
}

/**
 * Maps a difficulty level to a corresponding CSS badge class.
 * @param {string} diff - Difficulty level (e.g., 'easy', 'medium', 'hard').
 * @returns {string} CSS class for the badge.
 */
function difficultyBadgeClass(diff) {
    switch ((diff || '').toLowerCase()) {
        case 'easy':
            return 'bg-success';
        case 'medium':
            return 'bg-warning text-dark';
        case 'hard':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

/**
 * Creates a level card element.
 * @param {Object} level - Level data including name, difficulty, and grid.
 * @param {Object} completionTimes - Mapping of level numbers to completion times.
 * @returns {HTMLElement} A column element containing the level card.
 */
function createLevelCard(level, completionTimes) {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-md-4 mb-4 d-flex';

    const card = document.createElement('div');
    card.className = 'card flex-fill shadow-sm';
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Level ${level.level}: ${level.name}`);

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body d-flex flex-column';

    // Grid preview: render a small canvas using the shared renderer
    let preview = null;
    if (Array.isArray(level.grid) && level.grid.length && window.LevelRenderer && window.LevelRenderer.renderGridToCanvas) {
        const canvas = document.createElement('canvas');
        canvas.className = 'mb-3 rounded border w-100 h-100';
        canvas.setAttribute('aria-label', `Preview for ${level.name || 'level ' + level.level}`);
        try {
            window.LevelRenderer.renderGridToCanvas(canvas, level.grid, { maxWidth: 220, maxHeight: 140, minCell: 4, drawGridLines: true });
            preview = canvas;
        } catch (e) {
            console.warn('Level preview render failed', e);
            preview = null;
        }
    }

    // Title row: left side contains the H5 title + difficulty badge; right side holds the Completed badge
    const titleRow = document.createElement('div');
    titleRow.className = 'd-flex justify-content-between align-items-start mb-2 gap-2';

    // Left wrapper keeps the title and difficulty badge together and preserves h5 sizing
    const leftWrap = document.createElement('div');
    leftWrap.className = 'd-flex align-items-start gap-2';

    const title = document.createElement('h5');
    title.className = 'card-title mb-0';
    title.textContent = level.name || `Level ${level.level}`;

    const difficultyBadge = document.createElement('span');
    difficultyBadge.className = 'badge ' + difficultyBadgeClass(level.difficulty) + ' ms-2';
    difficultyBadge.textContent = level.difficulty || '';

    title.appendChild(difficultyBadge);
    leftWrap.appendChild(title);

    // Right wrapper will contain an element with the same typographic size as the h5
    const rightWrap = document.createElement('div');
    // ms-auto ensures the rightWrap is pushed to the far right of the flex row
    rightWrap.className = 'd-flex align-items-center ms-auto';

    // Completed badge (if present) is wrapped in an element with h5 sizing so it matches visually
    if (completionTimes && completionTimes[level.level] != null) {
        const doneWrapper = document.createElement('span');
        doneWrapper.className = 'h5 mb-0';

        const done = document.createElement('span');
        done.className = 'badge bg-info text-dark';
        done.textContent = 'Completed';

        doneWrapper.appendChild(done);
        rightWrap.appendChild(doneWrapper);
    }

    titleRow.appendChild(leftWrap);
    titleRow.appendChild(rightWrap);

    const meta = document.createElement('div');
    meta.className = 'mb-2 text-muted small';
    const ms = completionTimes ? completionTimes[level.level] : null;
    meta.textContent = 'Best time: ' + formatMs(ms);

    // Make the whole card act as the play action instead of a separate button.
    // Build the target URL once.
    const playUrl = 'play/index.html?level=' + encodeURIComponent(level.level);
    // Visual affordance: pointer cursor
    card.style.cursor = 'pointer';
    // Accessibility: make card focusable and expose as a link-like control
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    // Update aria-label to indicate the action
    card.setAttribute('aria-label', (card.getAttribute('aria-label') || '') + ' — Click or press Enter to play');

    // Navigation action
    const navigateToPlay = () => { window.location.href = playUrl; };

    // Click and keyboard handlers
    card.addEventListener('click', navigateToPlay);
    card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            navigateToPlay();
        }
    });

    // Assemble card: preview first, then title/description/meta, then button
    if (preview) cardBody.appendChild(preview);
    // Append the title row (leftWrap + rightWrap). Removed stray empty element to allow proper alignment.
    cardBody.appendChild(titleRow);
    cardBody.appendChild(meta);
    // Note: no separate button; click on the card triggers play.

    card.appendChild(cardBody);
    col.appendChild(card);
    return col;
}

/**
 * Fetches level data and renders level cards on the page.
 */
document.addEventListener('DOMContentLoaded', () => {
    fetch('../js/levels/levels.json') // fix using relative path
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok: ' + response.status);
            return response.json();
        })
        .then(levels => {
            const row = document.getElementById('levelsRow');
            row.innerHTML = '';
            if (!Array.isArray(levels) || levels.length === 0) {
                document.getElementById('noLevels').hidden = false;
                return;
            }

            const completionTimes = loadCompletionTimes();

            levels.forEach(level => {
                const cardCol = createLevelCard(level, completionTimes);
                row.appendChild(cardCol);
            });
        })
        .catch(err => {
            console.error(err);
            document.getElementById('noLevels').hidden = false;
        });
});