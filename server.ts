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

app.use(express.json());

// Serve public folder (sw.js, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'xox-super-secret-key-9988';

// ----------------------------------------------------
// JWT Authentication Middleware
// ----------------------------------------------------
interface AuthRequest extends express.Request {
  user?: {
    userId: string;
    username: string;
    elo: number;
    avatarUrl: string;
  };
}

function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

// ----------------------------------------------------
// Express REST API Routes
// ----------------------------------------------------

// PWA Manifest & App Icon
app.get('/manifest.json', (req, res) => {
  res.json({
    name: "XOX Arena - Online Multiplayer",
    short_name: "XOX Arena",
    description: "Gerçek zamanlı çevrimiçi XOX oyunu. ELO puanlama, lobi sohbeti ve özel oda desteği.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#0f172a",
    theme_color: "#4f46e5",
    orientation: "portrait-primary",
    lang: "tr",
    categories: ["games", "entertainment"],
    screenshots: [],
    icons: [
      {
        src: "/xox_icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/xox_icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/xox_icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Hızlı Eşleşme",
        short_name: "Eşleş",
        description: "Hemen rakip bul ve oyna",
        url: "/?action=matchmaking",
        icons: [{ src: "/xox_icon.png", sizes: "96x96" }]
      },
      {
        name: "Liderlik Tablosu",
        short_name: "Sıralama",
        description: "En iyi oyuncuları gör",
        url: "/?page=leaderboard",
        icons: [{ src: "/xox_icon.png", sizes: "96x96" }]
      }
    ]
  });
});

app.get('/xox_pro.png', (req, res) => {
  // Try new PNG first, fall back to old JPG
  const pngPath = path.join(process.cwd(), 'assets/images/xox_pro.png');
  const jpgPath = path.join(process.cwd(), 'assets/images/xox_icon_clean_round_1781433620627.jpg');
  const fs = require('fs');
  if (fs.existsSync(pngPath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(pngPath);
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(jpgPath);
  }
});

// System Status Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    database: getDbStatus(),
    time: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
  });
});

// Authentication: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, avatarUrl } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
      return;
    }

    if (username.length < 3 || username.length > 15) {
      res.status(400).json({ error: 'Kullanıcı adı 3 ile 15 karakter arasında olmalıdır.' });
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

    // Create JWT
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
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// Authentication: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
      return;
    }

    const user = await db.getUserByUsername(username);
    if (!user || !user.password) {
      res.status(400).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
      return;
    }

    // Create JWT
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
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// User Profile (Authenticated)
app.get('/api/user/profile', authenticateToken as any, async (req: AuthRequest, res) => {
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
  } catch (error: any) {
    res.status(500).json({ error: 'Profil getirme hatası.' });
  }
});

// Update Avatar
app.post('/api/user/avatar', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl || !avatarUrl.startsWith('http')) {
      res.status(400).json({ error: 'Geçerli bir görsel URL adresi girmelisiniz.' });
      return;
    }

    const updated = await db.updateUserAvatar(req.user!.userId, avatarUrl);
    if (!updated) {
      res.status(404).json({ error: 'Kullanıcı güncellenemedi.' });
      return;
    }

    // Return new user information and a fresh token
    const token = jwt.sign(
      { userId: updated._id, username: updated.username, elo: updated.elo, avatarUrl: updated.avatarUrl },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Profil resmi başarıyla güncellendi.',
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
  } catch (error: any) {
    res.status(500).json({ error: 'Resim güncelleme hatası.' });
  }
});

// Leaderboard Access
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
  } catch (error: any) {
    res.status(500).json({ error: 'Liderlik tablosu getirilemedi.' });
  }
});

// Recent Games Logs
app.get('/api/games/recent', async (req, res) => {
  try {
    const list = await db.getRecentGames(10);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Son oyunlar listelenemedi.' });
  }
});


// ----------------------------------------------------
// Socket.IO Real-Time Messaging & Game Engine
// ----------------------------------------------------

// Setup IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 3000,
  pingInterval: 1500,
});

interface SocketUser {
  userId: string;
  username: string;
  elo: number;
  avatarUrl: string;
}

// Map socket.id -> Authenticated User
const socketUsers: Map<string, SocketUser> = new Map();

// Matchmaking Queue (Elo + Round Count based)
interface QueueEntry {
  socketId: string;
  user: SocketUser;
  rounds: number;
  joinedAt: number;
}
let matchmakingQueue: QueueEntry[] = [];

// Room representation in memory
interface GamePlayer extends SocketUser {
  socketId: string;
  score: number; // set level scores
  symbol: 'X' | 'O';
}

interface GameRoom {
  roomCode: string;
  players: GamePlayer[];
  roundsTotal: number;
  currentRound: number;
  gameBoard: string[]; // Length 9, '' | 'X' | 'O'
  turnUserId: string;
  status: 'waiting' | 'playing' | 'round_ended' | 'finished';
  roundWinnerName: string | null; // username or 'Draw' or null
  winnerUserId: string | null;
  winnerName: string | null;
  logs: string[];
}

const activeRooms: Map<string, GameRoom> = new Map();

// Helper to get formatted Turkish Time
function getTurkeyTime() {
  return new Date().toLocaleTimeString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Standard Chess-style Elo formula
function calculateEloChange(myElo: number, oppElo: number, score: number) {
  const K = 32;
  const expectedScore = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
  return Math.round(K * (score - expectedScore));
}

// Dynamic game win checks (XOX rules)
function checkTicTacToeWin(board: string[]) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6],             // Diagonals
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winnerSymbol: board[a], line };
    }
  }

  const isDraw = board.every(cell => cell !== '');
  if (isDraw) {
    return { winnerSymbol: 'Draw', line: null };
  }

  return null;
}

// Matchmaking loop - runs periodically
setInterval(() => {
  if (matchmakingQueue.length < 2) return;

  const matchedIndices = new Set<number>();
  const now = Date.now();

  // Group matchmaking queue by requested rounds
  const roundGroups: { [key: number]: number[] } = {};
  for (let i = 0; i < matchmakingQueue.length; i++) {
    const entry = matchmakingQueue[i];
    if (!roundGroups[entry.rounds]) {
      roundGroups[entry.rounds] = [];
    }
    roundGroups[entry.rounds].push(i);
  }

  // Find the closest Elo matches within each rounds group dynamically
  for (const roundString in roundGroups) {
    const indices = roundGroups[roundString];
    if (indices.length < 2) continue;

    interface CandidatePair {
      idx1: number;
      idx2: number;
      eloDiff: number;
    }

    const candidates: CandidatePair[] = [];

    // Collect all prospective pairs in this round count group
    for (let x = 0; x < indices.length; x++) {
      for (let y = x + 1; y < indices.length; y++) {
        const i1 = indices[x];
        const i2 = indices[y];
        const p1 = matchmakingQueue[i1];
        const p2 = matchmakingQueue[i2];

        const eloDiff = Math.abs(p1.user.elo - p2.user.elo);

        // Dynamic tolerance increases by 12 points per second of queue wait to avoid deadlocks
        const waitTimeS1 = (now - p1.joinedAt) / 1000;
        const waitTimeS2 = (now - p2.joinedAt) / 1000;
        const maxWaitTimeS = Math.max(waitTimeS1, waitTimeS2);
        const maxAllowedDiff = 200 + Math.floor(maxWaitTimeS * 12);

        if (eloDiff <= maxAllowedDiff) {
          candidates.push({
            idx1: i1,
            idx2: i2,
            eloDiff
          });
        }
      }
    }

    // Sort pairings by smallest Elo difference first (best match!)
    candidates.sort((a, b) => a.eloDiff - b.eloDiff);

    // Apply matchings greedily
    for (const cand of candidates) {
      if (matchedIndices.has(cand.idx1) || matchedIndices.has(cand.idx2)) {
        continue;
      }

      matchedIndices.add(cand.idx1);
      matchedIndices.add(cand.idx2);

      const p1 = matchmakingQueue[cand.idx1];
      const p2 = matchmakingQueue[cand.idx2];

      // Create private room code
      const roomCode = 'MATCH_' + Math.random().toString(36).substr(2, 6).toUpperCase();

      // Initialize Match Room
      const player1: GamePlayer = { ...p1.user, socketId: p1.socketId, score: 0, symbol: 'X' };
      const player2: GamePlayer = { ...p2.user, socketId: p2.socketId, score: 0, symbol: 'O' };

      const newRoom: GameRoom = {
        roomCode,
        players: [player1, player2],
        roundsTotal: p1.rounds,
        currentRound: 1,
        gameBoard: Array(9).fill(''),
        turnUserId: player1.userId, // 'X' starts first
        status: 'playing',
        roundWinnerName: null,
        winnerUserId: null,
        winnerName: null,
        logs: [`Sistem: Eşleşme bulundu! ${player1.username} vs ${player2.username}`],
      };

      activeRooms.set(roomCode, newRoom);

      // Instruct sockets to join
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

      // Save system chat logs
      db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system', `${player1.username} ve ${player2.username} eşleşti! ${newRoom.roundsTotal} Tur üzerinden oynayacaklar.`, roomCode);
    }
  }

  // Remove matched elements from queue
  matchmakingQueue = matchmakingQueue.filter((_, idx) => !matchedIndices.has(idx));

  // Check 30 seconds timeouts for unmatched items
  const timeouts: string[] = [];
  matchmakingQueue = matchmakingQueue.filter(entry => {
    const duration = now - entry.joinedAt;
    if (duration >= 30000) {
      timeouts.push(entry.socketId);
      return false; // drop from queue
    }
    return true; // keep
  });

  // Notify timeout players
  for (const socketId of timeouts) {
    const s = io.sockets.sockets.get(socketId);
    if (s) {
      s.emit('match-timeout', { message: 'Yeterince yakın ELO segmentinde uygun rakip bulunamadı. Lütfen tekrar deneyin.' });
    }
  }
}, 2000);


io.on('connection', (socket: Socket) => {
  // Simple check query / auth params
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
    } catch (e) {
      // Allow connection, will authenticate over messaging/lobby
    }
  }

  // Lobby general join
  socket.join('lobby');

  // Authenticate socket manually
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
      
      // Update matchmaking if in queue
      matchmakingQueue = matchmakingQueue.map(entry => {
        if (entry.socketId === socket.id) {
          return { ...entry, user };
        }
        return entry;
      });

      callback({ success: true, user });
    } catch (e: any) {
      callback({ success: false, error: 'Oturum doğrulanamadı.' });
    }
  });

  // Fetch current general statistics of database (connected user, active match count)
  socket.on('get-lobby-status', (callback: Function) => {
    const userInRoomsCount = Array.from(activeRooms.values()).flatMap(r => r.players).length;
    callback({
      onlineCount: io.engine.clientsCount,
      activeGames: activeRooms.size,
      searchingCount: matchmakingQueue.length,
      usersPlaying: userInRoomsCount
    });
  });

  // Matchmaking process initiation
  socket.on('search-match', (data: { rounds: number }, callback: Function) => {
    const user = socketUsers.get(socket.id);
    if (!user) {
      callback({ error: 'Önce giriş yapmalısınız.' });
      return;
    }

    // Prevent duplicate entries
    matchmakingQueue = matchmakingQueue.filter(entry => entry.user.userId !== user.userId && entry.socketId !== socket.id);

    matchmakingQueue.push({
      socketId: socket.id,
      user,
      rounds: data.rounds || 3,
      joinedAt: Date.now(),
    });

    // Notify user search initiated successfully
    callback({ success: true });

    // Broadcast updated lobby status
    io.to('lobby').emit('lobby-count-update', {
      searchingCount: matchmakingQueue.length
    });
  });

  // Cancel matchmaking search
  socket.on('cancel-matchmaking', (callback: Function) => {
    matchmakingQueue = matchmakingQueue.filter(entry => entry.socketId !== socket.id);
    callback({ success: true });
    
    io.to('lobby').emit('lobby-count-update', {
      searchingCount: matchmakingQueue.length
    });
  });

  // Custom private room code creation
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
      symbol: 'X', // creator gets X
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
      logs: [`Sistem: ${user.username} tarafından oda oluşturuldu. Kod: ${roomCode}`],
    };

    activeRooms.set(roomCode, newRoom);
    socket.join(roomCode);

    callback({ success: true, roomCode, rounds });

    // Log chat message
    db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system', `${user.username} yeni bir özel oda oluşturdu! Kod: ${roomCode}`, roomCode);
  });

  // Joining custom room code
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
      callback({ error: 'Oda dolu veya oyun zaten başlamış.' });
      return;
    }

    // Verify creator is not joining their own room under a duplicate connection
    if (room.players[0].userId === user.userId) {
      callback({ error: 'Kendi oluşturduğunuz odaya katılamazsınız.' });
      return;
    }

    const joiningPlayer: GamePlayer = {
      ...user,
      socketId: socket.id,
      score: 0,
      symbol: 'O', // second joining receives O
    };

    room.players.push(joiningPlayer);
    room.status = 'playing';
    socket.join(targetCode);

    // Initial log message
    room.logs.push(`Sistem: ${user.username} odaya katıldı! Oyun başlıyor.`);

    callback({ success: true, roomCode: targetCode, rounds: room.roundsTotal });

    // Notify room both players joined
    io.to(targetCode).emit('match-joined', {
      roomCode: targetCode,
      players: room.players,
      roundsTotal: room.roundsTotal,
      currentRound: room.currentRound,
      gameBoard: room.gameBoard,
      turnUserId: room.turnUserId,
      status: room.status,
    });

    db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system', `${user.username} odaya katıldı! XOX Meydan Okuması Başlıyor.`, targetCode);
  });

  // Gameplay move handle
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
      callback({ error: 'Geçersiz hamle alanı.' });
      return;
    }

    // Fetch symbol of player making the move
    const player = room.players.find(p => p.userId === user.userId);
    if (!player) return;

    room.gameBoard[idx] = player.symbol;

    // Switch turn
    const otherPlayer = room.players.find(p => p.userId !== user.userId);
    room.turnUserId = otherPlayer ? otherPlayer.userId : user.userId;

    // Send update about board shift
    io.to(room.roomCode).emit('board-updated', {
      gameBoard: room.gameBoard,
      turnUserId: room.turnUserId,
    });

    // Check round win / draw logic
    const verdict = checkTicTacToeWin(room.gameBoard);
    if (verdict) {
      if (verdict.winnerSymbol === 'Draw') {
        // Round Draw
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

        db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system', `Tur ${room.currentRound} Berabere Bitti!`, room.roomCode);
      } else {
        // Round Winner identified
        const winner = room.players.find(p => p.symbol === verdict.winnerSymbol);
        if (winner) {
          winner.score += 1;
          room.status = 'round_ended';
          room.roundWinnerName = winner.username;
          room.logs.push(`Tur ${room.currentRound}: ${winner.username} kazandı!`);

          // Look for overall match winner
          // A player wins early if they secure majority sets, or if currentRound reaches roundsTotal, who has more points
          const totalPlanned = room.roundsTotal;
          const pointsNeededEarly = Math.floor(totalPlanned / 2) + 1;
          
          let overallWinner: GamePlayer | null = null;
          
          // Check early winner
          const hasEarlyWinner = room.players.find(p => p.score >= pointsNeededEarly);
          
          if (hasEarlyWinner && totalPlanned > 1) {
            overallWinner = hasEarlyWinner;
          } else if (room.currentRound >= totalPlanned) {
            // Reached last round. Check who has more points overall
            if (room.players[0].score > room.players[1].score) {
              overallWinner = room.players[0];
            } else if (room.players[1].score > room.players[0].score) {
              overallWinner = room.players[1];
            } else {
              // Complete Draw at end rounds count
              overallWinner = null; // Still draw
            }
          }

          const isMatchFinished = !!overallWinner || (room.currentRound >= totalPlanned);

          if (isMatchFinished) {
            // MATCH COMPLETED!
            room.status = 'finished';
            
            if (overallWinner) {
              room.winnerUserId = overallWinner.userId;
              room.winnerName = overallWinner.username;
            } else {
              room.winnerUserId = null;
              room.winnerName = 'Beraberlik';
            }

            // Perform rating calculations
            handleGameEndEloAndStats(room);
          } else {
            // Normal set complete, proceed to next round trigger
            io.to(room.roomCode).emit('round-ended', {
              scoreWinnerId: winner.userId,
              winnerName: winner.username,
              winningLine: verdict.line,
              scores: room.players.reduce((acc, p) => ({ ...acc, [p.userId]: p.score }), {}),
              nextRound: room.currentRound + 1,
              gameFinished: false,
            });

            db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system', `Tur ${room.currentRound} kazananı: ${winner.username}! Seri skoru: ${room.players[0].username} [${room.players[0].score}] - [${room.players[1].score}] ${room.players[1].username}`, room.roomCode);
          }
        }
      }
    }

    callback({ success: true });
  });

  // Request next-round trigger (only after round-ended triggers)
  socket.on('request-next-round', (data: { roomCode: string }) => {
    const room = activeRooms.get(data.roomCode);
    if (!room || room.status !== 'round_ended') return;

    room.currentRound += 1;
    room.gameBoard = Array(9).fill('');
    room.status = 'playing';
    room.roundWinnerName = null;

    // Switch starting symbol turn! Next round the matching starting symbol flips or other player starts
    // Let's make whoever did not begin the previous round begin this one.
    // If player1 started turn 1, let player2 start round 2
    // Let's decide who started round (currentRound - 1)
    // Simply: let the player who has O start the even rounds, X start the odd rounds
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

    db.saveChatMessage('Sistem', 'https://api.dicebear.com/7.x/bottts/svg?seed=system', `Tur ${room.currentRound} Başladı! Sıra: ${startingPlayer?.username || 'Hamle Sahibi'}`, room.roomCode);
  });

  // Lobby/Room chat messaging setup
  socket.on('send-message', async (data: { roomId: string; message: string }) => {
    const user = socketUsers.get(socket.id);
    const senderName = user ? user.username : 'Misafir';
    const senderAvatar = user ? user.avatarUrl : 'https://api.dicebear.com/7.x/bottts/svg?seed=guest';
    const cleanMsg = data.message?.trim();

    if (!cleanMsg) return;

    const timeStr = getTurkeyTime();

    // Persist to mongo database
    const savedChat = await db.saveChatMessage(senderName, senderAvatar, cleanMsg, data.roomId);

    // Broadcast messages
    io.to(data.roomId).emit('receive-message', {
      userId: user?.userId || 'guest',
      username: senderName,
      avatarUrl: senderAvatar,
      message: cleanMsg,
      createdAt: savedChat.createdAt,
      timeString: timeStr,
    });
  });

  // Get chat history
  socket.on('get-chat-history', async (data: { roomId: string }, callback: Function) => {
    try {
      const list = await db.getChatHistory(data.roomId, 50);
      const formatted = list.map(c => {
        // Format to Turkey Hour string
        const hr = new Date(c.createdAt).toLocaleTimeString('tr-TR', {
          timeZone: 'Europe/Istanbul',
          hour: '2-digit',
          minute: '2-digit',
        });
        return {
          _id: c._id,
          username: c.username,
          avatarUrl: c.avatarUrl,
          message: c.message,
          createdAt: c.createdAt,
          timeString: hr,
        };
      });
      callback(formatted);
    } catch (e) {
      callback([]);
    }
  });

  // Leaving custom rooms explicitly
  socket.on('leave-room', (data: { roomCode: string }) => {
    socket.leave(data.roomCode);
    handlePlayerForfeit(socket, data.roomCode);
  });

  // Disconnection handlers
  socket.on('disconnect', () => {
    // Remove from Matchmaker
    matchmakingQueue = matchmakingQueue.filter(e => e.socketId !== socket.id);
    
    // Check if player was active in a room
    for (const [code, r] of activeRooms.entries()) {
      const activePlayer = r.players.find(p => p.socketId === socket.id);
      if (activePlayer) {
        handlePlayerForfeit(socket, code);
      }
    }

    socketUsers.delete(socket.id);
    
    io.to('lobby').emit('lobby-count-update', {
      searchingCount: matchmakingQueue.length,
      onlineCount: io.engine.clientsCount
    });
  });
});

// Forfeit logic (rage quit, disconnect during gameplay)
async function handlePlayerForfeit(socket: Socket, roomCode: string) {
  const room = activeRooms.get(roomCode);
  if (!room || room.status === 'finished') return;

  const leavingPlayer = room.players.find(p => p.socketId === socket.id);
  if (!leavingPlayer) return;

  const winnerPlayer = room.players.find(p => p.socketId !== socket.id);
  
  room.status = 'finished';
  room.winnerUserId = winnerPlayer ? winnerPlayer.userId : null;
  room.winnerName = winnerPlayer ? winnerPlayer.username : 'Beraberlik (Hükmen)';

  room.logs.push(`Hükmen: ${leavingPlayer.username} oyundan çıktı veya ayrıldı. Kazanan: ${room.winnerName}`);

  if (winnerPlayer) {
    // Player who stayed receives score increments or is adjusted to match ending state
    winnerPlayer.score += 1;
    handleGameEndEloAndStats(room);
  } else {
    // Both left or no active players left to award
    io.to(roomCode).emit('match-finished', {
      winnerUserId: null,
      winnerName: 'Hükmen Beraberlik',
      scores: {},
      eloChanges: [],
    });
    activeRooms.delete(roomCode);
  }
}

// Stats & rating computation updates
async function handleGameEndEloAndStats(room: GameRoom) {
  try {
    const isDraw = !room.winnerUserId;
    const p1 = room.players[0];
    const p2 = room.players[1];

    // Fetch up-to-date users database records
    const u1 = await db.getUserById(p1.userId);
    const u2 = await db.getUserById(p2.userId);

    const elo1 = u1 ? u1.elo : p1.elo;
    const elo2 = u2 ? u2.elo : p2.elo;

    const currentStreak1 = u1 ? u1.currentWinStreak : 0;
    const currentStreak2 = u2 ? u2.currentWinStreak : 0;

    // Determine results relative to user 1 and user 2
    let result1 = 0.5; // default draw
    let result2 = 0.5;

    if (!isDraw) {
      result1 = room.winnerUserId === p1.userId ? 1 : 0;
      result2 = room.winnerUserId === p2.userId ? 1 : 0;
    }

    // Apply user requested Elo algorithm:
    // Base 10 Elo, with 15% increase per level of current winStreak. Resets on a loss.
    let eloChange1 = 0;
    let eloChange2 = 0;

    if (isDraw) {
      eloChange1 = 0;
      eloChange2 = 0;
    } else {
      if (result1 === 1) {
        eloChange1 = Math.round(10 * (1 + currentStreak1 * 0.15));
        eloChange2 = -10;
      } else {
        eloChange2 = Math.round(10 * (1 + currentStreak2 * 0.15));
        eloChange1 = -10;
      }
    }

    // Apply DB updates
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
        newElo: updatedU1 ? updatedU1.elo : elo1 + eloChange1,
      },
      {
        userId: p2.userId,
        username: p2.username,
        change: eloChange2,
        oldElo: elo2,
        newElo: updatedU2 ? updatedU2.elo : elo2 + eloChange2,
      },
    ];

    // Save logs to MongoDB
    await db.saveGameRecord(
      [p1.userId, p2.userId],
      [p1.username, p2.username],
      room.roundsTotal,
      scoresObj,
      room.winnerUserId,
      room.winnerName || 'Beraberlik',
      eloChangesLog
    );

    // Broadcast finished match payload
    io.to(room.roomCode).emit('match-finished', {
      winnerUserId: room.winnerUserId,
      winnerName: room.winnerName,
      scores: scoresObj,
      eloChanges: eloChangesLog,
    });

    db.saveChatMessage(
      'Sistem',
      'https://api.dicebear.com/7.x/bottts/svg?seed=system',
      `Oyun sona erdi! Kazanan: ${room.winnerName || 'Beraberlik'}. ELO Değişimleri: ${p1.username} (${eloChange1 >= 0 ? '+' : ''}${eloChange1} ELO), ${p2.username} (${eloChange2 >= 0 ? '+' : ''}${eloChange2} ELO)`,
      room.roomCode
    );

    // Keep active rooms available for a while to allow final chat messages, but remove gaming slot
    setTimeout(() => {
      activeRooms.delete(room.roomCode);
    }, 120000); // clear after 2 mins

  } catch (error) {
    console.error('Error handling game end stats:', error);
    // Rescue send
    io.to(room.roomCode).emit('match-finished', {
      winnerUserId: room.winnerUserId,
      winnerName: room.winnerName,
      scores: {},
      eloChanges: [],
    });
  }
}


// ----------------------------------------------------
// Core Production Server Static Handling / Vite Middlewares
// ----------------------------------------------------

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
    console.log(`Express server successfully running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failure starting Express + Socket.IO server:', err);
});
