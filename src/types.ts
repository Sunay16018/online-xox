export interface UserInfo {
  userId: string;
  username: string;
  avatarUrl: string;
  elo: number;
  totalGames: number;
  wins: number;
  currentWinStreak: number;
  maxWinStreak: number;
}

export interface PlayerState extends UserInfo {
  socketId: string;
  score: number;
  symbol: 'X' | 'O';
}

export interface ChatMessage {
  _id?: string;
  userId?: string;
  username: string;
  avatarUrl: string;
  message: string;
  createdAt: string | Date;
  timeString: string;
}

export interface EloChange {
  userId: string;
  username: string;
  change: number;
  oldElo: number;
  newElo: number;
}

export interface LobbyStats {
  onlineCount: number;
  activeGames: number;
  searchingCount: number;
  usersPlaying: number;
}
