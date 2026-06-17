import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db, getDbStatus } from './src/server/db.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'xox-super-secret-key-9988';

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'assets')));
app.use(express.static(path.join(process.cwd(), 'public')));

// ─── Types ──────────────────────────────────────────────────────────────────
interface AuthRequest extends express.Request {
  user?: {
    userId: string;
    username: string;
    elo: number;
    avatarUrl: string;
  };
}

interface SocketUser {
  userId: string;
  username: string;
  elo: number;
  avatarUrl: string;
}

interface GamePlayer extends SocketUser {
  socketId: string;
  score: number;
  symbol: 'X' | 'O';
}

interface GameRoom {
  roomCode: string;
  players: GamePlayer[];
  roundsTotal: number;
  currentRound: number;
  gameBoard: string[];
  turnUserId: string;
  status: 'waiting' | 'playing' | 'round_ended' | 'finished';
  roundWinnerName: string | null;
  winnerUserId: string | null;
  winnerName: string | null;
  logs: string[];
  createdAt?: Date;
  isPrivate?: boolean;
}

interface QueueEntry {
  socketId: string;
  user: SocketUser;
  rounds: number;
  joinedAt: number;
}

// ─── JWT Auth Middleware ──────────────────────────────────────────────────
function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token bulunamadı. Lütfen giriş yapın.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
      return;
    }
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      elo: decoded.elo,
      avatarUrl: decoded.avatarUrl,
    };
    next();
  });
}

// ─── Express Routes ────────────────────────────────────────────────────────

// Health Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    database: getDbStatus(),
    time: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
  });
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, avatarUrl } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
      return;
    }

    if (username.length < 3 || username.length > 15) {
      res.status(400).json({ error: 'Kullanıcı adı 3-15 karakter arasında olmalıdır.' });
      return;
    }

    const trimmedUsername = username.trim();
    const existingUser = await db.getUserByUsername(trimmedUsername);
    if (existingUser) {
      res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.createUser(trimmedUsername, hashedPassword, avatarUrl);

    const token = jwt.sign(
      { userId: user._id, username: user.username, elo: user.elo, avatarUrl: user.avatarUrl },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Kayıt başarılı!',
      token,
      user: {
        userId: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        elo: user.elo,
        totalGames: user.totalGames,
        wins: user.wins,
        currentWinStreak: user.currentWinStreak,
        maxWinStreak: user.maxWinStreak,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
      return;
    }

    const user = await db.getUserByUsername(username);
    if (!user?.password) {
      res.status(400).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
      return;
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, elo: user.elo, avatarUrl: user.avatarUrl },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Giriş başarılı!',
      token,
      user: {
        userId: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        elo: user.elo,
        totalGames: user.totalGames,
        wins: user.wins,
        currentWinStreak: user.currentWinStreak,
        maxWinStreak: user.maxWinStreak,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Profile
app.get('/api/user/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await db.getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    res.json({
      userId: user._id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      elo: user.elo,
      totalGames: user.totalGames,
      wins: user.wins,
      currentWinStreak: user.currentWinStreak,
      maxWinStreak: user.maxWinStreak,
    });
  } catch (error) {
    res.status(500).json({ error: 'Profil getirme hatası.' });
  }
});

// Update Avatar
app.post('/api/user/avatar', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl?.startsWith('http') && !avatarUrl?.startsWith('/')) {
      res.status(400).json({ error: 'Geçerli bir görsel URL adresi girmelisiniz.' });
      return;
    }

    const updated = await db.updateUserAvatar(req.user!.userId, avatarUrl);
    if (!updated) {
      res.status(404).json({ error: 'Kullanıcı güncellenemedi.' });
      return;
    }

    const token = jwt.sign(
      { userId: updated._id, username: updated.username, elo: updated.elo, avatarUrl: updated.avatarUrl },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Profil resmi güncellendi.',
      token,
      user: {
        userId: updated._id,
        username: updated.username,
        avatarUrl: updated.avatarUrl,
        elo: updated.elo,
        totalGames: updated.totalGames,
        wins: updated.wins,
        currentWinStreak: updated.currentWinStreak,
        maxWinStreak: updated.maxWinStreak,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Resim güncelleme hatası.' });
  }
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const list = await db.getLeaderboard(500);
    res.json(list.map(u => ({
      userId: u._id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      elo: u.elo,
      wins: u.wins,
      totalGames: u.totalGames,
      maxWinStreak: u.maxWinStreak,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Liderlik tablosu getirilemedi.' });
  }
});

// Recent Games
app.get('/api/games/recent', async (req, res) => {
  try {
    const list = await db.getRecentGames(10);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Son oyunlar listelenemedi.' });
  }
});

// ─── Socket.IO ──────────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 3000,
  pingInterval: 1500,
});

const socketUsers = new Map<string, SocketUser>();
const activeRooms = new Map<string, GameRoom>();
let matchmakingQueue: QueueEntry[] = [];

// ─── Game Helpers ──────────────────────────────────────────────────────────

function getTurkeyTime() {
  return new Date().toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function checkTicTacToeWin(board: string[]) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winnerSymbol: board[a], line };
    }
  }

  if (board.every(cell => cell !== '')) {
    return { winnerSymbol: 'Draw', line: null };
  }

  return null;
}

// ─── Matchmaking Loop ──────────────────────────────────────────────────────

setInterval(() => {
  if (matchmakingQueue.length < 2) return;

  const matchedIndices = new Set<number>();
  const now = Date.now();

  const roundGroups: Record<number, number[]> = {};
  for (let i = 0; i < matchmakingQueue.length; i++) {
    const entry = matchmakingQueue[i];
    if (!roundGroups[entry.rounds]) roundGroups[entry.rounds] = [];
    roundGroups[entry.rounds].push(i);
  }

  for (const roundString in roundGroups) {
    const indices = roundGroups[roundString];
    if (indices.length < 2) continue;

    interface CandidatePair { idx1: number; idx2: number; eloDiff: number; }
    const candidates: CandidatePair[] = [];

    for (let x = 0; x < indices.length; x++) {
      for (let y = x + 1; y < indices.length; y++) {
        const i1 = indices[x], i2 = indices[y];
        const p1 = matchmakingQueue[i1], p2 = matchmakingQueue[i2];
        const eloDiff = Math.abs(p1.user.elo - p2.user.elo);

        const waitTimeS1 = (now - p1.joinedAt) / 1000;
        const waitTimeS2 = (now - p2.joinedAt) / 1000;
        const maxAllowedDiff = 200 + Math.floor(Math.max(waitTimeS1, waitTimeS2) * 12);

        if (eloDiff <= maxAllowedDiff) {
          candidates.push({ idx1: i1, idx2: i2, eloDiff });
        }
      }
    }

    candidates.sort((a, b) => a.eloDiff - b.eloDiff);

    for (const cand of candidates) {
      if (matchedIndices.has(cand.idx1) || matchedIndices.has(cand.idx2)) continue;

      matchedIndices.add(cand.idx1);
      matchedIndices.add(cand.idx2);

      const p1 = matchmakingQueue[cand.idx1];
      const p2 = matchmakingQueue[cand.idx2];
      const roomCode = 'MATCH_' + Math.random().toString(36).substr(2, 6).toUpperCase();

      const player1: GamePlayer = { ...p1.user, socketId: p1.socketId, score: 0, symbol: 'X' };
      const player2: GamePlayer = { ...p2.user, socketId: p2.socketId, score: 0, symbol: 'O' };

      const newRoom: GameRoom = {
        roomCode,
        players: [player1, player2],
        roundsTotal: p1.rounds,
        currentRound: 1,
        gameBoard: Array(9).fill(''),
        turnUserId: player1.userId,
        status: 'playing',
        roundWinnerName: null,
        winnerUserId: null,
        winnerName: null,
        logs: [`Sistem: Eşleşme bulundu! ${player1.username} vs ${player2.username}`],
        createdAt: new Date(),
        isPrivate: false,
      };

      activeRooms.set(roomCode, newRoom);

      const s1 = io.sockets.sockets.get(p1.socketId);
      const s2 = io.sockets.sockets.get(p2.socketId);
      if (s1) s1.join(roomCode);
      if (s2) s2.join(roomCode);

      io.to(roomCode).emit('match-joined', {
        roomCode,
        players: [player1, player2],
        roundsTotal: newRoom.roundsTotal,
        currentRound: newRoom.currentRound,
        gameBoard: newRoom.gameBoard,
        turnUserId: newRoom.turnUserId,
        status: newRoom.status,
      });

      db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
        `${player1.username} ve ${player2.username} eşleşti! ${newRoom.roundsTotal} Tur üzerinden oynayacaklar.`, roomCode);
    }
  }

  matchmakingQueue = matchmakingQueue.filter((_, idx) => !matchedIndices.has(idx));

  const timeouts: string[] = [];
  matchmakingQueue = matchmakingQueue.filter(entry => {
    if (Date.now() - entry.joinedAt >= 30000) {
      timeouts.push(entry.socketId);
      return false;
    }
    return true;
  });

  for (const socketId of timeouts) {
    const s = io.sockets.sockets.get(socketId);
    if (s) {
      s.emit('match-timeout', { message: 'Yeterince yakın ELO segmentinde uygun rakip bulunamadı.' });
    }
  }
}, 2000);

// ─── Socket Handlers ──────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  const authToken = socket.handshake.auth?.token;
  let sUser: SocketUser | null = null;

  if (authToken) {
    try {
      const decoded: any = jwt.verify(authToken, JWT_SECRET);
      sUser = {
        userId: decoded.userId,
        username: decoded.username,
        elo: decoded.elo,
        avatarUrl: decoded.avatarUrl,
      };
      socketUsers.set(socket.id, sUser);
    } catch (e) {}
  }

  socket.join('lobby');

  // Authenticate
  socket.on('authenticate', (token: string, callback: Function) => {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = {
        userId: decoded.userId,
        username: decoded.username,
        elo: decoded.elo,
        avatarUrl: decoded.avatarUrl,
      };
      socketUsers.set(socket.id, user);
      matchmakingQueue = matchmakingQueue.map(entry =>
        entry.socketId === socket.id ? { ...entry, user } : entry
      );
      callback({ success: true, user });
    } catch (e: any) {
      callback({ success: false, error: 'Oturum doğrulanamadı.' });
    }
  });

  // Lobby Status
  socket.on('get-lobby-status', (callback: Function) => {
    const userInRooms = Array.from(activeRooms.values()).flatMap(r => r.players).length;
    callback({
      onlineCount: io.engine.clientsCount,
      activeGames: activeRooms.size,
      searchingCount: matchmakingQueue.length,
      usersPlaying: userInRooms,
    });
  });

  // Matchmaking
  socket.on('search-match', (data: { rounds: number }, callback: Function) => {
    const user = socketUsers.get(socket.id);
    if (!user) {
      callback({ error: 'Önce giriş yapmalısınız.' });
      return;
    }

    matchmakingQueue = matchmakingQueue.filter(
      entry => entry.user.userId !== user.userId && entry.socketId !== socket.id
    );

    matchmakingQueue.push({
      socketId: socket.id,
      user,
      rounds: data.rounds || 3,
      joinedAt: Date.now(),
    });

    callback({ success: true });
    io.to('lobby').emit('lobby-count-update', { searchingCount: matchmakingQueue.length });
  });

  socket.on('cancel-matchmaking', (callback: Function) => {
    matchmakingQueue = matchmakingQueue.filter(entry => entry.socketId !== socket.id);
    callback({ success: true });
    io.to('lobby').emit('lobby-count-update', { searchingCount: matchmakingQueue.length });
  });

  // Custom Rooms
  socket.on('create-custom-room', (data: { rounds: number }, callback: Function) => {
    const user = socketUsers.get(socket.id);
    if (!user) {
      callback({ error: 'Giriş yapmanız gerekmektedir.' });
      return;
    }

    const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    const rounds = data.rounds || 3;

    const player: GamePlayer = {
      ...user,
      socketId: socket.id,
      score: 0,
      symbol: 'X',
    };

    const newRoom: GameRoom = {
      roomCode,
      players: [player],
      roundsTotal: rounds,
      currentRound: 1,
      gameBoard: Array(9).fill(''),
      turnUserId: user.userId,
      status: 'waiting',
      roundWinnerName: null,
      winnerUserId: null,
      winnerName: null,
      logs: [`Sistem: ${user.username} tarafından oda oluşturuldu.`],
      createdAt: new Date(),
      isPrivate: true,
    };

    activeRooms.set(roomCode, newRoom);
    socket.join(roomCode);

    callback({ success: true, roomCode, rounds });
    db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      `${user.username} yeni bir özel oda oluşturdu! Kod: ${roomCode}`, roomCode);
  });

  socket.on('join-custom-room', (data: { roomCode: string }, callback: Function) => {
    const user = socketUsers.get(socket.id);
    if (!user) {
      callback({ error: 'Giriş yapmanız gerekmektedir.' });
      return;
    }

    const targetCode = data.roomCode?.trim().toUpperCase();
    const room = activeRooms.get(targetCode);

    if (!room) {
      callback({ error: 'Oda bulunamadı veya süresi dolmuş.' });
      return;
    }

    if (room.status !== 'waiting' || room.players.length >= 2) {
      callback({ error: 'Oda dolu veya oyun başlamış.' });
      return;
    }

    if (room.players[0].userId === user.userId) {
      callback({ error: 'Kendi oluşturduğunuz odaya katılamazsınız.' });
      return;
    }

    const joiningPlayer: GamePlayer = {
      ...user,
      socketId: socket.id,
      score: 0,
      symbol: 'O',
    };

    room.players.push(joiningPlayer);
    room.status = 'playing';
    socket.join(targetCode);
    room.logs.push(`Sistem: ${user.username} odaya katıldı!`);

    callback({ success: true, roomCode: targetCode, rounds: room.roundsTotal });

    io.to(targetCode).emit('match-joined', {
      roomCode: targetCode,
      players: room.players,
      roundsTotal: room.roundsTotal,
      currentRound: room.currentRound,
      gameBoard: room.gameBoard,
      turnUserId: room.turnUserId,
      status: room.status,
    });

    db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      `${user.username} odaya katıldı!`, targetCode);
  });

  // Game Move
  socket.on('make-move', (data: { index: number; roomCode: string }, callback: Function) => {
    const user = socketUsers.get(socket.id);
    if (!user) {
      callback({ error: 'Oturum doğrulanamadı.' });
      return;
    }

    const room = activeRooms.get(data.roomCode);
    if (!room || room.status !== 'playing') {
      callback({ error: 'Oyun aktif değil.' });
      return;
    }

    if (room.turnUserId !== user.userId) {
      callback({ error: 'Sıra sizde değil.' });
      return;
    }

    const idx = data.index;
    if (idx < 0 || idx > 8 || room.gameBoard[idx] !== '') {
      callback({ error: 'Geçersiz hamle.' });
      return;
    }

    const player = room.players.find(p => p.userId === user.userId);
    if (!player) return;

    room.gameBoard[idx] = player.symbol;

    const otherPlayer = room.players.find(p => p.userId !== user.userId);
    room.turnUserId = otherPlayer ? otherPlayer.userId : user.userId;

    io.to(room.roomCode).emit('board-updated', {
      gameBoard: room.gameBoard,
      turnUserId: room.turnUserId,
    });

    const verdict = checkTicTacToeWin(room.gameBoard);
    if (verdict) {
      if (verdict.winnerSymbol === 'Draw') {
        room.status = 'round_ended';
        room.roundWinnerName = 'Beraberlik';
        room.logs.push(`Tur ${room.currentRound}: Berabere bitti.`);

        io.to(room.roomCode).emit('round-ended', {
          scoreWinnerId: null,
          winnerName: 'Beraberlik',
          winningLine: null,
          scores: room.players.reduce((acc, p) => ({ ...acc, [p.userId]: p.score }), {}),
          nextRound: room.currentRound + 1,
          gameFinished: false,
        });

        db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
          `Tur ${room.currentRound} Berabere Bitti!`, room.roomCode);
      } else {
        const winner = room.players.find(p => p.symbol === verdict.winnerSymbol);
        if (winner) {
          winner.score += 1;
          room.status = 'round_ended';
          room.roundWinnerName = winner.username;
          room.logs.push(`Tur ${room.currentRound}: ${winner.username} kazandı!`);

          const totalPlanned = room.roundsTotal;
          const pointsNeeded = Math.floor(totalPlanned / 2) + 1;
          let overallWinner: GamePlayer | null = null;

          const hasEarlyWinner = room.players.find(p => p.score >= pointsNeeded);
          if (hasEarlyWinner && totalPlanned > 1) {
            overallWinner = hasEarlyWinner;
          } else if (room.currentRound >= totalPlanned) {
            if (room.players[0].score > room.players[1].score) {
              overallWinner = room.players[0];
            } else if (room.players[1].score > room.players[0].score) {
              overallWinner = room.players[1];
            }
          }

          const isMatchFinished = !!overallWinner || (room.currentRound >= totalPlanned);

          if (isMatchFinished) {
            room.status = 'finished';
            if (overallWinner) {
              room.winnerUserId = overallWinner.userId;
              room.winnerName = overallWinner.username;
            } else {
              room.winnerUserId = null;
              room.winnerName = 'Beraberlik';
            }
            handleGameEnd(room);
          } else {
            io.to(room.roomCode).emit('round-ended', {
              scoreWinnerId: winner.userId,
              winnerName: winner.username,
              winningLine: verdict.line,
              scores: room.players.reduce((acc, p) => ({ ...acc, [p.userId]: p.score }), {}),
              nextRound: room.currentRound + 1,
              gameFinished: false,
            });

            db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
              `Tur ${room.currentRound} kazananı: ${winner.username}!`, room.roomCode);
          }
        }
      }
    }

    callback({ success: true });
  });

  // Next Round
  socket.on('request-next-round', (data: { roomCode: string }) => {
    const room = activeRooms.get(data.roomCode);
    if (!room || room.status !== 'round_ended') return;

    room.currentRound += 1;
    room.gameBoard = Array(9).fill('');
    room.status = 'playing';
    room.roundWinnerName = null;

    const startingPlayer = room.currentRound % 2 === 1
      ? room.players.find(p => p.symbol === 'X')
      : room.players.find(p => p.symbol === 'O');

    room.turnUserId = startingPlayer ? startingPlayer.userId : room.players[0].userId;

    io.to(room.roomCode).emit('next-round-started', {
      currentRound: room.currentRound,
      gameBoard: room.gameBoard,
      turnUserId: room.turnUserId,
      status: room.status,
    });
  });

  // Chat
  socket.on('send-message', async (data: { roomId: string; message: string }) => {
    const user = socketUsers.get(socket.id);
    const senderName = user ? user.username : 'Misafir';
    const senderAvatar = user ? user.avatarUrl : 'https://api.dicebear.com/7.x/bottts/svg?seed=guest';
    const cleanMsg = data.message?.trim();

    if (!cleanMsg) return;

    const savedChat = await db.saveChatMessage(senderName, senderAvatar, cleanMsg, data.roomId);

    io.to(data.roomId).emit('receive-message', {
      userId: user?.userId || 'guest',
      username: senderName,
      avatarUrl: senderAvatar,
      message: cleanMsg,
      createdAt: savedChat.createdAt,
      timeString: getTurkeyTime(),
    });
  });

  // Active Rooms
  socket.on('get-active-rooms', (callback: Function) => {
    const openRooms = [];
    for (const [code, room] of activeRooms.entries()) {
      if (room.status === 'waiting' || room.status === 'playing') {
        const host = room.players[0];
        openRooms.push({
          roomCode: code,
          hostUsername: host.username,
          hostElo: host.elo,
          hostAvatarUrl: host.avatarUrl,
          rounds: room.roundsTotal,
          isPrivate: room.isPrivate ?? true,
          createdAt: room.createdAt?.toISOString() || new Date().toISOString(),
          playerCount: room.players.length,
        });
      }
    }
    openRooms.sort((a, b) => a.playerCount - b.playerCount);
    callback(openRooms);
  });

  // Chat History
  socket.on('get-chat-history', async (data: { roomId: string }, callback: Function) => {
    try {
      const list = await db.getChatHistory(data.roomId, 50);
      const formatted = list.map(c => ({
        _id: c._id,
        username: c.username,
        avatarUrl: c.avatarUrl,
        message: c.message,
        createdAt: c.createdAt,
        timeString: new Date(c.createdAt).toLocaleTimeString('tr-TR', {
          timeZone: 'Europe/Istanbul',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));
      callback(formatted);
    } catch (e) {
      callback([]);
    }
  });

  // Leave Room
  socket.on('leave-room', (data: { roomCode: string }) => {
    socket.leave(data.roomCode);
    handlePlayerForfeit(socket, data.roomCode);
  });

  // Disconnect
  socket.on('disconnect', () => {
    matchmakingQueue = matchmakingQueue.filter(e => e.socketId !== socket.id);

    for (const [code, r] of activeRooms.entries()) {
      const activePlayer = r.players.find(p => p.socketId === socket.id);
      if (activePlayer) {
        handlePlayerForfeit(socket, code);
      }
    }

    socketUsers.delete(socket.id);
    io.to('lobby').emit('lobby-count-update', {
      searchingCount: matchmakingQueue.length,
      onlineCount: io.engine.clientsCount,
    });
  });
});

// ─── Game End Handlers ────────────────────────────────────────────────────

async function handlePlayerForfeit(socket: Socket, roomCode: string) {
  const room = activeRooms.get(roomCode);
  if (!room || room.status === 'finished') return;

  const leavingPlayer = room.players.find(p => p.socketId === socket.id);
  if (!leavingPlayer) return;

  const winnerPlayer = room.players.find(p => p.socketId !== socket.id);

  room.status = 'finished';
  room.winnerUserId = winnerPlayer ? winnerPlayer.userId : null;
  room.winnerName = winnerPlayer ? winnerPlayer.username : 'Beraberlik (Hükmen)';

  if (winnerPlayer) {
    winnerPlayer.score += 1;
    await handleGameEnd(room);
  } else {
    io.to(roomCode).emit('match-finished', {
      winnerUserId: null,
      winnerName: 'Hükmen Beraberlik',
      scores: {},
      eloChanges: [],
    });
    activeRooms.delete(roomCode);
  }
}

async function handleGameEnd(room: GameRoom) {
  try {
    const isDraw = !room.winnerUserId;
    const p1 = room.players[0];
    const p2 = room.players[1];

    const u1 = await db.getUserById(p1.userId);
    const u2 = await db.getUserById(p2.userId);

    const elo1 = u1?.elo || p1.elo;
    const elo2 = u2?.elo || p2.elo;
    const streak1 = u1?.currentWinStreak || 0;
    const streak2 = u2?.currentWinStreak || 0;

    let result1 = 0.5;
    let result2 = 0.5;

    if (!isDraw) {
      result1 = room.winnerUserId === p1.userId ? 1 : 0;
      result2 = room.winnerUserId === p2.userId ? 1 : 0;
    }

    let eloChange1 = 0;
    let eloChange2 = 0;

    if (isDraw) {
      eloChange1 = 0;
      eloChange2 = 0;
    } else {
      if (result1 === 1) {
        eloChange1 = Math.round(10 * (1 + streak1 * 0.15));
        eloChange2 = -10;
      } else {
        eloChange2 = Math.round(10 * (1 + streak2 * 0.15));
        eloChange1 = -10;
      }
    }

    const updatedU1 = await db.updateUserStats(p1.userId, eloChange1, result1 === 1, isDraw);
    const updatedU2 = await db.updateUserStats(p2.userId, eloChange2, result2 === 1, isDraw);

    const scoresObj: Record<string, number> = {};
    scoresObj[p1.username] = p1.score;
    scoresObj[p2.username] = p2.score;

    const eloChangesLog = [
      {
        userId: p1.userId,
        username: p1.username,
        change: eloChange1,
        oldElo: elo1,
        newElo: updatedU1?.elo || elo1 + eloChange1,
      },
      {
        userId: p2.userId,
        username: p2.username,
        change: eloChange2,
        oldElo: elo2,
        newElo: updatedU2?.elo || elo2 + eloChange2,
      },
    ];

    await db.saveGameRecord(
      [p1.userId, p2.userId],
      [p1.username, p2.username],
      room.roundsTotal,
      scoresObj,
      room.winnerUserId,
      room.winnerName || 'Beraberlik',
      eloChangesLog
    );

    io.to(room.roomCode).emit('match-finished', {
      winnerUserId: room.winnerUserId,
      winnerName: room.winnerName,
      scores: scoresObj,
      eloChanges: eloChangesLog,
    });

    db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      `Oyun sona erdi! Kazanan: ${room.winnerName || 'Beraberlik'}.`, room.roomCode);

    setTimeout(() => {
      activeRooms.delete(room.roomCode);
    }, 120000);
  } catch (error) {
    console.error('Game end error:', error);
    io.to(room.roomCode).emit('match-finished', {
      winnerUserId: room.winnerUserId,
      winnerName: room.winnerName,
      scores: {},
      eloChanges: [],
    });
  }
}

// ─── Server Start ──────────────────────────────────────────────────────────

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

start().catch((err) => {
  console.error('❌ Server start failed:', err);
});