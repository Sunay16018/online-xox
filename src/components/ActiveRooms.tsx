import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { DoorOpen, Users, Zap, RefreshCw, Clock, Lock, Unlock, Crown } from 'lucide-react';
import { ActiveRoomInfo } from '../types';

interface ActiveRoomsProps {
  socket: Socket | null;
  currentUserId: string;
  onJoinRoom: (roomCode: string) => void;
}

export default function ActiveRooms({ socket, currentUserId, onJoinRoom }: ActiveRoomsProps) {
  const [rooms, setRooms] = useState<ActiveRoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);

  const fetchRooms = () => {
    if (!socket) return;
    setLoading(true);
    socket.emit('get-active-rooms', (data: ActiveRoomInfo[]) => {
      setRooms(data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchRooms();
    // Auto-refresh every 10s
    const interval = setInterval(fetchRooms, 10000);
    // Also listen for broadcast updates
    if (socket) {
      socket.on('rooms-updated', (data: ActiveRoomInfo[]) => {
        setRooms(data || []);
      });
    }
    return () => {
      clearInterval(interval);
      socket?.off('rooms-updated');
    };
  }, [socket]);

  const handleJoin = (roomCode: string) => {
    setJoiningCode(roomCode);
    onJoinRoom(roomCode);
    setTimeout(() => setJoiningCode(null), 3000);
  };

  const getEloColor = (elo: number) => {
    if (elo >= 1500) return 'text-amber-500';
    if (elo >= 1200) return 'text-indigo-500';
    if (elo >= 1000) return 'text-emerald-500';
    return 'text-slate-500';
  };

  const getEloLabel = (elo: number) => {
    if (elo >= 1500) return { text: 'Grandmaster', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (elo >= 1200) return { text: 'Uzman', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    if (elo >= 1000) return { text: 'İleri', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { text: 'Başlangıç', color: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

  return (
    <section id="active-rooms" className="space-y-5">
      {/* Header */}
      <div id="rooms-header" className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <DoorOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-800 tracking-tight">Açık Odalar</h3>
            <p className="text-[11px] text-slate-400">
              {loading ? 'Yükleniyor...' : `${rooms.length} oda aktif`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchRooms}
          disabled={loading}
          className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Room List */}
      <div id="rooms-list">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                    <div className="h-2 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
              <DoorOpen className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-600">Şu an açık oda yok</p>
              <p className="text-xs text-slate-400 mt-1">Sen bir oda aç, diğerleri katılsın!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => {
              const eloLabel = getEloLabel(room.hostElo);
              const isJoining = joiningCode === room.roomCode;
              const isFull = room.playerCount >= 2;

              return (
                <div
                  key={room.roomCode}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden group ${
                    isFull
                      ? 'border-slate-100 opacity-60'
                      : 'border-slate-100 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50'
                  }`}
                >
                  {/* Top accent line */}
                  <div className={`h-0.5 w-full ${isFull ? 'bg-slate-200' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'}`} />
                  
                  <div className="p-4 flex items-center gap-3">
                    {/* Host Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={room.hostAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${room.hostUsername}`}
                        alt={room.hostUsername}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover"
                      />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white ${isFull ? 'bg-slate-400' : 'bg-emerald-400'}`}>
                        {isFull
                          ? <Lock className="w-2 h-2 text-white" />
                          : <Unlock className="w-2 h-2 text-white" />
                        }
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 truncate">{room.hostUsername}</span>
                        <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${eloLabel.color}`}>
                          {eloLabel.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`font-mono text-xs font-black ${getEloColor(room.hostElo)}`}>
                          ⭐ {room.hostElo} ELO
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Zap className="w-3 h-3" />
                          {room.rounds} Tur
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Users className="w-3 h-3" />
                          {room.playerCount}/2
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-lg">
                          #{room.roomCode}
                        </span>
                      </div>
                    </div>

                    {/* Join Button */}
                    <button
                      onClick={() => !isFull && handleJoin(room.roomCode)}
                      disabled={isFull || isJoining}
                      className={`shrink-0 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm ${
                        isFull
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : isJoining
                          ? 'bg-indigo-100 text-indigo-400'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-200 hover:shadow-md'
                      }`}
                    >
                      {isFull ? 'Dolu' : isJoining ? '...' : 'Katıl'}
                    </button>
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
