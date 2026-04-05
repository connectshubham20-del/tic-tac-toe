const cells = document.querySelectorAll('.cell');
const status = document.getElementById('status');
const overlay = document.getElementById('overlay');
const popupMsg = document.getElementById('popup-msg');
const popupIcon = document.getElementById('popup-icon');
const restartBtn = document.getElementById('restart-btn');
const resetBtn = document.getElementById('reset-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const scoreX = document.getElementById('score-x');
const scoreO = document.getElementById('score-o');
const scoreDraw = document.getElementById('score-draw');

const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

let board = Array(9).fill('');
let currentPlayer = 'X';
let gameOver = false;
let scores = { X: 0, O: 0, Draw: 0 };

function init() {
  board = Array(9).fill('');
  currentPlayer = 'X';
  gameOver = false;
  cells.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });
  status.textContent = "Player X's turn";
  overlay.classList.remove('show');
}

function checkWinner() {
  for (const [a, b, c] of WIN_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], combo: [a, b, c] };
    }
  }
  if (board.every(cell => cell !== '')) return { winner: 'Draw', combo: [] };
  return null;
}

function handleClick(e) {
  const idx = e.target.dataset.index;
  if (gameOver || board[idx]) return;

  board[idx] = currentPlayer;
  const cell = e.target;
  cell.textContent = currentPlayer;
  cell.classList.add(currentPlayer.toLowerCase(), 'taken');

  const result = checkWinner();
  if (result) {
    gameOver = true;
    if (result.winner === 'Draw') {
      scores.Draw++;
      scoreDraw.textContent = scores.Draw;
      status.textContent = "It's a Draw!";
      setTimeout(() => showPopup("It's a Draw!", '🤝'), 400);
    } else {
      scores[result.winner]++;
      if (result.winner === 'X') scoreX.textContent = scores.X;
      else scoreO.textContent = scores.O;
      result.combo.forEach(i => cells[i].classList.add('win'));
      status.textContent = `Player ${result.winner} Wins!`;
      setTimeout(() => showPopup(`Player ${result.winner} Wins!`, '🎉'), 400);
    }
  } else {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    status.textContent = `Player ${currentPlayer}'s turn`;
  }
}

function showPopup(msg, icon) {
  popupMsg.textContent = msg;
  popupIcon.textContent = icon;
  overlay.classList.add('show');
}

cells.forEach(cell => cell.addEventListener('click', handleClick));
restartBtn.addEventListener('click', init);
playAgainBtn.addEventListener('click', init);
resetBtn.addEventListener('click', () => {
  scores = { X: 0, O: 0, Draw: 0 };
  scoreX.textContent = 0;
  scoreO.textContent = 0;
  scoreDraw.textContent = 0;
  init();
});

init();


