import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Trophy, 
  Flame, 
  MessageSquare, 
  LogOut, 
  User, 
  Shield, 
  Sparkles, 
  Zap, 
  Sword, 
  Compass, 
  RefreshCw, 
  PlusCircle, 
  LogIn, 
  Dribbble, 
  CheckCircle2, 
  Hourglass, 
  AlertCircle 
} from 'lucide-react';
import { UserInfo, PlayerState, LobbyStats } from './types';
import Leaderboard from './components/Leaderboard';
import LobbyChat from './components/LobbyChat';
import UserProfile from './components/UserProfile';
import TicTacToeGame from './components/TicTacToeGame';

// Preset avatars for beautiful registration
const PRESET_AVATARS = [
  { name: 'XOX Premium', url: '/xox_icon.png' },
  { name: 'Oscar', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Oscar' },
  { name: 'Charlie', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie' },
  { name: 'Buster', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Buster' },
  { name: 'Coco', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Coco' },
  { name: 'Sasha', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sasha' },
  { name: 'Gizmo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Gizmo' },
  { name: 'Milo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Milo' },
  { name: 'Bella', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bella' },
];

export default function App() {
  // Authentication states
  const [token, setToken] = useState<string | null>(localStorage.getItem('xox_jwt_token'));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Input fields
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [avatarSeedIndex, setAvatarSeedIndex] = useState(0); // For preset selection

  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Navigation Page selections
  const [activePageView, setActivePageView] = useState<'lobby' | 'leaderboard'>('lobby');

  // Real-time server variables
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lobbyStats, setLobbyStats] = useState<LobbyStats>({
    onlineCount: 1,
    activeGames: 0,
    searchingCount: 0,
    usersPlaying: 0,
  });
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    mode: 'In-Memory Fallback',
    error: null,
    uriSet: false,
  });

  // Matchmaking variables
  const [searchRounds, setSearchRounds] = useState<number>(3); // Default to 3 rounds
  const [matchmakingActive, setMatchmakingActive] = useState(false);
  const [queueTimer, setQueueTimer] = useState(0);
  const queueIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Private custom code fields
  const [customRounds, setCustomRounds] = useState<number>(3);
  const [privateRoomCode, setPrivateRoomCode] = useState('');
  const [codeToJoin, setCodeToJoin] = useState('');
  const [customRoomError, setCustomRoomError] = useState<string | null>(null);

  // Active gaming states
  const [activeGame, setActiveGame] = useState<{
    roomCode: string;
    me: PlayerState;
    opponent: PlayerState;
    roundsLimit: number;
    gameBoard: string[];
    turnUserId: string;
    status: 'playing' | 'round_ended' | 'finished';
  } | null>(null);

  const [leadRefresh, setLeadRefresh] = useState(0);

  // 1. Initial Profile/Validation triggers
  useEffect(() => {
    if (token) {
      // Fetch authenticated user profile
      fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Unauthorized');
          }
          return res.json();
        })
        .then((data) => {
          setUser(data);
        })
        .catch(() => {
          // Token expired, log user out silently
          handleLogout();
        });
    }

    // Connect database health indicators
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.database) {
          setDbStatus(data.database);
        }
      })
      .catch(() => {});
  }, [token]);

  // 2. Initialize Socket Connection once user logs in
  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Instantiate Single Socket
    const newSocket = io({
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('Socket successfully connected');
      // Fetch telemetry details
      newSocket.emit('get-lobby-status', (stats: LobbyStats) => {
        if (stats) setLobbyStats(stats);
      });
    });

    // Receive stats broadcast updates
    newSocket.on('lobby-count-update', (data: Partial<LobbyStats>) => {
      setLobbyStats((prev) => ({ ...prev, ...data }));
    });

    // Listening to matchmaking matches found
    newSocket.on('match-joined', (data: {
      roomCode: string;
      players: PlayerState[];
      roundsTotal: number;
      currentRound: number;
      gameBoard: string[];
      turnUserId: string;
      status: 'playing' | 'round_ended' | 'finished';
    }) => {
      // Cancel active matchmaking queues
      cancelMatchmakingInterval();
      setMatchmakingActive(false);

      // Determine who is me vs opponent
      const myPlayer = data.players.find((p) => p.userId === user.userId);
      const enemyPlayer = data.players.find((p) => p.userId !== user.userId);

      if (myPlayer && enemyPlayer) {
        setActiveGame({
          roomCode: data.roomCode,
          me: myPlayer,
          opponent: enemyPlayer,
          roundsLimit: data.roundsTotal,
          gameBoard: data.gameBoard,
          turnUserId: data.turnUserId,
          status: data.status,
        });
      }
    });

    // 30 Seconds Matchmaking timeout feedback
    newSocket.on('match-timeout', (data: { message: string }) => {
      cancelMatchmakingInterval();
      setMatchmakingActive(false);
      alert(data.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user?.userId]);

  // Matchmaking timer controls
  useEffect(() => {
    if (matchmakingActive) {
      setQueueTimer(0);
      queueIntervalRef.current = setInterval(() => {
        setQueueTimer((t) => t + 1);
      }, 1000);
    } else {
      cancelMatchmakingInterval();
    }
    return () => cancelMatchmakingInterval();
  }, [matchmakingActive]);

  const cancelMatchmakingInterval = () => {
    if (queueIntervalRef.current) {
      clearInterval(queueIntervalRef.current);
      queueIntervalRef.current = null;
    }
  };

  // Auth: Log out cleanup
  const handleLogout = () => {
    localStorage.removeItem('xox_jwt_token');
    setToken(null);
    setUser(null);
    setActiveGame(null);
    setMatchmakingActive(false);
    cancelMatchmakingInterval();
  };

  // Auth: Registration flow
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setAuthLoading(true);

    const presetUrl = PRESET_AVATARS[avatarSeedIndex]?.url || '/xox_icon.png';
    const avatarToSave = avatarInput.trim() || presetUrl;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
          avatarUrl: avatarToSave,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Kayıt işlemi başarısız.');
      }

      setAuthSuccessMsg('Hesap başarıyla oluşturuldu! Otomatik giriş yapılıyor...');
      setTimeout(() => {
        localStorage.setItem('xox_jwt_token', body.token);
        setToken(body.token);
        setUser(body.user);
        resetAuthForm();
      }, 1200);

    } catch (err: any) {
      setAuthError(err.message || 'Bir bağlantı hatası oluştu.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Auth: Login flow
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMsg(null);
    setAuthLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Hatalı kullanıcı adı veya şifre.');
      }

      setAuthSuccessMsg('Giriş başarılı! Yönlendiriliyorsunuz...');
      setTimeout(() => {
        localStorage.setItem('xox_jwt_token', body.token);
        setToken(body.token);
        setUser(body.user);
        resetAuthForm();
      }, 800);

    } catch (err: any) {
      setAuthError(err.message || 'Giriş yapılamadı.');
    } finally {
      setAuthLoading(false);
    }
  };

  const resetAuthForm = () => {
    setUsernameInput('');
    setPasswordInput('');
    setAvatarInput('');
    setAuthError(null);
    setAuthSuccessMsg(null);
  };

  // Profile: Change Avatar
  const handleUpdateAvatar = async (newUrl: string) => {
    try {
      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl: newUrl }),
      });

      const body = await response.json();
      if (!response.ok) {
        return { success: false, error: body.error };
      }

      // Re-sign User and Token local profiles
      localStorage.setItem('xox_jwt_token', body.token);
      setToken(body.token);
      setUser(body.user);
      setLeadRefresh((prev) => prev + 1);
      return { success: true };
    } catch {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' };
    }
  };

  // Matchmaking searching trigger
  const handleStartMatchmaking = () => {
    if (!socket) return;
    setCustomRoomError(null);

    socket.emit('search-match', { rounds: searchRounds }, (res: { error?: string; success?: boolean }) => {
      if (res && res.error) {
        alert(res.error);
        return;
      }
      setMatchmakingActive(true);
    });
  };

  const handleCancelMatchmaking = () => {
    if (!socket) return;
    socket.emit('cancel-matchmaking', () => {
      setMatchmakingActive(false);
    });
  };

  // Custom private room code creation
  const handleCreateCustomRoom = () => {
    if (!socket) return;
    setCustomRoomError(null);

    socket.emit('create-custom-room', { rounds: customRounds }, (res: {
      success: boolean;
      roomCode: string;
      rounds: number;
      error?: string;
    }) => {
      if (res.error) {
        setCustomRoomError(res.error);
        return;
      }
      setPrivateRoomCode(res.roomCode);
    });
  };

  // Join custom room code
  const handleJoinCustomRoom = () => {
    if (!socket || !codeToJoin) return;
    setCustomRoomError(null);

    socket.emit('join-custom-room', { roomCode: codeToJoin }, (res: {
      success: boolean;
      roomCode: string;
      rounds: number;
      error?: string;
    }) => {
      if (res.error) {
        setCustomRoomError(res.error);
        return;
      }
      // Successful join emits socket alerts directly which updates gameState via 'match-joined'
    });
  };

  // Exit from completed game View
  const handleExitActiveGame = () => {
    setActiveGame(null);
    setPrivateRoomCode('');
    setCodeToJoin('');
    setCustomRoomError(null);
    // Refresh ranking scores
    setLeadRefresh((prev) => prev + 1);
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  // RENDER: If Active Game is loaded, present the playboard!
  if (user && activeGame) {
    return (
      <div className="min-h-screen bg-slate-50 antialiased font-sans">
        {/* Header menu info */}
        <header className="bg-white border-b border-slate-100 py-4 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <img 
                src="/xox_icon.png" 
                alt="XOX Arena Logo" 
                className="w-8 h-8 rounded-lg object-cover shadow-sm border border-slate-200/50"
                referrerPolicy="no-referrer"
              />
              <span className="font-extrabold text-lg text-slate-800 tracking-tight">XOX ARENA</span>
            </div>
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl}
                alt={user.username}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full bg-slate-100 object-cover border border-slate-200"
              />
              <span className="font-bold text-xs text-slate-700">{user.username}</span>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black font-mono px-2 py-1 rounded-full border border-indigo-100">
                ⭐ {user.elo} ELO
              </span>
            </div>
          </div>
        </header>

        <main className="py-6">
          <TicTacToeGame
            socket={socket}
            roomCode={activeGame.roomCode}
            myUserId={user.userId}
            opponent={activeGame.opponent}
            me={activeGame.me}
            roundsLimit={activeGame.roundsLimit}
            initialGameBoard={activeGame.gameBoard}
            initialTurnUserId={activeGame.turnUserId}
            initialStatus={activeGame.status}
            onExitGame={handleExitActiveGame}
          />
        </main>
      </div>
    );
  }

  // RENDER: Dashboard/Matchmaking View once User Authenticated
  if (user) {
    return (
      <div className="min-h-screen bg-slate-50 antialiased font-sans flex flex-col justify-between">
        
         {/* Primary Navbar */}
        <header className="bg-white border-b border-slate-100 py-3.5 sticky top-0 z-50 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-2">
            <div className="hidden md:flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => setActivePageView('lobby')}>
              <img 
                src="/xox_icon.png" 
                alt="XOX Arena Logo" 
                className="w-9 h-9 rounded-xl object-cover shadow-md border border-slate-200/50"
                referrerPolicy="no-referrer"
              />
              <div>
                <span className="font-extrabold text-base text-slate-800 leading-none block tracking-tight">XOX Arena</span>
                <span className="text-[10px] text-slate-400 font-bold block">Online Multiplayer</span>
              </div>
            </div>

            {/* Middle Page Swapper */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40 shrink-0">
              <button
                onClick={() => setActivePageView('lobby')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activePageView === 'lobby'
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Lobi
              </button>
              <button
                onClick={() => setActivePageView('leaderboard')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePageView === 'leaderboard'
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                Sıralama
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl p-1 sm:px-2.5 sm:py-1.5 justify-center shrink-0 min-w-[36px] min-h-[36px]">
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
                  }}
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 min-w-[28px] min-h-[28px] aspect-square"
                />
                <div className="hidden sm:block text-left leading-none">
                  <span className="font-bold text-xs text-slate-700 block">{user.username}</span>
                  <span className="font-mono text-[9px] font-bold text-indigo-500">Rating {user.elo}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0"
                title="Çıkış Yap"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Grid Container */}
        {activePageView === 'leaderboard' ? (
          <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1 animate-scaleUp">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 rounded-2.5xl p-6 md:p-8 text-white mb-8 border border-slate-800 shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2 relative z-10">
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-500/30">
                  Liderlik Kürsüsü
                </span>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                  <Trophy className="w-8 h-8 text-amber-400 stroke-[2.5]" />
                  Şampiyonlar Ligi
                </h2>
                <p className="text-slate-300 text-xs font-medium">XOX Arena dünyasındaki en yüksek ELO derecesine sahip canlı sıralama tablosu</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0 text-center relative z-10 min-w-44">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Mevcut Durumun</span>
                <div className="font-mono text-xl font-black text-amber-400 mt-1">⭐ {user.elo} ELO</div>
                <span className="text-[10px] text-slate-300 font-bold">Seri: {user.currentWinStreak} Galibiyet</span>
              </div>
              {/* Abstract decorative background */}
              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl"></div>
            </div>

            <Leaderboard currentUserId={user.userId} refreshTrigger={leadRefresh} />
          </main>
        ) : (
          <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Main Action Hub column (7 cols) */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-8">
              
              {/* MATCHMAKING TRIGGER CARD */}
              <div className="bg-white rounded-3xl border border-slate-100/60 p-6 md:p-8 shadow-sm space-y-6 relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Zap className="w-5 h-5 fill-indigo-100" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-slate-800 tracking-tight">Eşleş ve Savaş</h3>
                    <p className="text-xs text-slate-400">Rating düzeyine göre online rakipler ara</p>
                  </div>
                </div>

                {matchmakingActive ? (
                  // MATCH SEARCHING ZONE
                  <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 animate-scaleUp">
                    <div className="relative">
                      <span className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping"></span>
                      <div className="w-16 h-16 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow-sm">
                        <Hourglass className="w-7 h-7 text-indigo-600 animate-spin" />
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Rakip Aranıyor...</h4>
                      <p className="text-slate-400 text-xs mt-1">
                        Kriter: ELO {user.elo} ±200 | Tur Sayısı: {searchRounds}
                      </p>
                      <span className="font-mono text-xl font-black text-indigo-600 block mt-2">
                        {formatTimer(queueTimer)}
                      </span>
                    </div>

                    <button
                      onClick={handleCancelMatchmaking}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      Aramayı İptal Et
                    </button>
                  </div>
                ) : (
                  // ROUND NUMBER CHOOSE SELECTOR
                  <div className="space-y-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Oyun Kaç Tur Olsun?</span>
                    
                    {/* Tur seçim butonları botla loop-ile render edilecek */}
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((item) => {
                        const isActive = searchRounds === item;
                        return (
                          <button
                            key={item}
                            id={`rounds-btn-${item}`}
                            onClick={() => setSearchRounds(item)}
                            className={`py-3.5 px-2 rounded-2xl border text-sm font-extrabold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/10 scale-102'
                                : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                            }`}
                          >
                            {item} Tur
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleStartMatchmaking}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-2.5xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      <Sword className="w-4.5 h-4.5" />
                      Hemen Eşleş
                    </button>
                  </div>
                )}
              </div>

              {/* CUSTOM PRIVATE CODE ROOM CARD */}
              <div className="bg-white rounded-3xl border border-slate-100/60 p-6 md:p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-slate-800 tracking-tight">Özel Oda</h3>
                    <p className="text-xs text-slate-400">Arkadaşınla oda kodu paylaşarak oyna</p>
                  </div>
                </div>

                {customRoomError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3.5 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {customRoomError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Create Section */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-slate-700 uppercase tracking-tight">Oda Oluştur</h4>
                      <p className="text-[11px] text-slate-400">Özel şifreli oyun başlatın</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {[1, 3, 5].map((item) => (
                        <button
                          key={item}
                          onClick={() => setCustomRounds(item)}
                          className={`flex-1 py-1 px-2 border rounded-lg text-xs font-bold ${
                            customRounds === item
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {item} Tur
                        </button>
                      ))}
                    </div>

                    {privateRoomCode ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 text-center space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Giriş Kodu</span>
                        <span className="font-mono text-base font-black text-indigo-600 tracking-wider block select-all">
                          {privateRoomCode}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleCreateCustomRoom}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        Kod Al
                      </button>
                    )}
                  </div>

                  {/* Join Section */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-slate-700 uppercase tracking-tight">Odaya Katıl</h4>
                      <p className="text-[11px] text-slate-400">Kodu yazıp arkadaşınıza bağlanın</p>
                    </div>

                    <input
                      type="text"
                      value={codeToJoin}
                      onChange={(e) => setCodeToJoin(e.target.value)}
                      placeholder="Oda Kodu (Örn: ABC12D)"
                      className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl uppercase font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors"
                    />

                    <button
                      onClick={handleJoinCustomRoom}
                      disabled={!codeToJoin.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      Odaya Gir
                    </button>
                  </div>

                </div>
              </div>

              {/* Profile Metrics and settings */}
              <UserProfile user={user} onUpdateAvatar={handleUpdateAvatar} dbInfo={dbStatus} />

            </div>


            {/* Information widgets columns (5 cols) */}
            <div className="lg:col-span-12 xl:col-span-5 space-y-8 h-full">
              
              {/* Realtime Telemetry Stats Row */}
              <div className="bg-slate-900 rounded-2.5xl p-5 text-white flex items-around justify-around border border-slate-800 shadow-sm gap-2">
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Çevrimiçi</span>
                  <span className="font-mono text-base font-black text-emerald-400">{lobbyStats.onlineCount} Oyuncu</span>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Savaşanlar</span>
                  <span className="font-mono text-base font-black text-indigo-400">{lobbyStats.usersPlaying} Kişi</span>
                </div>
                <div className="w-px h-8 bg-slate-800"></div>
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Aktif Maç</span>
                  <span className="font-mono text-base font-black text-indigo-400">{lobbyStats.activeGames} Seri</span>
                </div>
              </div>

              {/* Global Chat Area (Occupies full vertical space) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col h-[520px]">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Genel Sohbet Odası</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Lobi üzerindeki tüm gladyatörlerle konuşun</p>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LobbyChat socket={socket} roomId="lobby" currentUsername={user.username} />
                </div>
              </div>

            </div>

          </main>
        )}

        <footer className="bg-white border-t border-slate-100 py-6 mt-12">
          <p className="text-center text-slate-400 text-xs text-mono">
            &copy; {new Date().getFullYear()} XOX Online. Tüm Hakları Saklıdır.
          </p>
        </footer>

      </div>
    );
  }

  // RENDER: UN-AUTHENTICATED ACCESS VIEW (Register/Login screen)
  return (
    <div className="min-h-screen bg-slate-50 antialiased font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-md space-y-8 transition-transform">
        
        {/* Banner Logo */}
        <div className="text-center space-y-3">
          <img 
            src="/xox_icon.png" 
            alt="XOX Arena Logo" 
            className="w-16 h-16 rounded-2.5xl object-cover shadow-lg shadow-indigo-500/10 border border-slate-100 mx-auto"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="font-extrabold text-2xl text-slate-800 tracking-tight leading-none block">XOX ARENA</h1>
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase block mt-1.5">Multiplayer XOX</span>
          </div>
        </div>

        {/* Auth Error/Success banner loggers */}
        {authError && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span className="font-medium">{authError}</span>
          </div>
        )}
        {authSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
            <span className="font-medium">{authSuccessMsg}</span>
          </div>
        )}

        {/* Action form */}
        <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Kullanıcı Adı</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={15}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Örn: xox_ustasi"
              className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Şifre</label>
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Registration avatar picker */}
          {authMode === 'register' && (
            <div className="space-y-2.5 animate-fadeIn">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Profil Karakteri Seçin</label>
              
              {/* Horizontal slider presets */}
              <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
                {PRESET_AVATARS.map((avatar, idx) => {
                  const isSelected = avatarSeedIndex === idx && !avatarInput;
                  return (
                    <button
                      key={avatar.name}
                      type="button"
                      onClick={() => {
                        setAvatarSeedIndex(idx);
                        setAvatarInput('');
                      }}
                      className={`p-1.5 rounded-xl border-2 shrink-0 transition-transform hover:scale-105 cursor-pointer bg-slate-50 ${
                        isSelected ? 'border-indigo-600 scale-105 shadow-sm ring-2 ring-indigo-500/10' : 'border-slate-100'
                      }`}
                      title={avatar.name}
                    >
                      <img 
                        src={avatar.url} 
                        alt={avatar.name} 
                        className={`w-9 h-9 rounded-xl object-cover bg-white border border-slate-200/50 ${idx === 0 ? 'ring-2 ring-indigo-500/20' : ''}`} 
                      />
                    </button>
                  );
                })}
              </div>

              {/* URL Custom Input */}
              <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-1">– veya –</div>
              
              <div className="space-y-1">
                <input
                  type="text"
                  value={avatarInput}
                  onChange={(e) => setAvatarInput(e.target.value)}
                  placeholder="Seçenekleri geç, özel resim linki yapıştır http..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer pt-3"
          >
            {authLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : authMode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                Giriş Yap
              </>
            ) : (
                <>
                  <Dribbble className="w-4 h-4" />
                  Kayıt Ol ve Katıl
                </>
            )}
          </button>
        </form>

        {/* Tab sliders toggles */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError(null);
              setAuthSuccessMsg(null);
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
          >
            {authMode === 'login' ? 'Yeni hesap oluşturmak için Kaydolun' : 'Zaten hesabınız var mı? Giriş yapın'}
          </button>
        </div>

      </div>
    </div>
  );
}
