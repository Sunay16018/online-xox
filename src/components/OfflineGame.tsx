import { useState, useEffect, useCallback } from 'react';
import { Home, RotateCcw, Bot, Cpu, CheckCircle2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'ai' | 'twoPlayer';

interface OfflineGameProps {
  difficulty: AIDifficulty;
  rounds: number;
  mode: GameMode; // Yeni: 'ai' veya 'twoPlayer'
  onExit: () => void;
}

// ─── Minimax AI (aynı) ──────────────────────────────────────────────────────
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
    return Math.random() < 0.8 ? getRandomMove(board) : getBestMove(board);
  } else if (difficulty === 'normal') {
    return Math.random() < 0.4 ? getRandomMove(board) : getBestMove(board);
  } else {
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
export default function OfflineGame({ difficulty, rounds, mode, onExit }: OfflineGameProps) {
  const [board, setBoard] = useState<string[]>(Array(9).fill(''));
  const [isPlayer1Turn, setIsPlayer1Turn] = useState(true); // X oyuncusu (Player 1)
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [roundStatus, setRoundStatus] = useState<'playing' | 'ended'>('playing');
  const [roundResult, setRoundResult] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [matchOver, setMatchOver] = useState(false);
  const [matchWinner, setMatchWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const cfg = DIFFICULTY_CONFIG[difficulty];
  const isAIMode = mode === 'ai';

  // Player 1 = X (her zaman sol taraf), Player 2 = O (sağ taraf)
  const p1Name = isAIMode ? 'Sen' : 'Oyuncu 1';
  const p2Name = isAIMode ? 'AI' : 'Oyuncu 2';

  // ─── End round logic ────────────────────────────────────────────────────
  const endRound = useCallback((result: 'p1' | 'p2' | 'draw', line: number[] | null, newBoard: string[]) => {
    setBoard(newBoard);
    setWinningLine(line);
    setRoundStatus('ended');
    setRoundResult(result);

    if (result === 'p1') setPlayer1Score(p => p + 1);
    if (result === 'p2') setPlayer2Score(p => p + 1);

    const maxWins = Math.ceil(rounds / 2);
    const newP1Score = result === 'p1' ? player1Score + 1 : player1Score;
    const newP2Score = result === 'p2' ? player2Score + 1 : player2Score;

    if (newP1Score >= maxWins || newP2Score >= maxWins || currentRound >= rounds) {
      setTimeout(() => {
        setMatchOver(true);
        if (newP1Score > newP2Score) setMatchWinner('p1');
        else if (newP2Score > newP1Score) setMatchWinner('p2');
        else setMatchWinner('draw');
      }, 1800);
    }
  }, [player1Score, player2Score, currentRound, rounds]);

  // ─── AI Move ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAIMode) return;
    if (isPlayer1Turn || roundStatus !== 'playing' || aiThinking) return;

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
          endRound('p2', line, newBoard);
          return newBoard;
        }
        if (isDraw(newBoard)) {
          setAiThinking(false);
          endRound('draw', null, newBoard);
          return newBoard;
        }
        setAiThinking(false);
        setIsPlayer1Turn(true);
        return newBoard;
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [isPlayer1Turn, roundStatus, difficulty, endRound, isAIMode, aiThinking]);

  // ─── Player Move ─────────────────────────────────────────────────────────
  const handleCellClick = (idx: number) => {
    if (roundStatus !== 'playing' || aiThinking) return;
    
    // İki kişilik modda sıra kimdeyse o oynar
    // AI modunda sadece Player 1 (X) oynar, Player 2 AI
    if (isAIMode && !isPlayer1Turn) return;
    if (board[idx]) return;

    const newBoard = [...board];
    const currentSymbol = isPlayer1Turn ? 'X' : 'O';
    newBoard[idx] = currentSymbol;
    setBoard(newBoard);

    const { winner, line } = checkWinner(newBoard);
    if (winner) {
      endRound(winner === 'X' ? 'p1' : 'p2', line, newBoard);
      return;
    }
    if (isDraw(newBoard)) {
      endRound('draw', null, newBoard);
      return;
    }

    // Sırayı değiştir
    setIsPlayer1Turn(!isPlayer1Turn);
  };

  // ─── Next Round ──────────────────────────────────────────────────────────
  const handleNextRound = () => {
    if (currentRound < rounds && !matchOver) {
      setBoard(Array(9).fill(''));
      setWinningLine(null);
      setRoundStatus('playing');
      setRoundResult(null);
      setCurrentRound(p => p + 1);
      // Kaybeden başlasın (draw ise rastgele)
      if (roundResult === 'p1') setIsPlayer1Turn(false);
      else if (roundResult === 'p2') setIsPlayer1Turn(true);
      else setIsPlayer1Turn(Math.random() < 0.5);
    }
  };

  const resultLabels = {
    p1: `🎉 ${p1Name} Kazandı!`,
    p2: `😞 ${p2Name} Kazandı!`,
    draw: '🤝 Berabere!',
  };

  const resultColors = {
    p1: 'from-emerald-500 to-teal-600',
    p2: 'from-rose-500 to-red-600',
    draw: 'from-slate-500 to-slate-600',
  };

  // ─── Render ───────────────────────────────────────────────────────────────
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
                {matchWinner === 'p1' ? '🏆' : matchWinner === 'p2' ? '👑' : '🤝'}
              </div>
              <div>
                <h2 className="font-black text-2xl text-slate-900">
                  {matchWinner === 'p1' ? `${p1Name} Kazandı!` : 
                   matchWinner === 'p2' ? `${p2Name} Kazandı!` : 
                   'Berabere!'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  {isAIMode 
                    ? (matchWinner === 'p1' ? 'AI\'yı yendin! 🎉' : matchWinner === 'p2' ? 'AI kazandı, tekrar dene!' : 'Güzel maçtı!')
                    : (matchWinner === 'p1' ? 'Oyuncu 1 şampiyon!' : matchWinner === 'p2' ? 'Oyuncu 2 şampiyon!' : 'Mükemmel denge!')}
                </p>
              </div>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="font-mono text-3xl font-black text-indigo-600">{player1Score}</div>
                  <div className="text-xs text-slate-400 font-bold">{p1Name}</div>
                </div>
                <div className="text-slate-300 font-black text-2xl self-center">:</div>
                <div className="text-center">
                  <div className="font-mono text-3xl font-black text-rose-500">{player2Score}</div>
                  <div className="text-xs text-slate-400 font-bold">{p2Name}</div>
                </div>
              </div>
              {isAIMode && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.badge}`}>
                  <span>{cfg.emoji}</span> {cfg.label} Zorluk
                </div>
              )}
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
                    setPlayer1Score(0);
                    setPlayer2Score(0);
                    setCurrentRound(1);
                    setMatchOver(false);
                    setMatchWinner(null);
                    setIsPlayer1Turn(true);
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
          {isAIMode ? (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.badge}`}>
              <Cpu className="w-3 h-3" /> {cfg.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <Users className="w-3 h-3" /> 2 Kişilik
            </span>
          )}
          <span className="text-xs font-bold text-slate-500">Tur {currentRound}/{rounds}</span>
        </div>
      </div>

      {/* Score Board */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-lg font-black text-indigo-700">X</div>
          <div>
            <div className="font-bold text-sm text-slate-800">{p1Name}</div>
            <div className="text-[10px] text-slate-400">{isAIMode ? 'Sen' : 'Oyuncu 1'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span className="text-2xl font-black text-indigo-600">{player1Score}</span>
          <span className="text-slate-300 font-black">:</span>
          <span className="text-2xl font-black text-rose-500">{player2Score}</span>
        </div>
        <div className="flex items-center gap-3 flex-row-reverse">
          <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center text-lg font-black text-rose-600">O</div>
          <div className="text-right">
            <div className="font-bold text-sm text-slate-800">{p2Name}</div>
            <div className={`text-[10px] font-bold ${isAIMode ? cfg.color : 'text-purple-600'}`}>
              {isAIMode ? `${cfg.emoji} ${cfg.label}` : 'Oyuncu 2'}
            </div>
          </div>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className={`rounded-xl px-4 py-2.5 border text-center text-xs font-bold transition-all ${
        aiThinking
          ? 'bg-rose-50 border-rose-200 text-rose-600'
          : roundStatus === 'playing'
          ? isPlayer1Turn
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-purple-50 border-purple-200 text-purple-700'
          : 'bg-slate-50 border-slate-200 text-slate-500'
      }`}>
        {roundStatus === 'ended'
          ? (roundResult ? resultLabels[roundResult] : '')
          : aiThinking
          ? '🤖 AI düşünüyor...'
          : isPlayer1Turn
          ? `👆 ${p1Name}'in sırası — X koy!`
          : `✋ ${p2Name}'in sırası — O koy!`}
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
                whileTap={!cell && roundStatus === 'playing' ? { scale: 0.92 } : {}}
                className={`
                  aspect-square rounded-2xl border-2 text-3xl font-black flex items-center justify-center transition-all
                  ${isWinCell ? 'border-amber-400 bg-amber-50 scale-105 shadow-lg shadow-amber-200' : 'border-slate-100'}
                  ${!cell && roundStatus === 'playing' && !aiThinking
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