import { useState } from 'react';
import { Medal, Award, Edit3, Check } from 'lucide-react';
import { UserInfo } from '../types';

interface UserProfileProps {
  user: UserInfo | null;
  onUpdateAvatar: (newAvatarUrl: string) => Promise<{ success: boolean; error?: string }>;
  dbInfo?: { connected: boolean; mode: string; error: string | null; uriSet: boolean };
}

// ✅ DÜZELTİLDİ: assets/images/ klasöründen çekiyor
const AVATAR_PRESETS = [
  { name: 'XOX Premium', url: '/assets/images/xox_icon.png' },
  { name: 'Leo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Leo' },
  { name: 'Mia', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Mia' },
  { name: 'Jack', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Jack' },
  { name: 'Max', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Max' },
  { name: 'Ruby', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ruby' },
  { name: 'Apollo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Apollo' },
  { name: 'Rocky', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rocky' },
  { name: 'Nova', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nova' },
  { name: 'Spark', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Spark' }
];

export default function UserProfile({ user, onUpdateAvatar, dbInfo }: UserProfileProps) {
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'err'; text: string } | null>(null);

  if (!user) return null;

  const handleSaveAvatar = async () => {
    setSaving(true);
    setMessage(null);
    let targetUrl = '';

    if (selectedPreset) {
      targetUrl = selectedPreset;
    } else if (customUrl.trim().startsWith('http') || customUrl.trim().startsWith('/')) {
      targetUrl = customUrl.trim();
    } else {
      setMessage({ type: 'err', text: 'Lütfen geçerli bir internet resim adresi (http...) girin veya bir hazır karakter seçin.' });
      setSaving(false);
      return;
    }

    const res = await onUpdateAvatar(targetUrl);
    setSaving(false);

    if (res.success) {
      setMessage({ type: 'success', text: 'Profil resmi başarıyla güncellendi!' });
      setEditingAvatar(false);
      setCustomUrl('');
      setSelectedPreset('');
    } else {
      setMessage({ type: 'err', text: res.error || 'Güncelleme yapılırken hata oluştu.' });
    }
  };

  const winRatio = user.totalGames > 0 ? Math.round((user.wins / user.totalGames) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm space-y-6">
      {/* Upper info card */}
      <div className="flex flex-col items-center gap-5 pb-5 border-b border-slate-100">
        <div className="relative group">
          <img
            src={user.avatarUrl}
            alt={user.username}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
            }}
            className="w-24 h-24 sm:w-20 sm:h-20 rounded-full border-2 border-indigo-100 bg-slate-50 object-cover p-1 shadow-sm transition-transform group-hover:scale-105"
          />
          <button
            onClick={() => {
              setEditingAvatar(!editingAvatar);
              setMessage(null);
            }}
            className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 sm:p-1.5 rounded-full hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            title="Profil Resmini Değiştir"
          >
            <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>

        <div className="text-center space-y-1 w-full">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h3 className="font-bold text-xl sm:text-lg text-slate-800 tracking-tight leading-none">
              {user.username}
            </h3>
            {user.currentWinStreak >= 2 && (
              <span className="bg-amber-100 text-amber-800 text-xs sm:text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 animate-pulse">
                🔥 {user.currentWinStreak} Seri
              </span>
            )}
          </div>
          <p className="text-sm sm:text-xs text-slate-400">Üye Hesabı</p>
          <div className="pt-3 flex items-center justify-center gap-8 sm:gap-4">
            <div>
              <span className="text-xs sm:text-[10px] text-slate-400 block uppercase font-bold tracking-wider">ELO Rating</span>
              <span className="font-mono text-2xl sm:text-xl font-extrabold text-indigo-600">{user.elo}</span>
            </div>
            <div className="w-px h-10 sm:h-8 bg-slate-100"></div>
            <div>
              <span className="text-xs sm:text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Kazanma Oranı</span>
              <span className="text-2xl sm:text-xl font-extrabold text-indigo-600">{winRatio}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Editing Avatar Drawer */}
      {editingAvatar && (
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm sm:text-xs text-slate-700 tracking-tight">Profil Resmini Ayarla</h4>
            <button onClick={() => setEditingAvatar(false)} className="text-sm sm:text-xs text-slate-400 hover:text-slate-600">Vazgeç</button>
          </div>

          {/* Presets List */}
          <div className="space-y-2 sm:space-y-1.5">
            <span className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Hazır Karakterler</span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PRESETS.map((avatar) => {
                const isSelected = selectedPreset === avatar.url;
                return (
                  <button
                    key={avatar.name}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(avatar.url);
                      setCustomUrl('');
                    }}
                    className={`p-1.5 sm:p-1 rounded-lg border-2 bg-white hover:scale-105 transition-all cursor-pointer ${
                      isSelected ? 'border-indigo-600 scale-105 shadow-sm' : 'border-slate-200'
                    }`}
                    title={avatar.name}
                  >
                    <img 
                      src={avatar.url} 
                      alt={avatar.name} 
                      className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg object-cover" 
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-xs sm:text-[10px] font-bold uppercase tracking-wider">veya</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Custom Link Address */}
          <div className="space-y-2 sm:space-y-1.5">
            <span className="text-xs sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Özel Görsel Link Adresi (URL)</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setSelectedPreset('');
                }}
                placeholder="Örn: https://resim.com/resmim.jpg"
                className="flex-1 bg-white border border-slate-200 text-sm sm:text-xs px-3 py-2.5 sm:py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {message && (
            <p className={`text-sm sm:text-xs font-semibold ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {message.text}
            </p>
          )}

          <button
            onClick={handleSaveAvatar}
            disabled={saving || (!selectedPreset && !customUrl)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-sm sm:text-xs py-2.5 sm:py-2 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {saving ? (
              <span className="w-4 h-4 sm:w-3.5 sm:h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            )}
            Kaydet ve Güncelle
          </button>
        </div>
      )}

      {/* Numerical Metrics Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-50 border border-slate-100/50 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
            <span className="font-bold text-sm">🏟️</span>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wide block">Toplam Maç</span>
            <span className="font-mono text-base font-bold text-slate-700">{user.totalGames || 0}</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100/50 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg">
            <Award className="w-5 h-5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wide block">Galibiyet</span>
            <span className="font-mono text-base font-bold text-slate-700">{user.wins || 0}</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100/50 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
            <span className="font-bold text-sm">🔥</span>
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wide block">Aktif Seri</span>
            <span className="font-mono text-base font-bold text-slate-700">{user.currentWinStreak || 0} Match</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100/50 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-500 rounded-lg">
            <Medal className="w-5 h-5 sm:w-4 sm:h-4" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wide block">En Uzun Seri</span>
            <span className="font-mono text-base font-bold text-slate-700">{user.maxWinStreak || 0} Match</span>
          </div>
        </div>
      </div>
    </div>
  );
}
