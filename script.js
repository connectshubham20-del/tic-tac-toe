/**
 * script.js — Tic Tac Toe Pro Edition
 *
 * Architecture: Single-file modular pattern using plain objects as namespaces.
 * Modules:
 *   Config   — constants & win combos
 *   Sound    — Web Audio API sound effects
 *   AI       — easy (random) & hard (minimax) strategies
 *   Game     — core state & logic
 *   UI       — DOM rendering & animations
 *   App      — wires everything together, handles events
 */

'use strict';

/* ============================================================
   CONFIG — Constants and win combinations
   ============================================================ */
const Config = {
  BOARD_SIZE: 9,          // total cells (3×3)
  WIN_COMBOS: [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6],            // diagonals
  ],
  PLAYERS: { X: 'X', O: 'O' },
  MODES:   { PVP: 'pvp', AI: 'ai' },
  DIFF:    { EASY: 'easy', HARD: 'hard' },
  AI_DELAY_MS: 500,       // ms before AI makes its move
};

/* ============================================================
   SOUND — Web Audio API (no external files needed)
   ============================================================ */
const Sound = (() => {
  let ctx = null;

  /** Lazily create AudioContext on first user gesture */
  function init() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  /** Play a simple tone burst */
  function tone(freq, type, duration, gain = 0.25) {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain_ = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain_.gain.setValueAtTime(gain, ctx.currentTime);
    gain_.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain_);
    gain_.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  return {
    click()  { init(); tone(440, 'sine',   0.08); },
    win()    { init(); tone(660, 'sine',   0.12); setTimeout(() => tone(880, 'sine', 0.18), 120); },
    draw()   { init(); tone(220, 'triangle', 0.3); },
    error()  { init(); tone(180, 'sawtooth', 0.1, 0.15); },
  };
})();

/* ============================================================
   AI — Easy (random) and Hard (minimax) strategies
   ============================================================ */
const AI = (() => {

  /** Pick a random empty cell index */
  function randomMove(board) {
    const empty = board
      .map((v, i) => (v === null ? i : null))
      .filter(i => i !== null);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  /**
   * Minimax with alpha-beta pruning.
   * AI is always 'O', human is always 'X'.
   */
  function minimax(board, isMaximising, alpha, beta, depth) {
    const result = checkWinner(board);
    if (result === Config.PLAYERS.O) return  10 - depth;
    if (result === Config.PLAYERS.X) return -10 + depth;
    if (board.every(Boolean))         return 0;

    const empty = board.map((v, i) => (v === null ? i : null)).filter(i => i !== null);

    if (isMaximising) {
      let best = -Infinity;
      for (const i of empty) {
        board[i] = Config.PLAYERS.O;
        best = Math.max(best, minimax(board, false, alpha, beta, depth + 1));
        board[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break; // prune
      }
      return best;
    } else {
      let best = Infinity;
      for (const i of empty) {
        board[i] = Config.PLAYERS.X;
        best = Math.min(best, minimax(board, true, alpha, beta, depth + 1));
        board[i] = null;
        beta = Math.min(beta, best);
        if (beta <= alpha) break; // prune
      }
      return best;
    }
  }

  /** Return the best cell index using minimax */
  function bestMove(board) {
    let bestVal = -Infinity;
    let move    = -1;
    const empty = board.map((v, i) => (v === null ? i : null)).filter(i => i !== null);

    for (const i of empty) {
      board[i] = Config.PLAYERS.O;
      const val = minimax(board, false, -Infinity, Infinity, 0);
      board[i] = null;
      if (val > bestVal) { bestVal = val; move = i; }
    }
    return move;
  }

  /** Shared win-check used by minimax (operates on a raw board array) */
  function checkWinner(board) {
    for (const [a, b, c] of Config.WIN_COMBOS) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  return {
    getMove(board, difficulty) {
      return difficulty === Config.DIFF.HARD ? bestMove(board) : randomMove(board);
    },
  };
})();

/* ============================================================
   GAME — Core state machine and logic
   ============================================================ */
const Game = (() => {

  // ── State ─────────────────────────────────────────────────
  const state = {
    board:          Array(Config.BOARD_SIZE).fill(null),
    currentPlayer:  Config.PLAYERS.X,
    startingPlayer: Config.PLAYERS.X, // alternates each round
    gameOver:       false,
    locked:         false,            // prevents input during AI delay / animations
    mode:           Config.MODES.PVP,
    difficulty:     Config.DIFF.EASY,
    scores:         { X: 0, O: 0, D: 0 },
    winnerCombo:    null,
    winner:         null,
  };

  // ── Helpers ───────────────────────────────────────────────

  /** Scan win combos; returns { winner, combo } or null */
  function detectWinner(board) {
    for (const combo of Config.WIN_COMBOS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], combo };
      }
    }
    return null;
  }

  function isBoardFull(board) {
    return board.every(Boolean);
  }

  // ── Public API ────────────────────────────────────────────

  function getState() { return state; }

  function configure(mode, difficulty) {
    state.mode       = mode;
    state.difficulty = difficulty;
  }

  /** Start a fresh round (keep scores, alternate starter) */
  function newRound() {
    state.board         = Array(Config.BOARD_SIZE).fill(null);
    state.gameOver      = false;
    state.locked        = false;
    state.winnerCombo   = null;
    state.winner        = null;
    state.currentPlayer = state.startingPlayer;
  }

  /** Wipe everything */
  function resetAll() {
    state.scores        = { X: 0, O: 0, D: 0 };
    state.startingPlayer = Config.PLAYERS.X;
    newRound();
  }

  /**
   * Attempt a player move at cell index `i`.
   * Returns: 'ok' | 'taken' | 'locked'
   */
  function makeMove(i) {
    if (state.locked || state.gameOver)   return 'locked';
    if (state.board[i] !== null)          return 'taken';

    state.board[i]    = state.currentPlayer;
    const result      = detectWinner(state.board);

    if (result) {
      state.winner     = result.winner;
      state.winnerCombo = result.combo;
      state.scores[state.winner]++;
      state.gameOver   = true;
      // next round starter = loser
      state.startingPlayer =
        state.winner === Config.PLAYERS.X ? Config.PLAYERS.O : Config.PLAYERS.X;
    } else if (isBoardFull(state.board)) {
      state.winner     = null;
      state.winnerCombo = null;
      state.scores.D++;
      state.gameOver   = true;
      // next round alternates
      state.startingPlayer =
        state.currentPlayer === Config.PLAYERS.X ? Config.PLAYERS.O : Config.PLAYERS.X;
    } else {
      state.currentPlayer =
        state.currentPlayer === Config.PLAYERS.X ? Config.PLAYERS.O : Config.PLAYERS.X;
    }

    return 'ok';
  }

  return { getState, configure, newRound, resetAll, makeMove };
})();

/* ============================================================
   UI — All DOM reads, writes, and animations
   ============================================================ */
const UI = (() => {

  // ── Cache DOM elements once ───────────────────────────────
  const els = {
    modeScreen:      document.getElementById('modeScreen'),
    gameScreen:      document.getElementById('gameScreen'),
    btnPvP:          document.getElementById('btnPvP'),
    btnAI:           document.getElementById('btnAI'),
    difficultyPanel: document.getElementById('difficultyPanel'),
    btnEasy:         document.getElementById('btnEasy'),
    btnHard:         document.getElementById('btnHard'),
    btnStart:        document.getElementById('btnStart'),
    board:           document.getElementById('board'),
    tileX:           document.getElementById('tileX'),
    tileO:           document.getElementById('tileO'),
    nameX:           document.getElementById('nameX'),
    nameO:           document.getElementById('nameO'),
    scoreX:          document.getElementById('scoreX'),
    scoreO:          document.getElementById('scoreO'),
    scoreDraw:       document.getElementById('scoreDraw'),
    turnPip:         document.getElementById('turnPip'),
    statusText:      document.getElementById('statusText'),
    btnRestart:      document.getElementById('btnRestart'),
    btnChangeMode:   document.getElementById('btnChangeMode'),
    btnResetScores:  document.getElementById('btnResetScores'),
    overlay:         document.getElementById('overlay'),
    overlayEmoji:    document.getElementById('overlayEmoji'),
    overlayTitle:    document.getElementById('overlayTitle'),
    overlaySub:      document.getElementById('overlaySub'),
    btnPlayAgain:    document.getElementById('btnPlayAgain'),
  };

  // Holds references to the 9 cell elements after build
  let cellEls = [];

  // ── Board Builder ─────────────────────────────────────────

  function buildBoard() {
    els.board.innerHTML = '';
    cellEls = [];

    for (let i = 0; i < Config.BOARD_SIZE; i++) {
      const cell = document.createElement('button');
      cell.className   = 'cell';
      cell.dataset.index = i;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Cell ${i + 1}, empty`);
      cell.setAttribute('tabindex', '0');
      cellEls.push(cell);
      els.board.appendChild(cell);
    }

    return cellEls;
  }

  // ── Render Board ──────────────────────────────────────────

  function renderBoard(board, winCombo = null, disabled = false) {
    board.forEach((val, i) => {
      const cell = cellEls[i];
      cell.className = 'cell';
      cell.textContent = val ?? '';
      cell.setAttribute('aria-label',
        `Cell ${i + 1}, ${val ? val : 'empty'}`);

      if (val) {
        cell.classList.add('cell--taken', `cell--${val.toLowerCase()}`);
        cell.setAttribute('aria-disabled', 'true');
        cell.setAttribute('tabindex', '-1');
      } else {
        cell.setAttribute('tabindex', disabled ? '-1' : '0');
        cell.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      }

      if (disabled || val) cell.classList.add('cell--disabled');
    });

    if (winCombo) {
      winCombo.forEach(i => cellEls[i].classList.add('cell--win'));
    }
  }

  // ── Status Bar ────────────────────────────────────────────

  function renderStatus(state) {
    if (state.gameOver) {
      els.turnPip.className = 'status-bar__pip status-bar__pip--none';
      els.turnPip.style.animation = 'none';
      if (state.winner) {
        els.statusText.textContent =
          `${state.winner === Config.PLAYERS.X ? getPlayerName('X', state) : getPlayerName('O', state)} wins!`;
      } else {
        els.statusText.textContent = "It's a draw!";
      }
      return;
    }

    const isX = state.currentPlayer === Config.PLAYERS.X;
    els.turnPip.className =
      `status-bar__pip status-bar__pip--${isX ? 'x' : 'o'}`;
    els.turnPip.style.animation = '';
    els.statusText.textContent =
      `${getPlayerName(state.currentPlayer, state)}'s turn`;
  }

  // ── Scoreboard ────────────────────────────────────────────

  function renderScores(state) {
    // Update numbers with bump animation if changed
    updateScoreEl(els.scoreX,    state.scores.X);
    updateScoreEl(els.scoreO,    state.scores.O);
    updateScoreEl(els.scoreDraw, state.scores.D);

    // Active tile highlight
    els.tileX.classList.toggle('score-tile--active',
      !state.gameOver && state.currentPlayer === Config.PLAYERS.X);
    els.tileO.classList.toggle('score-tile--active',
      !state.gameOver && state.currentPlayer === Config.PLAYERS.O);

    // Update aria labels
    els.scoreX.setAttribute('aria-label',
      `${getPlayerName('X', state)} score: ${state.scores.X}`);
    els.scoreO.setAttribute('aria-label',
      `${getPlayerName('O', state)} score: ${state.scores.O}`);
  }

  function updateScoreEl(el, val) {
    const prev = parseInt(el.textContent, 10);
    el.textContent = val;
    if (val !== prev) {
      el.classList.remove('bump');
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add('bump');
    }
  }

  function renderPlayerNames(state) {
    els.nameX.textContent = getPlayerName('X', state);
    els.nameO.textContent = getPlayerName('O', state);
  }

  // ── Overlay ───────────────────────────────────────────────

  function showOverlay(state) {
    els.overlay.removeAttribute('hidden');
    els.overlayTitle.className = 'overlay__title';

    if (state.winner) {
      const name = state.winner === Config.PLAYERS.X
        ? getPlayerName('X', state)
        : getPlayerName('O', state);
      els.overlayEmoji.textContent  = state.winner === Config.PLAYERS.X ? '🎉' : '🏆';
      els.overlayTitle.textContent  = `${name} Wins!`;
      els.overlayTitle.classList.add(`overlay__title--${state.winner.toLowerCase()}`);
      els.overlaySub.textContent    = 'Brilliant play! Go again?';
    } else {
      els.overlayEmoji.textContent  = '🤝';
      els.overlayTitle.textContent  = "It's a Draw!";
      els.overlayTitle.classList.add('overlay__title--draw');
      els.overlaySub.textContent    = 'So close! Try again?';
    }

    // Focus the play-again button for keyboard users
    setTimeout(() => els.btnPlayAgain.focus(), 200);
  }

  function hideOverlay() {
    els.overlay.setAttribute('hidden', '');
  }

  // ── Screens ───────────────────────────────────────────────

  function showModeScreen() {
    els.gameScreen.setAttribute('hidden', '');
    els.modeScreen.removeAttribute('hidden');
    hideOverlay();
  }

  function showGameScreen() {
    els.modeScreen.setAttribute('hidden', '');
    els.gameScreen.removeAttribute('hidden');
  }

  // ── Shake animation for invalid click ────────────────────

  function shakeCell(i) {
    const cell = cellEls[i];
    cell.classList.remove('cell--shake');
    void cell.offsetWidth; // reflow
    cell.classList.add('cell--shake');
    cell.addEventListener('animationend', () =>
      cell.classList.remove('cell--shake'), { once: true });
  }

  // ── Utility ───────────────────────────────────────────────

  function getPlayerName(player, state) {
    if (state.mode === Config.MODES.AI && player === Config.PLAYERS.O) return 'AI';
    return `Player ${player}`;
  }

  return {
    els,
    buildBoard,
    renderBoard,
    renderStatus,
    renderScores,
    renderPlayerNames,
    showOverlay,
    hideOverlay,
    showModeScreen,
    showGameScreen,
    shakeCell,
    getCellEls: () => cellEls,
  };
})();

/* ============================================================
   APP — Orchestrates Game, UI, Sound, AI; wires all events
   ============================================================ */
const App = (() => {

  // Current UI selections (not yet applied to Game)
  const selection = {
    mode:       Config.MODES.PVP,
    difficulty: Config.DIFF.EASY,
  };

  // ── Init ──────────────────────────────────────────────────

  function init() {
    UI.buildBoard();
    bindModeScreenEvents();
    bindGameScreenEvents();
    UI.showModeScreen();
  }

  // ── Event Binding: Mode Screen ────────────────────────────

  function bindModeScreenEvents() {
    const { els } = UI;

    // Mode card selection
    [els.btnPvP, els.btnAI].forEach(btn => {
      btn.addEventListener('click', () => selectMode(btn.dataset.mode));
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectMode(btn.dataset.mode);
        }
      });
    });

    // Difficulty buttons
    [els.btnEasy, els.btnHard].forEach(btn => {
      btn.addEventListener('click', () => selectDifficulty(btn.dataset.diff));
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDifficulty(btn.dataset.diff);
        }
      });
    });

    // Start
    els.btnStart.addEventListener('click', startGame);
    els.btnStart.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
    });

    // Default selection
    selectMode(Config.MODES.PVP);
  }

  function selectMode(mode) {
    selection.mode = mode;
    const { els } = UI;

    // Toggle active class on cards
    els.btnPvP.classList.toggle('mode-card--active', mode === Config.MODES.PVP);
    els.btnAI.classList.toggle('mode-card--active',  mode === Config.MODES.AI);

    // Show/hide difficulty panel
    const showDiff = mode === Config.MODES.AI;
    els.difficultyPanel.hidden = !showDiff;
    els.difficultyPanel.setAttribute('aria-hidden', String(!showDiff));
  }

  function selectDifficulty(diff) {
    selection.difficulty = diff;
    const { els } = UI;
    els.btnEasy.classList.toggle('diff-btn--active', diff === Config.DIFF.EASY);
    els.btnHard.classList.toggle('diff-btn--active', diff === Config.DIFF.HARD);
  }

  // ── Start Game ────────────────────────────────────────────

  function startGame() {
    Game.configure(selection.mode, selection.difficulty);
    Game.resetAll();
    UI.showGameScreen();
    UI.renderPlayerNames(Game.getState());
    renderAll();
    bindBoardEvents();

    // Kick off AI if it goes first (unlikely but possible)
    maybeAIMove();
  }

  // ── Event Binding: Game Screen ────────────────────────────

  function bindGameScreenEvents() {
    const { els } = UI;

    els.btnRestart.addEventListener('click', onRestart);
    els.btnChangeMode.addEventListener('click', onChangeMode);
    els.btnResetScores.addEventListener('click', onResetScores);
    els.btnPlayAgain.addEventListener('click', onRestart);

    // Close overlay on backdrop click
    document.getElementById('overlayBackdrop').addEventListener('click', onRestart);
  }

  function bindBoardEvents() {
    // Rebuild the board DOM fresh (clears old listeners automatically)
    UI.buildBoard();

    UI.getCellEls().forEach((cell, i) => {
      cell.addEventListener('click', () => onCellClick(i));
      cell.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCellClick(i); }
      });
    });
  }

  // ── Cell Click Handler ────────────────────────────────────

  function onCellClick(i) {
    const state = Game.getState();

    // Block clicks in AI mode when it's AI's turn
    if (state.mode === Config.MODES.AI &&
        state.currentPlayer === Config.PLAYERS.O) return;

    const result = Game.makeMove(i);

    if (result === 'locked') return;

    if (result === 'taken') {
      Sound.error();
      UI.shakeCell(i);
      return;
    }

    Sound.click();
    renderAll();

    const fresh = Game.getState();
    if (fresh.gameOver) {
      handleGameOver(fresh);
    } else {
      maybeAIMove();
    }
  }

  // ── AI Move ───────────────────────────────────────────────

  function maybeAIMove() {
    const state = Game.getState();
    if (state.mode !== Config.MODES.AI)          return;
    if (state.currentPlayer !== Config.PLAYERS.O) return;
    if (state.gameOver)                            return;

    // Lock board during AI "thinking" delay
    state.locked = true;
    UI.renderBoard(state.board, null, true);

    setTimeout(() => {
      const currentState = Game.getState();
      if (currentState.gameOver) return; // player may have reset

      const move = AI.getMove([...currentState.board], currentState.difficulty);
      if (move === -1 || move === undefined) return;

      Game.makeMove(move);
      Sound.click();
      renderAll();

      const after = Game.getState();
      if (after.gameOver) handleGameOver(after);
    }, Config.AI_DELAY_MS);
  }

  // ── Game Over Handler ─────────────────────────────────────

  function handleGameOver(state) {
    if (state.winner) Sound.win();
    else              Sound.draw();

    // Small delay so win highlight is visible before overlay
    setTimeout(() => UI.showOverlay(state), 600);
  }

  // ── Control Handlers ─────────────────────────────────────

  function onRestart() {
    Game.newRound();
    UI.hideOverlay();
    renderAll();
    bindBoardEvents();
    maybeAIMove();
  }

  function onChangeMode() {
    UI.showModeScreen();
  }

  function onResetScores() {
    Game.resetAll();
    UI.hideOverlay();
    renderAll();
    bindBoardEvents();
    maybeAIMove();
  }

  // ── Render All ────────────────────────────────────────────

  function renderAll() {
    const state = Game.getState();
    UI.renderBoard(state.board, state.winnerCombo, state.gameOver || state.locked);
    UI.renderStatus(state);
    UI.renderScores(state);
  }

  return { init };
})();

/* ── Bootstrap ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());
