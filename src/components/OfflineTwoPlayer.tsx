import { useState, useCallback } from 'react';
import { Home, RotateCcw, Users, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineTwoPlayerProps {
  rounds: number;
  onExit: () => void;
}

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

export default function OfflineTwoPlayer({ rounds, onExit }: OfflineTwoPlayerProps) {
  const [board, setBoard] = useState<string[]>(Array(9).fill(''));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [roundStatus, setRoundStatus] = useState<'playing' | 'ended'>('playing');
  const [roundResult, setRoundResult] = useState<'X' | 'O' | 'draw' | null>(null);
  const [xScore, setXScore] = useState(0);
  const [oScore, setOScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [matchOver, setMatchOver] = useState(false);
  const [matchWinner, setMatchWinner] = useState<'X' | 'O' | 'draw' | null>(null);

  const endRound = useCallback((result: 'X' | 'O' | 'draw', line: number[] | null, newBoard: string[]) => {
    setBoard(newBoard);
    setWinningLine(line);
    setRoundStatus('ended');
    setRoundResult(result);

    const newXScore = result === 'X' ? xScore + 1 : xScore;
    const newOScore = result === 'O' ? oScore + 1 : oScore;

    if (result === 'X') setXScore(p => p + 1);
    if (result === 'O') setOScore(p => p + 1);

    const maxWins = Math.ceil(rounds / 2);
    if (newXScore >= maxWins || newOScore >= maxWins || currentRound >= rounds) {
      setTimeout(() => {
        const finalX = result === 'X' ? xScore + 1 : xScore;
        const finalO = result === 'O' ? oScore + 1 : oScore;
        setMatchOver(true);
        if (finalX > finalO) setMatchWinner('X');
        else if (finalO > finalX) setMatchWinner('O');
        else setMatchWinner('draw');
      }, 1800);
    }
  }, [xScore, oScore, currentRound, rounds]);

  const handleCellClick = (idx: number) => {
    if (board[idx] || roundStatus !== 'playing') return;

    const newBoard = [...board];
    newBoard[idx] = currentPlayer;
    setBoard(newBoard);

    const { winner, line } = checkWinner(newBoard);
    if (winner) {
      endRound(winner as 'X' | 'O', line, newBoard);
      return;
    }
    if (isDraw(newBoard)) {
      endRound('draw', null, newBoard);
      return;
    }
    setCurrentPlayer(p => p === 'X' ? 'O' : 'X');
  };

  const handleNextRound = () => {
    if (currentRound < rounds && !matchOver) {
      setBoard(Array(9).fill(''));
      setWinningLine(null);
      setRoundStatus('playing');
      setRoundResult(null);
      setCurrentRound(p => p + 1);
      setCurrentPlayer(roundResult === 'X' ? 'O' : 'X');
    }
  };

  const resultLabels = {
    X: '🎉 X Kazandı!',
    O: '🎉 O Kazandı!',
    draw: '🤝 Berabere!',
  };

  const playerColors = {
    X: { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50 border-indigo-200' },
    O: { bg: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-50 border-rose-200' },
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4">
      <AnimatePresence>
        {matchOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-5">
              <div className="text-5xl">
                {matchWinner === 'X' ? '🏆' : matchWinner === 'O' ? '🏆' : '🤝'}
              </div>
              <div>
                <h2 className="font-black text-2xl text-slate-900">
                  {matchWinner === 'X' ? 'X Kazandı!' : matchWinner === 'O' ? 'O Kazandı!' : 'Berabere!'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">Maç sona erdi!</p>
              </div>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="font-mono text-3xl font-black text-indigo-600">{xScore}</div>
                  <div className="text-xs text-slate-400 font-bold">Oyuncu X</div>
                </div>
                <div className="text-slate-300 font-black text-2xl self-center">:</div>
                <div className="text-center">
                  <div className="font-mono text-3xl font-black text-rose-500">{oScore}</div>
                  <div className="text-xs text-slate-400 font-bold">Oyuncu O</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onExit} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-sm cursor-pointer">
                  <Home className="w-4 h-4 inline mr-1" /> Ana Menü
                </button>
                <button onClick={() => { setBoard(Array(9).fill('')); setCurrentPlayer('X'); setWinningLine(null); setRoundStatus('playing'); setRoundResult(null); setXScore(0); setOScore(0); setCurrentRound(1); setMatchOver(false); setMatchWinner(null); }} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 rounded-2xl shadow-lg text-sm cursor-pointer">
                  <RotateCcw className="w-4 h-4 inline mr-1" /> Yeniden Oyna
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="text-center">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg mx-auto mb-1 ${playerColors.X.bg}`}>X</div>
          <div className="font-mono text-xl font-black text-indigo-600">{xScore}</div>
          <div className="text-[10px] text-slate-400 font-bold">Oyuncu X</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tur {currentRound}/{rounds}</div>
          <div className={`mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${currentPlayer === 'X' ? playerColors.X.light : playerColors.O.light}`}>
            <Users className="w-3 h-3" /> Sıra: <span className={currentPlayer === 'X' ? playerColors.X.text : playerColors.O.text}>{currentPlayer}</span>
          </div>
        </div>
        <div className="text-center">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg mx-auto mb-1 ${playerColors.O.bg}`}>O</div>
          <div className="font-mono text-xl font-black text-rose-500">{oScore}</div>
          <div className="text-[10px] text-slate-400 font-bold">Oyuncu O</div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {board.map((cell, idx) => {
            const isWin = winningLine?.includes(idx);
            return (
              <button key={idx} onClick={() => handleCellClick(idx)} disabled={roundStatus !== 'playing'}
                className={`aspect-square rounded-2xl text-4xl font-black flex items-center justify-center transition-all border-2 cursor-pointer
                  ${cell === '' && roundStatus === 'playing' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:scale-[1.02]' : ''}
                  ${cell === 'X' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}
                  ${cell === 'O' ? 'bg-rose-50 border-rose-200 text-rose-500' : ''}
                  ${isWin ? 'ring-4 ring-amber-400/50 scale-105 z-10' : ''}
                  ${roundStatus !== 'playing' ? 'cursor-default' : ''}`}>
                {cell}
              </button>
            );
          })}
        </div>
      </div>

      {roundStatus === 'ended' && !matchOver && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center space-y-3">
          <div className="text-2xl">{resultLabels[roundResult!]}</div>
          <div className="flex gap-3">
            <button onClick={onExit} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm cursor-pointer">
              <Home className="w-4 h-4 inline mr-1" /> Çık
            </button>
            <button onClick={handleNextRound} className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-2.5 rounded-xl shadow-lg text-sm cursor-pointer">
              <RotateCcw className="w-4 h-4 inline mr-1" /> Sonraki Tur
            </button>
          </div>
        </motion.div>
      )}

      <button onClick={onExit} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2">
        <Home className="w-4 h-4" /> Ana Menüye Dön
      </button>
    </div>
  );
}
