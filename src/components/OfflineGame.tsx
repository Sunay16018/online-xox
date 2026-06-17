import { useState, useEffect, useCallback } from 'react';
import { Home, RotateCcw, Bot, Cpu, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

interface OfflineGameProps {
  difficulty: AIDifficulty;
  rounds: number;
  onExit: () => void;
}

// ─── Minimax AI ──────────────────────────────────────────────────────────────
const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board: string[]): { winner: string | null; line: number[] | null } {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

function isDraw(board: string[]): boolean {
  return board.every(cell => cell !== '') && !checkWinner(board).winner;
}

function minimax(board: string[], isMaximizing: boolean, depth: number): number {
  const { winner } = checkWinner(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (isDraw(board)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, false, depth + 1));
        board[i] = '';
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, true, depth + 1));
        board[i] = '';
      }
    }
    return best;
  }
}

function getBestMove(board: string[]): number {
  let bestVal = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = 'O';
      const val = minimax(board, false, 0);
      board[i] = '';
      if (val > bestVal) { bestVal = val; bestMove = i; }
    }
  }
  return bestMove;
}

function getRandomMove(board: string[]): number {
  const empty = board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
  return empty[Math.floor(Math.random() * empty.length)];
}

function getAIMove(board: string[], difficulty: AIDifficulty): number {
  const empty = board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
  if (empty.length === 0) return -1;

  if (difficulty === 'easy') {
    // %80 rastgele, %20 iyi hamle
    return Math.random() < 0.8 ? getRandomMove(board) : getBestMove(board);
  } else if (difficulty === 'normal') {
    // %40 rastgele, %60 iyi hamle
    return Math.random() < 0.4 ? getRandomMove(board) : getBestMove(board);
  } else {
    // hard: her zaman minimax
    return getBestMove(board);
  }
}

// ─── Difficulty Config ───────────────────────────────────────────────────────
const DIFFICULTY_CONFIG = {
  easy:   { label: 'Kolay',  color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', emoji: '😊' },
  normal: { label: 'Normal', color: 'text-amber-500',   bg: 'bg-amber-50 border-amber-200',     badge: 'bg-amber-100 text-amber-700',     emoji: '🤔' },
  hard:   { label: 'Zor',    color: 'text-rose-500',    bg: 'bg-rose-50 border-rose-200',       badge: 'bg-rose-100 text-rose-700',       emoji: '😈' },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function OfflineGame({ difficulty, rounds, onExit }: OfflineGameProps) {
  const [board, setBoard] = useState<string[]>(Array(9).fill(''));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [roundStatus, setRoundStatus] = useState<'playing' | 'ended'>('playing');
  const [roundResult, setRoundResult] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [matchOver, setMatchOver] = useState(false);
  const [matchWinner, setMatchWinner] = useState<'player' | 'ai' | 'draw' | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const cfg = DIFFICULTY_CONFIG[difficulty];

  // ─── End round logic ────────────────────────────────────────────────────
  const endRound = useCallback((result: 'win' | 'lose' | 'draw', line: number[] | null, newBoard: string[]) => {
    setBoard(newBoard);
    setWinningLine(line);
    setRoundStatus('ended');
    setRoundResult(result);

    const newPlayerScore = result === 'win' ? playerScore + 1 : playerScore;
    const newAiScore = result === 'lose' ? aiScore + 1 : aiScore;

    if (result === 'win') setPlayerScore(p => p + 1);
    if (result === 'lose') setAiScore(p => p + 1);

    // Check match over
    const maxWins = Math.ceil(rounds / 2);
    if (newPlayerScore + (result === 'win' ? 0 : 0) >= maxWins ||
        newAiScore + (result === 'lose' ? 0 : 0) >= maxWins ||
        currentRound >= rounds) {

      setTimeout(() => {
        const finalP = result === 'win' ? playerScore + 1 : playerScore;
        const finalA = result === 'lose' ? aiScore + 1 : aiScore;
        setMatchOver(true);
        if (finalP > finalA) setMatchWinner('player');
        else if (finalA > finalP) setMatchWinner('ai');
        else setMatchWinner('draw');
      }, 1800);
    }
  }, [playerScore, aiScore, currentRound, rounds]);

  // ─── AI Move ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlayerTurn && roundStatus === 'playing') {
      setAiThinking(true);
      const delay = difficulty === 'hard' ? 700 : difficulty === 'normal' ? 500 : 400;
      const timer = setTimeout(() => {
        setBoard(prev => {
          const newBoard = [...prev];
          const move = getAIMove(newBoard, difficulty);
          if (move === -1) return prev;
          newBoard[move] = 'O';

          const { winner, line } = checkWinner(newBoard);
          if (winner === 'O') {
            setAiThinking(false);
            endRound('lose', line, newBoard);
            return newBoard;
          }
          if (isDraw(newBoard)) {
            setAiThinking(false);
            endRound('draw', null, newBoard);
            return newBoard;
          }
          setAiThinking(false);
          setIsPlayerTurn(true);
          return newBoard;
        });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, roundStatus, difficulty, endRound]);

  // ─── Player Move ─────────────────────────────────────────────────────────
  const handleCellClick = (idx: number) => {
    if (!isPlayerTurn || board[idx] || roundStatus !== 'playing' || aiThinking) return;

    const newBoard = [...board];
    newBoard[idx] = 'X';
    setBoard(newBoard);

    const { winner, line } = checkWinner(newBoard);
    if (winner === 'X') {
      endRound('win', line, newBoard);
      return;
    }
    if (isDraw(newBoard)) {
      endRound('draw', null, newBoard);
      return;
    }
    setIsPlayerTurn(false);
  };

  // ─── Next Round ──────────────────────────────────────────────────────────
  const handleNextRound = () => {
    if (currentRound < rounds && !matchOver) {
      setBoard(Array(9).fill(''));
      setWinningLine(null);
      setRoundStatus('playing');
      setRoundResult(null);
      setCurrentRound(p => p + 1);
      // Loser starts next round
      setIsPlayerTurn(roundResult !== 'win');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const resultColors = {
    win:  'from-emerald-500 to-teal-600',
    lose: 'from-rose-500 to-red-600',
    draw: 'from-slate-500 to-slate-600',
  };
  const resultLabels = {
    win:  '🎉 Turu Kazandın!',
    lose: '😞 AI Kazandı',
    draw: '🤝 Berabere!',
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4">

      {/* Match Over Modal */}
      <AnimatePresence>
        {matchOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-5"
            >
              <div className="text-5xl">
                {matchWinner === 'player' ? '🏆' : matchWinner === 'ai' ? '🤖' : '🤝'}
              </div>
              <div>
                <h2 className="font-black text-2xl text-slate-900">
                  {matchWinner === 'player' ? 'Tebrikler!' : matchWinner === 'ai' ? 'AI Kazandı' : 'Berabere!'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  {matchWinner === 'player' ? 'AI\'yı yendin!' : matchWinner === 'ai' ? 'Tekrar dene!' : 'Güzel maçtı!'}
                </p>
              </div>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="font-mono text-3xl font-black text-indigo-600">{playerScore}</div>
                  <div className="text-xs text-slate-400 font-bold">Sen</div>
                </div>
                <div className="text-slate-300 font-black text-2xl self-center">:</div>
                <div className="text-center">
                  <div className="font-mono text-3xl font-black text-rose-500">{aiScore}</div>
                  <div className="text-xs text-slate-400 font-bold">AI</div>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                <span>{cfg.emoji}</span> {cfg.label} Zorluk
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onExit}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" /> Menü
                </button>
                <button
                  onClick={() => {
                    setBoard(Array(9).fill(''));
                    setWinningLine(null);
                    setRoundStatus('playing');
                    setRoundResult(null);
                    setPlayerScore(0);
                    setAiScore(0);
                    setCurrentRound(1);
                    setMatchOver(false);
                    setMatchWinner(null);
                    setIsPlayerTurn(true);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Tekrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer">
          <Home className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.badge}`}>
            <Cpu className="w-3 h-3" /> {cfg.label}
          </span>
          <span className="text-xs font-bold text-slate-500">Tur {currentRound}/{rounds}</span>
        </div>
      </div>

      {/* Score Board */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-lg font-black text-indigo-700">X</div>
          <div>
            <div className="font-bold text-sm text-slate-800">Sen</div>
            <div className="text-[10px] text-slate-400">Oyuncu</div>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span className="text-2xl font-black text-indigo-600">{playerScore}</span>
          <span className="text-slate-300 font-black">:</span>
          <span className="text-2xl font-black text-rose-500">{aiScore}</span>
        </div>
        <div className="flex items-center gap-3 flex-row-reverse">
          <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center text-lg font-black text-rose-600">O</div>
          <div className="text-right">
            <div className="font-bold text-sm text-slate-800">AI</div>
            <div className={`text-[10px] font-bold ${cfg.color}`}>{cfg.emoji} {cfg.label}</div>
          </div>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className={`rounded-xl px-4 py-2.5 border text-center text-xs font-bold transition-all ${
        aiThinking
          ? 'bg-rose-50 border-rose-200 text-rose-600'
          : isPlayerTurn && roundStatus === 'playing'
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        {roundStatus === 'ended'
          ? (roundResult ? resultLabels[roundResult] : '')
          : aiThinking
          ? '🤖 AI düşünüyor...'
          : isPlayerTurn
          ? '👆 Senin sıran — X koy!'
          : '⏳ AI hamlesi bekleniyor...'}
      </div>

      {/* Board */}
      <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2.5">
          {board.map((cell, idx) => {
            const isWinCell = winningLine?.includes(idx);
            return (
              <motion.button
                key={idx}
                onClick={() => handleCellClick(idx)}
                whileTap={!cell && isPlayerTurn && roundStatus === 'playing' ? { scale: 0.92 } : {}}
                className={`
                  aspect-square rounded-2xl border-2 text-3xl font-black flex items-center justify-center transition-all
                  ${isWinCell ? 'border-amber-400 bg-amber-50 scale-105 shadow-lg shadow-amber-200' : 'border-slate-100'}
                  ${!cell && isPlayerTurn && roundStatus === 'playing' && !aiThinking
                    ? 'hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer'
                    : 'cursor-default'}
                  ${cell === 'X' ? 'text-indigo-600' : 'text-rose-500'}
                  ${!cell ? 'bg-slate-50' : 'bg-white'}
                `}
              >
                <AnimatePresence>
                  {cell && (
                    <motion.span
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {cell === 'X' ? '✕' : '○'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Next Round Button */}
      <AnimatePresence>
        {roundStatus === 'ended' && !matchOver && currentRound < rounds && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleNextRound}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Sonraki Tur → ({currentRound + 1}/{rounds})
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
