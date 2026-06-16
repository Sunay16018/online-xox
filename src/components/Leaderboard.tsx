import { useState, useEffect } from 'react';
import { Trophy, Medal, Flame, Search, UserCheck } from 'lucide-react';

interface LeaderboardUser {
  userId: string;
  username: string;
  avatarUrl: string;
  elo: number;
  wins: number;
  totalGames: number;
  maxWinStreak: number;
}

interface LeaderboardProps {
  currentUserId?: string;
  refreshTrigger?: number;
}

export default function Leaderboard({ currentUserId, refreshTrigger }: LeaderboardProps) {
  const [users, setUsers] = useState<MedalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  type MedalUser = LeaderboardUser & { rank: number };

  useEffect(() => {
    fetch('https://xox-io.onrender.com/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((item, index) => ({
            ...item,
            rank: index + 1,
          }));
          setUsers(mapped);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading leaderboard:', err);
        setLoading(false);
      });
  }, [refreshTrigger]);

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section id="leaderboard" className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col">
      <div id="leaderboard-header" className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 tracking-tight">Şampiyonlar Ligi</h3>
            <p className="text-xs text-slate-400">En yüksek ELO'lu oyuncular</p>
          </div>
        </div>
        <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-full font-semibold text-slate-600">
          Top {users.length}
        </span>
      </div>

      {/* Search Input */}
      <div id="leaderboard-search" className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Oyuncu ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
        />
      </div>

      <div id="leaderboard-list" className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 mt-2">Yükleniyor...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">Oyuncu bulunamadı.</p>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => {
              const isMe = user.userId === currentUserId;
              const hasStreak = user.maxWinStreak >= 3;

              return (
                <div
                  key={user.userId}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    isMe
                      ? 'bg-indigo-50/70 border border-indigo-100'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Badge */}
                    <div className="w-7 flex justify-center">
                      {user.rank === 1 ? (
                        <Medal className="w-5 h-5 text-amber-500 fill-amber-100" />
                      ) : user.rank === 2 ? (
                        <Medal className="w-5 h-5 text-slate-400 fill-slate-100" />
                      ) : user.rank === 3 ? (
                        <Medal className="w-5 h-5 text-amber-700 fill-amber-50" />
                      ) : (
                        <span className="text-sm font-semibold text-slate-400">
                          #{user.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar Custom with error fallback */}
                    <div className="relative">
                      <img
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                        alt={user.username}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 object-cover border border-slate-200"
                      />
                      {isMe && (
                        <span className="absolute -bottom-1 -right-1 bg-indigo-500 text-white p-0.5 rounded-full border border-white">
                          <UserCheck className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-slate-700 leading-tight">
                          {user.username}
                        </span>
                        {hasStreak && (
                          <span
                            title={`Max Seri: ${user.maxWinStreak}`}
                            className="bg-amber-100 text-amber-700 px-1 rounded text-[10px] font-bold inline-flex items-center gap-0.5"
                          >
                            <Flame className="w-2.5 h-2.5 fill-amber-500 stroke-amber-700" />
                            {user.maxWinStreak}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {user.wins} Galibiyet / {user.totalGames} Maç
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-indigo-600 block">
                      {user.elo}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      RATING
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
