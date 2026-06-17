import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Trophy, MessageSquare, LogOut, Zap, Sword, PlusCircle,
  LogIn, Dribbble, CheckCircle2, Hourglass, AlertCircle,
  DoorOpen, Sparkles, X, Users, Bot, WifiOff
} from 'lucide-react';
import { UserInfo, PlayerState, LobbyStats } from './types';
import Leaderboard from './components/Leaderboard';
import LobbyChat from './components/LobbyChat';
import UserProfile from './components/UserProfile';
import TicTacToeGame from './components/TicTacToeGame';
import ActiveRooms from './components/ActiveRooms';
import OfflineGame, { AIDifficulty } from './components/OfflineGame';

// ─── Toast System ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; type: ToastType; title: string; message?: string; }

let _toastId = 0;

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((t) => {
        const styles: Record<ToastType, string> = {
          success: 'bg-emerald-600 border-emerald-500',
          error: 'bg-rose-600 border-rose-500',
          info: 'bg-indigo-600 border-indigo-500',
          warning: 'bg-amber-500 border-amber-400',
        };
        const icons: Record<ToastType, React.ReactNode> = {
          success: <CheckCircle2 className="w-4 h-4" />,
          error: <AlertCircle className="w-4 h-4" />,
          info: <Sparkles className="w-4 h-4" />,
          warning: <AlertCircle className="w-4 h-4" />,
        };
        return (
          <div key={t.id} className={`toast-in pointer-events-auto flex items-start gap-3 text-white rounded-2xl border px-4 py-3 shadow-xl ${styles[t.type]}`}>
            <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{t.title}</p>
              {t.message && <p className="text-xs opacity-80 mt-0.5">{t.message}</p>}
            </div>
            <button onClick={() => onRemove(t.id)} className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Avatar presets ──────────────────────────────────────────────────────────
const PRESET_AVATARS = [
  { name: 'XOX Premium', url: '/xox_pro.png' },
  { name: 'Oscar', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Oscar' },
  { name: 'Charlie', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie' },
  { name: 'Buster', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Buster' },
  { name: 'Coco', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Coco' },
  { name: 'Sasha', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sasha' },
  { name: 'Gizmo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Gizmo' },
  { name: 'Milo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Milo' },
  { name: 'Bella', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bella' },
];

type PageView = 'lobby' | 'rooms' | 'leaderboard';

// ─── Offline Difficulty Modal ─────────────────────────────────────────────────
function OfflineDifficultyModal({ onSelect, onClose }: {
  onSelect: (difficulty: AIDifficulty, rounds: number) => void;
  onClose: () => void;
}) {
  const [selectedDiff, setSelectedDiff] = useState<AIDifficulty>('normal');
  const [selectedRounds, setSelectedRounds] = useState(3);

  const diffOptions: { key: AIDifficulty; label: string; desc: string; emoji: string; color: string }[] = [
    { key: 'easy',   label: 'Kolay',  desc: 'AI bazen hata yapar',      emoji: '😊', color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
    { key: 'normal', label: 'Normal', desc: 'Dengeli bir rakip',         emoji: '🤔', color: 'border-amber-400 bg-amber-50 text-amber-700' },
    { key: 'hard',   label: 'Zor',    desc: 'Mükemmel AI — yenilmez!',  emoji: '😈', color: 'border-rose-400 bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-7 max-w-sm w-full shadow-2xl space-y-6 animate-scaleUp">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <Bot className="w-6 h-6 text-indigo-600" />
          </div>
          <h2 className="font-black text-xl text-slate-900">AI ile Oyna</h2>
          <p className="text-slate-400 text-xs">İnternet olmadan yapay zekaya karşı oyna!</p>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Zorluk Seç</span>
          <div className="space-y-2">
            {diffOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSelectedDiff(opt.key)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                  selectedDiff === opt.key ? opt.color + ' border-current shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <div>
                  <div className="font-bold text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70">{opt.desc}</div>
                </div>
                {selectedDiff === opt.key && (
                  <CheckCircle2 className="w-5 h-5 ml-auto shrink-0 opacity-70" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Rounds */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Kaç Tur?</span>
          <div className="flex gap-2">
            {[1, 3, 5].map(n => (
              <button
                key={n}
                onClick={() => setSelectedRounds(n)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-extrabold transition-all cursor-pointer ${
                  selectedRounds === n
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {n} Tur
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition-all text-sm cursor-pointer">
            İptal
          </button>
          <button
            onClick={() => onSelect(selectedDiff, selectedRounds)}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 rounded-2xl shadow-lg shadow-indigo-200 transition-all text-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <Bot className="w-4 h-4" /> Başla!
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const [token, setToken] = useState<string | null>(localStorage.getItem('xox_jwt_token'));
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [avatarInput, setAvatarInput] = useState('');
  const [avatarSeedIndex, setAvatarSeedIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // ─── Navigation ──────────────────────────────────────────────────────────
  const [activePageView, setActivePageView] = useState<PageView>('lobby');

  // ─── Socket & Stats ──────────────────────────────────────────────────────
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lobbyStats, setLobbyStats] = useState<LobbyStats>({ onlineCount: 1, activeGames: 0, searchingCount: 0, usersPlaying: 0 });
  const [dbStatus, setDbStatus] = useState({ connected: false, mode: 'In-Memory Fallback', error: null, uriSet: false });

  // ─── Matchmaking ─────────────────────────────────────────────────────────
  const [searchRounds, setSearchRounds] = useState<number>(3);
  const [matchmakingActive, setMatchmakingActive] = useState(false);
  const [queueTimer, setQueueTimer] = useState(0);
  const queueIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Private Room ─────────────────────────────────────────────────────────
  const [customRounds, setCustomRounds] = useState<number>(3);
  const [privateRoomCode, setPrivateRoomCode] = useState('');
  const [codeToJoin, setCodeToJoin] = useState('');
  const [customRoomError, setCustomRoomError] = useState<string | null>(null);

  // ─── Active Game ──────────────────────────────────────────────────────────
  const [activeGame, setActiveGame] = useState<{
    roomCode: string; me: PlayerState; opponent: PlayerState;
    roundsLimit: number; gameBoard: string[]; turnUserId: string;
    status: 'playing' | 'round_ended' | 'finished';
  } | null>(null);

  const [leadRefresh, setLeadRefresh] = useState(0);

  // ─── Toasts ───────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ─── Offline Mode ─────────────────────────────────────────────────────────
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlineGame, setOfflineGame] = useState<{ difficulty: AIDifficulty; rounds: number } | null>(null);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (token) {
      fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(setUser)
        .catch(handleLogout);
    }
    fetch('/api/status').then((r) => r.json()).then((d) => { if (d.database) setDbStatus(d.database); }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !user) { socket?.disconnect(); setSocket(null); return; }

    const s = io({ auth: { token }, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

    s.on('connect', () => {
      s.emit('get-lobby-status', (stats: LobbyStats) => { if (stats) setLobbyStats(stats); });
    });

    s.on('lobby-count-update', (data: Partial<LobbyStats>) => setLobbyStats((p) => ({ ...p, ...data })));

    s.on('match-joined', (data: { roomCode: string; players: PlayerState[]; roundsTotal: number; currentRound: number; gameBoard: string[]; turnUserId: string; status: 'playing' | 'round_ended' | 'finished' }) => {
      cancelMatchmakingInterval();
      setMatchmakingActive(false);
      const myPlayer = data.players.find((p) => p.userId === user.userId);
      const enemyPlayer = data.players.find((p) => p.userId !== user.userId);
      if (myPlayer && enemyPlayer) {
        setActiveGame({ roomCode: data.roomCode, me: myPlayer, opponent: enemyPlayer, roundsLimit: data.roundsTotal, gameBoard: data.gameBoard, turnUserId: data.turnUserId, status: data.status });
        addToast('info', `Maç Başlıyor! ⚡`, `Rakibiniz: ${enemyPlayer.username} (${enemyPlayer.elo} ELO)`);
      }
    });

    s.on('match-timeout', (data: { message: string }) => {
      cancelMatchmakingInterval();
      setMatchmakingActive(false);
      addToast('warning', 'Rakip Bulunamadı', data.message);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [token, user?.userId]);

  useEffect(() => {
    if (matchmakingActive) {
      setQueueTimer(0);
      queueIntervalRef.current = setInterval(() => setQueueTimer((t) => t + 1), 1000);
    } else {
      cancelMatchmakingInterval();
    }
    return cancelMatchmakingInterval;
  }, [matchmakingActive]);

  const cancelMatchmakingInterval = () => {
    if (queueIntervalRef.current) { clearInterval(queueIntervalRef.current); queueIntervalRef.current = null; }
  };

  const handleLogout = () => {
    localStorage.removeItem('xox_jwt_token');
    setToken(null); setUser(null); setActiveGame(null);
    setMatchmakingActive(false); cancelMatchmakingInterval();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(null); setAuthSuccessMsg(null); setAuthLoading(true);
    const avatarToSave = avatarInput.trim() || PRESET_AVATARS[avatarSeedIndex]?.url || '/xox_icon.png';
    try {
      const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: usernameInput, password: passwordInput, avatarUrl: avatarToSave }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Kayıt başarısız.');
      setAuthSuccessMsg('Hesap oluşturuldu! Giriş yapılıyor...');
      setTimeout(() => { localStorage.setItem('xox_jwt_token', body.token); setToken(body.token); setUser(body.user); resetAuthForm(); }, 1200);
    } catch (err: any) { setAuthError(err.message || 'Bir hata oluştu.'); }
    finally { setAuthLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(null); setAuthSuccessMsg(null); setAuthLoading(true);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: usernameInput, password: passwordInput }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Hatalı kullanıcı adı veya şifre.');
      setAuthSuccessMsg('Giriş başarılı! Yönlendiriliyorsunuz...');
      setTimeout(() => { localStorage.setItem('xox_jwt_token', body.token); setToken(body.token); setUser(body.user); resetAuthForm(); }, 800);
    } catch (err: any) { setAuthError(err.message || 'Giriş yapılamadı.'); }
    finally { setAuthLoading(false); }
  };

  const resetAuthForm = () => { setUsernameInput(''); setPasswordInput(''); setAvatarInput(''); setAuthError(null); setAuthSuccessMsg(null); };

  const handleUpdateAvatar = async (newUrl: string) => {
    try {
      const r = await fetch('/api/user/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ avatarUrl: newUrl }) });
      const body = await r.json();
      if (!r.ok) return { success: false, error: body.error };
      localStorage.setItem('xox_jwt_token', body.token);
      setToken(body.token); setUser(body.user);
      setLeadRefresh((p) => p + 1);
      addToast('success', 'Avatar güncellendi!');
      return { success: true };
    } catch { return { success: false, error: 'Sunucuya bağlanılamadı.' }; }
  };

  const handleStartMatchmaking = () => {
    if (!socket) return;
    setCustomRoomError(null);
    socket.emit('search-match', { rounds: searchRounds }, (res: { error?: string }) => {
      if (res?.error) { addToast('error', 'Hata', res.error); return; }
      setMatchmakingActive(true);
      addToast('info', 'Rakip Aranıyor...', `${searchRounds} tur için sırada bekliyorsunuz`);
    });
  };

  const handleCancelMatchmaking = () => {
    if (!socket) return;
    socket.emit('cancel-matchmaking', () => { setMatchmakingActive(false); addToast('info', 'Arama İptal Edildi'); });
  };

  const handleCreateCustomRoom = () => {
    if (!socket) return;
    setCustomRoomError(null);
    socket.emit('create-custom-room', { rounds: customRounds }, (res: { success: boolean; roomCode: string; rounds: number; error?: string }) => {
      if (res.error) { setCustomRoomError(res.error); return; }
      setPrivateRoomCode(res.roomCode);
      addToast('success', 'Oda Oluşturuldu! 🎉', `Kod: ${res.roomCode} — Arkadaşına gönder!`);
    });
  };

  const handleJoinCustomRoom = (code?: string) => {
    const roomCode = code ?? codeToJoin;
    if (!socket || !roomCode) return;
    setCustomRoomError(null);
    socket.emit('join-custom-room', { roomCode }, (res: { success: boolean; roomCode: string; rounds: number; error?: string }) => {
      if (res.error) {
        if (code) addToast('error', 'Odaya Girilemiyor', res.error);
        else setCustomRoomError(res.error);
      }
    });
  };

  const handleExitActiveGame = () => {
    setActiveGame(null); setPrivateRoomCode(''); setCodeToJoin(''); setCustomRoomError(null);
    setLeadRefresh((p) => p + 1);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ─── RENDER: Offline Game ──────────────────────────────────────────────
  if (offlineGame) {
    return (
      <div className="min-h-screen bg-slate-50 antialiased font-sans">
        <header className="nav-glass sticky top-0 z-50 py-3.5">
          <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img src="/xox_icon.png" alt="XOX Arena" className="w-8 h-8 rounded-xl object-cover shadow border border-white/60" referrerPolicy="no-referrer" />
              <span className="font-black text-base text-slate-800 tracking-tight">XOX ARENA</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-full border border-slate-200 flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Offline Mod
              </span>
            </div>
          </div>
        </header>
        <main className="py-6">
          <OfflineGame
            difficulty={offlineGame.difficulty}
            rounds={offlineGame.rounds}
            onExit={() => setOfflineGame(null)}
          />
        </main>
      </div>
    );
  }

  // ─── RENDER: Active Game ────────────────────────────────────────────────
  if (user && activeGame) {
    return (
      <div className="min-h-screen bg-slate-50 antialiased font-sans">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <header className="nav-glass sticky top-0 z-50 py-3.5">
          <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img src="/xox_icon.png" alt="XOX Arena" className="w-8 h-8 rounded-xl object-cover shadow border border-white/60" referrerPolicy="no-referrer" />
              <span className="font-black text-base text-slate-800 tracking-tight">XOX ARENA</span>
            </div>
            <div className="flex items-center gap-2">
              <img src={user.avatarUrl} alt={user.username} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
              <span className="font-bold text-xs text-slate-700">{user.username}</span>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black font-mono px-2 py-1 rounded-full border border-indigo-100">⭐ {user.elo} ELO</span>
            </div>
          </div>
        </header>
        <main className="py-6">
          <TicTacToeGame socket={socket} roomCode={activeGame.roomCode} myUserId={user.userId} opponent={activeGame.opponent} me={activeGame.me} roundsLimit={activeGame.roundsLimit} initialGameBoard={activeGame.gameBoard} initialTurnUserId={activeGame.turnUserId} initialStatus={activeGame.status} onExitGame={handleExitActiveGame} />
        </main>
      </div>
    );
  }

  // ─── RENDER: Dashboard ─────────────────────────────────────────────────
  if (user) {
    return (
      <div className="min-h-screen bg-slate-50 antialiased font-sans flex flex-col">
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Offline Difficulty Modal */}
        {offlineModalOpen && (
          <OfflineDifficultyModal
            onSelect={(diff, rounds) => {
              setOfflineModalOpen(false);
              setOfflineGame({ difficulty: diff, rounds });
            }}
            onClose={() => setOfflineModalOpen(false)}
          />
        )}

        {/* Navbar */}
        <header className="nav-glass sticky top-0 z-50 py-3">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-2">
            {/* Logo */}
            <div className="hidden md:flex items-center gap-2.5 cursor-pointer" onClick={() => setActivePageView('lobby')}>
              <div className="relative">
                <img src="/xox_icon.png" alt="XOX Arena" className="w-9 h-9 rounded-xl object-cover shadow-md border border-white/60" referrerPolicy="no-referrer" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white nav-dot" />
              </div>
              <div>
                <span className="font-black text-sm text-slate-800 leading-none block tracking-tight">XOX ARENA</span>
                <span className="text-[9px] text-slate-400 font-bold block tracking-wider uppercase">Online Multiplayer</span>
              </div>
            </div>

            {/* Nav Pills */}
            <nav className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 gap-0.5">
              {([
                { key: 'lobby', label: 'Lobi', icon: <Zap className="w-3 h-3" /> },
                { key: 'rooms', label: 'Odalar', icon: <DoorOpen className="w-3 h-3" /> },
                { key: 'leaderboard', label: 'Sıralama', icon: <Trophy className="w-3 h-3" /> },
              ] as const).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setActivePageView(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
                    activePageView === key ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </nav>

            {/* User */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-2.5 py-1.5 shadow-sm">
                <img src={user.avatarUrl} alt={user.username} referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`; }}
                  className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0" />
                <div className="hidden sm:block text-left leading-none">
                  <span className="font-bold text-xs text-slate-700 block">{user.username}</span>
                  <span className="font-mono text-[9px] font-black text-indigo-500">⭐ {user.elo}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer" title="Çıkış Yap">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── LEADERBOARD PAGE ── */}
        {activePageView === 'leaderboard' && (
          <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1 animate-scaleUp">
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-3xl p-6 md:p-8 text-white mb-8 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2 relative z-10">
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-indigo-500/30">Liderlik Kürsüsü</span>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                  <Trophy className="w-7 h-7 text-amber-400" /> Şampiyonlar Ligi
                </h2>
                <p className="text-slate-300 text-xs font-medium">En yüksek ELO'ya sahip oyuncuların canlı sıralaması</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shrink-0 text-center relative z-10 min-w-40">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Sıralamandasın</span>
                <div className="font-mono text-xl font-black text-amber-400 mt-1">⭐ {user.elo} ELO</div>
                <span className="text-[10px] text-slate-300 font-bold">Seri: {user.currentWinStreak} Galibiyet</span>
              </div>
              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
            </div>
            <Leaderboard currentUserId={user.userId} refreshTrigger={leadRefresh} />
          </main>
        )}

        {/* ── ROOMS PAGE ── */}
        {activePageView === 'rooms' && (
          <main className="max-w-4xl w-full mx-auto px-4 py-8 flex-1 animate-scaleUp space-y-8">
            {/* Hero */}
            <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden border border-indigo-500/30 shadow-xl">
              <div className="relative z-10 space-y-2">
                <span className="bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/20">Canlı Odalar</span>
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <DoorOpen className="w-6 h-6" /> Açık Odalar
                </h2>
                <p className="text-indigo-100 text-xs font-medium">Şu an aktif tüm özel odalar — katıl, hemen oyna!</p>
              </div>
              {/* Live stat */}
              <div className="relative z-10 mt-4 flex items-center gap-4">
                <div className="bg-white/10 rounded-2xl px-4 py-2 flex items-center gap-2 border border-white/15">
                  <Users className="w-4 h-4 text-white/80" />
                  <span className="font-mono text-sm font-black">{lobbyStats.activeGames} aktif oda</span>
                </div>
                <div className="bg-white/10 rounded-2xl px-4 py-2 flex items-center gap-2 border border-white/15">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-sm font-black">{lobbyStats.onlineCount} çevrimiçi</span>
                </div>
              </div>
              {/* Decorative */}
              <div className="absolute right-6 top-4 text-8xl opacity-10 select-none font-black">✕</div>
              <div className="absolute right-20 bottom-2 text-5xl opacity-10 select-none font-black">○</div>
            </div>

            <ActiveRooms socket={socket} currentUserId={user.userId} onJoinRoom={(code) => handleJoinCustomRoom(code)} />

            {/* Create own room CTA */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm glow-card">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl"><PlusCircle className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-800">Kendi Odanı Aç</h3>
                  <p className="text-xs text-slate-400">Arkadaşını davet et ve özel maç oyna</p>
                </div>
              </div>
              {customRoomError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3 rounded-xl flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{customRoomError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Create */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div><h4 className="font-bold text-xs text-slate-700 uppercase tracking-tight">Oda Oluştur</h4></div>
                  <div className="flex gap-1.5">
                    {[1, 3, 5].map((n) => (
                      <button key={n} onClick={() => setCustomRounds(n)} className={`flex-1 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${customRounds === n ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{n} Tur</button>
                    ))}
                  </div>
                  {privateRoomCode ? (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400 block">Oda Kodun</span>
                      <span className="font-mono text-lg font-black text-indigo-700 tracking-widest block select-all mt-1">{privateRoomCode}</span>
                      <p className="text-[10px] text-indigo-400 mt-1">Kopyalayıp arkadaşına gönder!</p>
                    </div>
                  ) : (
                    <button onClick={handleCreateCustomRoom} className="btn-shine w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer">Oda Kodu Al</button>
                  )}
                </div>
                {/* Join */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div><h4 className="font-bold text-xs text-slate-700 uppercase tracking-tight">Koda Göre Katıl</h4></div>
                  <input type="text" value={codeToJoin} onChange={(e) => setCodeToJoin(e.target.value)} placeholder="Oda Kodu (ör: ABC12D)" className="w-full bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl uppercase font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors" />
                  <button onClick={() => handleJoinCustomRoom()} disabled={!codeToJoin.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer">Odaya Gir</button>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ── LOBBY PAGE ── */}
        {activePageView === 'lobby' && (
          <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-scaleUp">

            {/* Left column — actions */}
            <div className="lg:col-span-12 xl:col-span-7 space-y-6">

              {/* Stats Bar */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 text-white flex items-center justify-around border border-slate-700/60 shadow-md">
                {[
                  { label: 'Çevrimiçi', value: `${lobbyStats.onlineCount}`, color: 'text-emerald-400', suffix: 'oyuncu' },
                  { label: 'Savaşanlar', value: `${lobbyStats.usersPlaying}`, color: 'text-indigo-400', suffix: 'kişi' },
                  { label: 'Aktif Maç', value: `${lobbyStats.activeGames}`, color: 'text-violet-400', suffix: 'seri' },
                ].map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <div className="w-px h-8 bg-slate-700" />}
                    <div className="text-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{s.label}</span>
                      <span className={`font-mono text-base font-black ${s.color} stat-pulse`}>{s.value} <span className="text-xs">{s.suffix}</span></span>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Matchmaking Card */}
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm glow-card space-y-5 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl shadow-sm shadow-indigo-200">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800 tracking-tight">Eşleş ve Savaş</h3>
                    <p className="text-xs text-slate-400">ELO'na göre online rakip bul</p>
                  </div>
                </div>

                {matchmakingActive ? (
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-6 flex flex-col items-center text-center space-y-4 animate-scaleUp">
                    <div className="relative">
                      <span className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping" />
                      <div className="w-16 h-16 bg-white border border-indigo-100 rounded-full flex items-center justify-center shadow">
                        <Hourglass className="w-7 h-7 text-indigo-600 animate-spin" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Rakip Aranıyor...</h4>
                      <p className="text-slate-400 text-xs mt-1">ELO {user.elo} ±200 · {searchRounds} Tur</p>
                      <span className="font-mono text-2xl font-black text-indigo-600 block mt-2">{formatTimer(queueTimer)}</span>
                    </div>
                    <button onClick={handleCancelMatchmaking} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all cursor-pointer shadow-sm">Aramayı İptal Et</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Kaç tur oynayalım?</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setSearchRounds(n)}
                          className={`py-3 rounded-2xl border text-sm font-extrabold transition-all cursor-pointer ${searchRounds === n ? 'bg-gradient-to-b from-indigo-500 to-indigo-700 text-white border-indigo-600 shadow-sm shadow-indigo-200 scale-105' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleStartMatchmaking} className="btn-shine w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2">
                      <Sword className="w-4 h-4" /> Hemen Eşleş
                    </button>
                  </div>
                )}
              </div>

              {/* Offline AI Card */}
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm glow-card space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-slate-700 to-slate-900 text-white rounded-2xl shadow-sm">
                    <WifiOff className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800 tracking-tight">Offline Oyna</h3>
                    <p className="text-xs text-slate-400">İnternetsiz yapay zekaya karşı oyna · ELO kazanılmaz</p>
                  </div>
                </div>
                <button
                  onClick={() => setOfflineModalOpen(true)}
                  className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold py-3.5 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-4 h-4" /> AI ile Oyna
                </button>
              </div>

              {/* Private Room Card */}
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm glow-card space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-100 text-slate-700 rounded-2xl"><PlusCircle className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800 tracking-tight">Özel Oda</h3>
                    <p className="text-xs text-slate-400">Arkadaşınla oda kodu ile oyna · <button onClick={() => setActivePageView('rooms')} className="text-indigo-500 hover:underline cursor-pointer">Tüm odaları gör →</button></p>
                  </div>
                </div>
                {customRoomError && <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{customRoomError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-tight">Oda Oluştur</h4>
                    <div className="flex gap-1.5">
                      {[1, 3, 5].map((n) => (
                        <button key={n} onClick={() => setCustomRounds(n)} className={`flex-1 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${customRounds === n ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{n} Tur</button>
                      ))}
                    </div>
                    {privateRoomCode ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Giriş Kodu</span>
                        <span className="font-mono text-base font-black text-indigo-600 tracking-wider block select-all mt-1">{privateRoomCode}</span>
                      </div>
                    ) : (
                      <button onClick={handleCreateCustomRoom} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer">Kod Al</button>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <h4 className="font-bold text-xs text-slate-700 uppercase tracking-tight">Odaya Katıl</h4>
                    <input type="text" value={codeToJoin} onChange={(e) => setCodeToJoin(e.target.value)} placeholder="Oda Kodu (ABC12D)" className="w-full bg-white border border-slate-200 text-xs px-3 py-2.5 rounded-xl uppercase font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-colors" />
                    <button onClick={() => handleJoinCustomRoom()} disabled={!codeToJoin.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer">Odaya Gir</button>
                  </div>
                </div>
              </div>

              {/* Profile */}
              <UserProfile user={user} onUpdateAvatar={handleUpdateAvatar} dbInfo={dbStatus} />
            </div>

            {/* Right column — chat */}
            <div className="lg:col-span-12 xl:col-span-5 space-y-6 h-full">
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm glow-card flex flex-col h-[580px]">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-1">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Genel Sohbet</h3>
                    <p className="text-[10px] text-slate-400">Lobideki oyuncularla konuş</p>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LobbyChat socket={socket} roomId="lobby" currentUsername={user.username} />
                </div>
              </div>
            </div>
          </main>
        )}

        <footer className="bg-white border-t border-slate-100 py-5 mt-auto">
          <p className="text-center text-slate-400 text-xs font-mono">
            &copy; {new Date().getFullYear()} XOX Online · Tüm Hakları Saklıdır
          </p>
        </footer>
      </div>
    );
  }

  // ─── RENDER: Auth Page ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-mesh antialiased font-sans flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Floating orbs */}
      <div className="orb-a absolute top-[10%] left-[15%] w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="orb-b absolute bottom-[10%] right-[10%] w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="orb-c absolute top-[40%] right-[25%] w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Floating XO symbols */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {['✕', '○', '✕', '○', '✕', '○'].map((sym, i) => (
          <span key={i} className="absolute text-white/5 font-black"
            style={{ fontSize: `${[80, 120, 60, 100, 90, 70][i]}px`, top: `${[5, 60, 75, 20, 85, 45][i]}%`, left: `${[5, 75, 30, 85, 50, 10][i]}%`, transform: `rotate(${[-15, 20, -10, 15, -20, 10][i]}deg)` }}>
            {sym}
          </span>
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl p-7 shadow-2xl shadow-black/20 space-y-7 animate-scaleUp">
          {/* Logo area */}
          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-3xl blur-xl" />
              <img src="/xox_icon.png" alt="XOX Arena" className="relative w-16 h-16 rounded-2xl object-cover shadow-xl border border-white/80 mx-auto" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="font-black text-2xl text-slate-900 tracking-tight">XOX ARENA</h1>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase block mt-1">Online Multiplayer · ELO Sistemi</span>
            </div>
          </div>

          {/* Alerts */}
          {authError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" /><span className="font-medium">{authError}</span>
            </div>
          )}
          {authSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span className="font-medium">{authSuccessMsg}</span>
            </div>
          )}

          {/* Tab toggle */}
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {(['login', 'register'] as const).map((mode) => (
              <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(null); setAuthSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${authMode === mode ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Kullanıcı Adı</label>
              <input type="text" required minLength={3} maxLength={15} value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="Örn: xox_ustasi"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Şifre</label>
              <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 text-sm px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" />
            </div>

            {authMode === 'register' && (
              <div className="space-y-2.5 animate-fadeIn">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">Karakter Seç</label>
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                  {PRESET_AVATARS.map((av, idx) => (
                    <button key={av.name} type="button" onClick={() => { setAvatarSeedIndex(idx); setAvatarInput(''); }}
                      className={`p-1 rounded-xl border-2 shrink-0 transition-all cursor-pointer hover:scale-105 ${avatarSeedIndex === idx && !avatarInput ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-500/20' : 'border-slate-100 bg-slate-50'}`}
                      title={av.name}>
                      <img src={av.url} alt={av.name} className="w-10 h-10 rounded-lg object-cover bg-white" />
                    </button>
                  ))}
                </div>
                <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">— veya özel link —</div>
                <input type="text" value={avatarInput} onChange={(e) => setAvatarInput(e.target.value)} placeholder="https://... resim linki"
                  className="w-full bg-slate-50 border border-slate-200 text-xs px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors" />
              </div>
            )}

            <button type="submit" disabled={authLoading}
              className="btn-shine w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer">
              {authLoading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : authMode === 'login' ? (
                <><LogIn className="w-4 h-4" /> Giriş Yap</>
              ) : (
                <><Dribbble className="w-4 h-4" /> Kayıt Ol ve Katıl</>
              )}
            </button>
          </form>
        </div>

        {/* SEO blurb below card */}
        <p className="text-center text-white/30 text-[10px] mt-6 font-medium">
          Ücretsiz · Gerçek Zamanlı · ELO Sıralama · Rekabetçi XOX
        </p>
      </div>
    </div>
  );
}
