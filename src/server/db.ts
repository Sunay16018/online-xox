import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Establish a connection status
export let isMongoConnected = false;
let mongoConnectionError: string | null = null;

const MONGO_URI = process.env.MONGO_URI || '';

if (MONGO_URI) {
  mongoose.connect(MONGO_URI, { dbName: 'xox_db' })
    .then(() => {
      console.log('MongoDB successfully connected to xox_db.');
      isMongoConnected = true;
    })
    .catch((err) => {
      console.error('MongoDB connection error. Falling back to in-memory store:', err);
      mongoConnectionError = err.message || String(err);
      isMongoConnected = false;
    });
} else {
  console.log('No MONGO_URI env variable set. Using fully-featured in-memory database fallback.');
}

// Ensure the db collection status can be fetched
export function getDbStatus() {
  return {
    connected: isMongoConnected,
    mode: isMongoConnected ? 'MongoDB Atlas' : 'In-Memory Fallback',
    error: mongoConnectionError,
    uriSet: !!MONGO_URI,
  };
}

// ----------------------------------------------------
// MongoDB Mongoose Schemas & Models (Casted to any for seamless TypeScript compile)
// ----------------------------------------------------

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatarUrl: { type: String, default: 'https://api.dicebear.com/7.x/bottts/svg?seed=default' },
  elo: { type: Number, default: 0 },
  totalGames: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  currentWinStreak: { type: Number, default: 0 },
  maxWinStreak: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const gameSchema = new mongoose.Schema({
  playerIds: [String],
  playerNames: [String],
  rounds: { type: Number, required: true },
  scores: { type: Map, of: Number }, // Map of playerUsername -> score
  winnerId: { type: String, default: null },
  winnerName: { type: String, default: 'Beraberlik' },
  eloChanges: [{ userId: String, username: String, change: Number, oldElo: Number, newElo: Number }],
  createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  username: { type: String, required: true },
  avatarUrl: { type: String, required: true },
  message: { type: String, required: true },
  roomId: { type: String, required: true }, // 'lobby' or roomCode
  createdAt: { type: Date, default: Date.now }
});

export const MongoUser = (mongoose.models.User || mongoose.model('User', userSchema)) as any;
export const MongoGame = (mongoose.models.Game || mongoose.model('Game', gameSchema)) as any;
export const MongoChat = (mongoose.models.Chat || mongoose.model('Chat', chatSchema)) as any;

// ----------------------------------------------------
// In-Memory Fallback Store (Matches MongoDB exactly)
// ----------------------------------------------------

export interface UserDoc {
  _id: string;
  username: string;
  password?: string;
  avatarUrl: string;
  elo: number;
  totalGames: number;
  wins: number;
  currentWinStreak: number;
  maxWinStreak: number;
  createdAt: Date;
}

export interface GameDoc {
  _id: string;
  playerIds: string[];
  playerNames: string[];
  rounds: number;
  scores: Record<string, number>;
  winnerId: string | null;
  winnerName: string;
  eloChanges: Array<{
    userId: string;
    username: string;
    change: number;
    oldElo: number;
    newElo: number;
  }>;
  createdAt: Date;
}

export interface ChatDoc {
  _id: string;
  username: string;
  avatarUrl: string;
  message: string;
  roomId: string;
  createdAt: Date;
}

// In-Memory In-Memory structures
const memoryUsers: Map<string, UserDoc> = new Map();
const memoryGames: GameDoc[] = [];
const memoryChats: ChatDoc[] = [];

// Seed in-memory users for instant testing (optional)
const defaultAvatars = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Leo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Mia',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Jack',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Max'
];

(async () => {
  const testUsers = ['Ahmet', 'Zeynep', 'Demir', 'Selin'];
  for (let i = 0; i < testUsers.length; i++) {
    const hashed = await bcrypt.hash('123456', 10);
    const userId = `mem_user_${i + 1}`;
    memoryUsers.set(userId, {
      _id: userId,
      username: testUsers[i],
      password: hashed,
      avatarUrl: defaultAvatars[i],
      elo: 10 + i * 15,
      totalGames: 12 + i * 4,
      wins: 7 + i * 2,
      currentWinStreak: i,
      maxWinStreak: i + 2,
      createdAt: new Date(),
    });
  }
})();

// ----------------------------------------------------
// DB Adapter Interface (Unifies MongoDB & In-Memory)
// ----------------------------------------------------

export const db = {
  // --- USER API ---
  async getUserByUsername(username: string): Promise<UserDoc | null> {
    const searchName = username.trim().toLowerCase();
    if (isMongoConnected) {
      try {
        const doc = await MongoUser.findOne({ username: { $regex: new RegExp(`^${searchName}$`, 'i') } });
        if (doc) return (doc.toObject() as any) as UserDoc;
      } catch (e) {
        console.error('Mongo getUserByUsername error, fallback query:', e);
      }
    }
    // Fallback
    for (const u of memoryUsers.values()) {
      if (u.username.toLowerCase() === searchName) {
        return u;
      }
    }
    return null;
  },

  async getUserById(id: string): Promise<UserDoc | null> {
    if (isMongoConnected) {
      try {
        const doc = await MongoUser.findById(id);
        if (doc) return (doc.toObject() as any) as UserDoc;
      } catch (e) {
        console.error('Mongo getUserById error, fallback query:', e);
      }
    }
    return memoryUsers.get(id) || null;
  },

  async createUser(username: string, passwordHashed: string, avatarUrl?: string): Promise<UserDoc> {
    const avatar = avatarUrl?.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
    if (isMongoConnected) {
      try {
        const doc = await MongoUser.create({
          username,
          password: passwordHashed,
          avatarUrl: avatar,
        });
        return (doc.toObject() as any) as UserDoc;
      } catch (e) {
        console.error('Mongo createUser error, trying in-memory backup:', e);
      }
    }
    // Fallback
    const userId = `mem_user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newUser: UserDoc = {
      _id: userId,
      username,
      password: passwordHashed,
      avatarUrl: avatar,
      elo: 0,
      totalGames: 0,
      wins: 0,
      currentWinStreak: 0,
      maxWinStreak: 0,
      createdAt: new Date(),
    };
    memoryUsers.set(userId, newUser);
    return newUser;
  },

  async updateUserStats(
    userId: string,
    eloChange: number,
    isWin: boolean,
    isDraw: boolean
  ): Promise<UserDoc | null> {
    if (isMongoConnected) {
      try {
        const doc = await MongoUser.findById(userId);
        if (doc) {
          doc.totalGames += 1;
          doc.elo = Math.max(0, doc.elo + eloChange);
          
          if (isWin) {
            doc.wins += 1;
            doc.currentWinStreak += 1;
            if (doc.currentWinStreak > doc.maxWinStreak) {
              doc.maxWinStreak = doc.currentWinStreak;
            }
          } else if (isDraw) {
            // Draw preserves current win streak
          } else {
            doc.currentWinStreak = 0;
          }
          await doc.save();
          return (doc.toObject() as any) as UserDoc;
        }
      } catch (e) {
        console.error('Mongo updateUserStats error, fallback update:', e);
      }
    }

    // Fallback
    const user = memoryUsers.get(userId);
    if (user) {
      user.totalGames += 1;
      user.elo = Math.max(0, user.elo + eloChange);
      if (isWin) {
        user.wins += 1;
        user.currentWinStreak += 1;
        if (user.currentWinStreak > user.maxWinStreak) {
          user.maxWinStreak = user.currentWinStreak;
        }
      } else if (isDraw) {
        // Draw preserves streak
      } else {
        user.currentWinStreak = 0;
      }
      memoryUsers.set(userId, { ...user });
      return user;
    }
    return null;
  },

  async updateUserAvatar(userId: string, avatarUrl: string): Promise<UserDoc | null> {
    if (isMongoConnected) {
      try {
        const doc = await MongoUser.findByIdAndUpdate(userId, { avatarUrl }, { new: true });
        if (doc) return (doc.toObject() as any) as UserDoc;
      } catch (e) {
        console.error('Mongo updateUserAvatar error:', e);
      }
    }
    const user = memoryUsers.get(userId);
    if (user) {
      user.avatarUrl = avatarUrl;
      memoryUsers.set(userId, { ...user });
      return user;
    }
    return null;
  },

  async getLeaderboard(limit = 500): Promise<UserDoc[]> {
    if (isMongoConnected) {
      try {
        const docs = await MongoUser.find().sort({ elo: -1 }).limit(limit);
        return docs.map((d: any) => d.toObject() as any) as UserDoc[];
      } catch (e) {
        console.error('Mongo getLeaderboard error:', e);
      }
    }
    // Fallback
    return Array.from(memoryUsers.values())
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  },

  // --- GAME API ---
  async saveGameRecord(
    playerIds: string[],
    playerNames: string[],
    rounds: number,
    scores: Record<string, number>,
    winnerId: string | null,
    winnerName: string,
    eloChanges: Array<{
      userId: string;
      username: string;
      change: number;
      oldElo: number;
      newElo: number;
    }>
  ): Promise<GameDoc> {
    if (isMongoConnected) {
      try {
        const doc = await MongoGame.create({
          playerIds,
          playerNames,
          rounds,
          scores,
          winnerId,
          winnerName,
          eloChanges,
        });
        return (doc.toObject() as any) as GameDoc;
      } catch (e) {
        console.error('Mongo saveGameRecord error, using memory fallback:', e);
      }
    }

    // Fallback
    const newGame: GameDoc = {
      _id: `mem_game_${Date.now()}`,
      playerIds,
      playerNames,
      rounds,
      scores,
      winnerId,
      winnerName,
      eloChanges,
      createdAt: new Date(),
    };
    memoryGames.push(newGame);
    return newGame;
  },

  async getRecentGames(limit = 10): Promise<GameDoc[]> {
    if (isMongoConnected) {
      try {
        const docs = await MongoGame.find().sort({ createdAt: -1 }).limit(limit);
        return docs.map((d: any) => d.toObject() as any) as GameDoc[];
      } catch (e) {
        console.error('Mongo getRecentGames error:', e);
      }
    }
    return [...memoryGames].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  },

  // --- CHAT API ---
  async saveChatMessage(username: string, avatarUrl: string, message: string, roomId: string): Promise<ChatDoc> {
    if (isMongoConnected) {
      try {
        const doc = await MongoChat.create({
          username,
          avatarUrl,
          message,
          roomId,
        });
        return (doc.toObject() as any) as ChatDoc;
      } catch (e) {
        console.error('Mongo saveChatMessage error, using memory fallback:', e);
      }
    }

    const newChat: ChatDoc = {
      _id: `mem_chat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      avatarUrl,
      message,
      roomId,
      createdAt: new Date(),
    };
    memoryChats.push(newChat);
    return newChat;
  },

  async getChatHistory(roomId: string, limit = 50): Promise<ChatDoc[]> {
    if (isMongoConnected) {
      try {
        const docs = await MongoChat.find({ roomId }).sort({ createdAt: -1 }).limit(limit);
        // We sort descending in query, but return in ascending order of time so they display correctly from top to bottom
        return docs.map((d: any) => d.toObject() as any).reverse() as ChatDoc[];
      } catch (e) {
        console.error('Mongo getChatHistory error:', e);
      }
    }

    const filtered = memoryChats.filter(c => c.roomId === roomId);
    return filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(-limit);
  }
};
