import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, Zap, CornerDownLeft, VolumeX, MessageSquare, ListCollapse, Home, Trophy, Trash2 } from 'lucide-react';
import { PlayerState, EloChange } from '../types';
import LobbyChat from './LobbyChat';
import { Socket } from 'socket.io-client';

interface TicTacToeProps {
  socket: Socket | null;
  roomCode: string;
  myUserId: string;
  opponent: PlayerState;
  me: PlayerState;
  roundsLimit: number;
  initialGameBoard: string[];
  initialTurnUserId: string;
  initialStatus: 'playing' | 'round_ended' | 'finished';
  onExitGame: () => void;
}

export default function TicTacToeGame({
  socket,
  roomCode,
  myUserId,
  opponent,
  me,
  roundsLimit,
  initialGameBoard,
  initialTurnUserId,
  initialStatus,
  onExitGame,
}: TicTacToeProps) {
  const [gameBoard, setGameBoard] = useState<string[]>(initialGameBoard);
  const [turnUserId, setTurnUserId] = useState<string>(initialTurnUserId);
  const [status, setStatus] = useState<'playing' | 'round_ended' | 'finished'>(initialStatus);
  
  // Scoring parameters
  const [myScore, setMyScore] = useState(me.score || 0);
  const [oppScore, setOppScore] = useState(opponent.score || 0);
  const [currentRound, setCurrentRound] = useState(1);
  
  // Winning indicator line Highlight
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  
  // Game ending structures
  const [matchWinnerName, setMatchWinnerName] = useState<string | null>(null);
  const [matchWinnerId, setMatchWinnerId] = useState<string | null>(null);
  const [eloChangesLog, setEloChangesLog] = useState<EloChange[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleBoardUpdate = (data: { gameBoard: string[]; turnUserId: string }) => {
      setGameBoard(data.gameBoard);
      setTurnUserId(data.turnUserId);
      setErrorMessage(null);
    };

    const handleRoundEnd = (data: {
      scoreWinnerId: string | null;
      winnerName: string;
      winningLine: number[] | null;
      scores: Record<string, number>;
      nextRound: number;
      gameFinished: boolean;
    }) => {
      setStatus('round_ended');
      setWinningLine(data.winningLine);
      
      // Update scores dynamically
      if (data.scores) {
        setMyScore(data.scores[myUserId] || 0);
        const oppId = opponent.userId;
        setOppScore(data.scores[oppId] || 0);
      }
    };

    const handleNextRoundStart = (data: {
      currentRound: number;
      gameBoard: string[];
      turnUserId: string;
      status: 'playing';
    }) => {
      setGameBoard(data.gameBoard);
      setTurnUserId(data.turnUserId);
      setStatus(data.status);
      setCurrentRound(data.currentRound);
      setWinningLine(null);
      setErrorMessage(null);
    };

    const handleMatchFinished = (data: {
      winnerUserId: string | null;
      winnerName: string;
      scores: Record<string, number>;
      eloChanges: EloChange[];
    }) => {
      setStatus('finished');
      setMatchWinnerId(data.winnerUserId);
      setMatchWinnerName(data.winnerName);
      setEloChangesLog(data.eloChanges || []);
      
      if (data.scores) {
        setMyScore(data.scores[myUserId] || 0);
        setOppScore(data.scores[opponent.userId] || 0);
      }
    };

    socket.on('board-updated', handleBoardUpdate);
    socket.on('round-ended', handleRoundEnd);
    socket.on('next-round-started', handleNextRoundStart);
    socket.on('match-finished', handleMatchFinished);

    return () => {
      socket.off('board-updated', handleBoardUpdate);
      socket.off('round-ended', handleRoundEnd);
      socket.off('next-round-started', handleNextRoundStart);
      socket.off('match-finished', handleMatchFinished);
    };
  }, [socket, myUserId, opponent.userId]);

  // Cellular grid turn triggers
  const handleCellClick = (index: number) => {
    if (!socket || status !== 'playing') return;
    if (turnUserId !== myUserId) {
      setErrorMessage('Sıra sizde değil! Rakibinizin hamlesini bekleyin.');
      return;
    }
    if (gameBoard[index] !== '') return;

    socket.emit('make-move', { index, roomCode }, (result: { error?: string }) => {
      if (result && result.error) {
        setErrorMessage(result.error);
      }
    });
  };

  // Next round trigger
  const triggerNextRound = () => {
    if (!socket) return;
    socket.emit('request-next-round', { roomCode });
  };

  const handleForfeit = () => {
    if (!socket) return;
    const confirmLeave = window.confirm('Oyundan çekilmek istediğinize emin misiniz? Maçı hükmen kaybedeceksiniz ve ELO puanınız düşecektir.');
    if (confirmLeave) {
      socket.emit('leave-room', { roomCode });
      onExitGame();
    }
  };

  const isMyTurn = turnUserId === myUserId;
  const mySymbol = me.symbol;
  const oppSymbol = opponent.symbol;

  return (
    <section id="tic-tac-toe-game" className="max-w-6xl mx-auto py-4 px-4 space-y-6">
      {/* Upper Status Panel */}
      <div id="game-status-bar" className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 md:p-6 shadow-md">
        <div className="flex items-center gap-2">
          <span className="bg-indigo-600/20 text-indigo-400 font-bold px-3 py-1 rounded-full text-xs border border-indigo-500/30">
            Oda Kodu: {roomCode}
          </span>
          <span className="text-slate-400 text-xs hidden sm:inline">
            • {roundsLimit} Tur Üzerinden
          </span>
        </div>

        {/* Dynamic game turn banners */}
        <div className="flex items-center gap-2">
          {status === 'playing' ? (
            <div id="turn-indicator" className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              isMyTurn 
                ? 'bg-indigo-600 text-white border-indigo-500 animate-pulse'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Zap className={`w-3.5 h-3.5 ${isMyTurn ? 'fill-indigo-300 stroke-indigo-200' : ''}`} />
              {isMyTurn ? 'Senin Sıran' : 'Rakibin Sırası'}
            </div>
          ) : status === 'round_ended' ? (
            <span id="round-ended-badge" className="bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold px-4 py-1.5 rounded-xl uppercase tracking-wider">
              Tur Sonu
            </span>
          ) : (
            <span id="game-finished-badge" className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-4 py-1.5 rounded-xl uppercase tracking-wider">
              Oyun Tamamlandı
            </span>
          )}
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Playboard side (8 cols) */}
        <div id="game-playboard" className="lg:col-span-8 flex flex-col justify-between bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
          
          {/* Active Score card section */}
          <div id="game-scores" className="flex items-center justify-around pb-6 border-b border-slate-100 gap-4">
            
            {/* Me */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="relative">
                <img
                  src={me.avatarUrl}
                  alt={me.username}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-indigo-500 p-0.5 object-cover bg-indigo-50"
                />
                <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] font-black w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                  {mySymbol}
                </span>
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-700 block max-w-[120px] truncate">
                  {me.username} (Sen)
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  ELO {me.elo}
                </span>
              </div>
            </div>

            {/* Set Winner Status Counter */}
            <div className="flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-300 uppercase font-black tracking-widest block mb-1">
                Tur {currentRound} / {roundsLimit}
              </span>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-2">
                <span className="font-mono text-xl md:text-2xl font-black text-indigo-600">
                  {myScore}
                </span>
                <span className="text-slate-300 font-bold">-</span>
                <span className="font-mono text-xl md:text-2xl font-black text-slate-700">
                  {oppScore}
                </span>
              </div>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="relative">
                <img
                  src={opponent.avatarUrl}
                  alt={opponent.username}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-slate-300 p-0.5 object-cover bg-slate-50"
                />
                <span className="absolute -bottom-1 -right-1 bg-slate-500 text-white text-[10px] font-black w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                  {oppSymbol}
                </span>
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-700 block max-w-[120px] truncate">
                  {opponent.username}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  ELO {opponent.elo}
                </span>
              </div>
            </div>

          </div>

          {/* Core Gameboard */}
          <div id="game-board-container" className="flex-1 flex flex-col items-center justify-center py-8">
            {errorMessage && (
              <div id="game-error" className="bg-rose-50 text-rose-600 text-xs px-4 py-2 rounded-xl mb-4 border border-rose-100 flex items-center gap-1.5 animate-fadeIn">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* 3x3 Grid layout */}
            <div id="game-grid" className="grid grid-cols-3 gap-3 md:gap-4 w-full max-w-[320px] aspect-square relative">
              {[...Array(9)].map((_, idx) => {
                const value = gameBoard[idx];
                const highlight = winningLine?.includes(idx);

                return (
                  <button
                    key={idx}
                    id={`cell-${idx}`}
                    onClick={() => handleCellClick(idx)}
                    disabled={status !== 'playing' || value !== ''}
                    className={`aspect-square rounded-2xl md:rounded-3xl flex items-center justify-center font-sans font-black text-4xl md:text-5xl transition-all border outline-none cursor-pointer ${
                      value === '' && status === 'playing'
                        ? 'bg-slate-50 hover:bg-indigo-50/55 border-slate-100 hover:border-indigo-100'
                        : 'bg-white'
                    } ${
                      highlight
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700 scale-102 shadow-sm'
                        : value !== '' 
                          ? 'border-slate-100 text-slate-800' 
                          : 'border-slate-100'
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {value !== '' && (
                        <motion.span
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                          className={value === 'X' ? 'text-indigo-600' : 'text-slate-700'}
                        >
                          {value}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Turn-End Overlays (Turlar arası bekleme) */}
          {status === 'round_ended' && (
            <div id="round-end-overlay" className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fadeIn z-10">
              <h3 className="font-extrabold text-2xl text-slate-800 tracking-tight leading-none mb-2">
                {winningLine ? 'Tur Tamamlandı!' : 'Tur Berabere!'}
              </h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">
                {winningLine
                  ? `Bu turu kazanan: ${
                      getCurrentRoundWinnerName() === me.username ? 'Sensin! Tebrikler.' : getCurrentRoundWinnerName()
                    }`
                  : 'İki taraf da yenişemedi.'}
              </p>

              <button
                onClick={triggerNextRound}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                Sonraki Tura Başla
                <CornerDownLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Overall Match Finished Screen Overlay */}
          {status === 'finished' && (
            <div id="match-finish-overlay" className="absolute inset-0 bg-white/98 z-20 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
              {matchWinnerId === myUserId ? (
                <div className="space-y-4 max-w-md">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Trophy className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h2 className="text-3xl font-black text-emerald-600 tracking-tight leading-none">Zafer Senin!</h2>
                  <p className="text-slate-500 text-sm">Harika oynadın! Seriyi şampiyon olarak bitirdin.</p>
                </div>
              ) : matchWinnerId ? (
                <div className="space-y-4 max-w-md">
                  <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h2 className="text-3xl font-black text-rose-500 tracking-tight leading-none">Kaybettin</h2>
                  <p className="text-slate-500 text-sm">Şansını bir dahaki maça dene! Antrenman mükemmelleştirir.</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Zap className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-700 tracking-tight leading-none">Beraberlik</h2>
                  <p className="text-slate-500 text-sm">Serinin sonunda eşitlik bozulmadı! İki taraf da dengeli.</p>
                </div>
              )}

              {/* Rating changes */}
              {eloChangesLog.length > 0 && (
                <div id="elo-changes" className="bg-slate-50 border border-slate-100 rounded-2xl p-4 my-6 w-full max-w-sm space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">Eşleşme ELO Değişimleri</h4>
                  {eloChangesLog.map((log) => {
                    const isWinner = log.change >= 0;
                    return (
                      <div key={log.userId} className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{log.username}</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-slate-400">{log.oldElo} →</span>
                          <span className={`${isWinner ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}`}>
                            {log.newElo} ({isWinner ? '+' : ''}{log.change})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={onExitGame}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-7 py-3 rounded-2xl shadow-md select-none transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Ana Sayfaya Dön
              </button>
            </div>
          )}

        </div>

        {/* Private matches chat box (4 cols) */}
        <div id="game-chat" className="lg:col-span-4 h-[420px] lg:h-auto">
          <LobbyChat socket={socket} roomId={roomCode} currentUsername={me.username} />
        </div>

      </div>
    </section>
  );

  function getCurrentRoundWinnerName(): string {
    if (status === 'round_ended' && winningLine) {
      // Look for symbol in board on first of winningLine
      const sym = gameBoard[winningLine[0]];
      const winnerPlayer = sym === me.symbol ? me : opponent;
      return winnerPlayer.username;
    }
    return '';
  }
            }
