# Copilot Instructions for Bulb It Puzzle Game

This project is a browser-based puzzle game implemented in vanilla JavaScript, HTML, and CSS. The main files are:
- `index.html`: UI structure and containers for game, settings, and controls
- `script.js`: Game logic, state management, UI updates, and event handling
- `style.css`: Theming, grid/cell styles, and responsive layout

## Architecture & Data Flow
- The game grid is rendered in the `#game` div. Grid size and initial tile values are controlled by constants in `script.js`.
- Game state (moves, score, efficiency) is tracked in JS and updated in the DOM via direct manipulation.
- Settings (grid size, theme, show values) are toggled via checkboxes and buttons, with state changes reflected immediately.
- Undo/restart functionality uses a history stack (see `MAX_HISTORY_SIZE` in `script.js`).
- Animation and performance are tuned via constants (e.g., `ANIMATION_DURATION`, `BATCH_UPDATE_DELAY`).

## Developer Workflows
- No build step: edit files directly and refresh browser to test changes.
- Debugging: Use browser DevTools (console, DOM inspector) for JS and CSS.
- No automated tests or CI/CD present.

## Project-Specific Patterns
- All game logic is in a single JS file, organized by sections (constants, state, event handlers, rendering, etc.).
- CSS uses custom properties for theming and cell colors. Theme toggling is handled by switching root variables.
- Grid size and tile values are extensible via the `INITIAL_TILES` and `RANDOM_TILE_VALUES` objects.
- DOM elements are cached and updated in batches for performance.
- All UI controls are referenced by ID and manipulated directly (no frameworks).

## Integration Points
- No external dependencies or libraries; all logic is custom.
- The game is self-contained and does not communicate with external services.

## Conventions
- Use semantic HTML and descriptive IDs/classes for UI elements.
- Keep all game logic in `script.js` and all styles in `style.css`.
- Use constants for configuration and tuning.
- Prefer direct DOM manipulation over abstraction layers.

## Example: Adding a New Grid Size
1. Add a new entry to `INITIAL_TILES` and `RANDOM_TILE_VALUES` in `script.js`.
2. Add a new `.size-square` div in the `#sizeOptions` container in `index.html`.
3. Update CSS if new cell values require new colors.

---
For questions or unclear patterns, review the main files or ask for clarification.
