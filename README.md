# XOX Arena 🎮

**Gerçek zamanlı çevrimiçi XOX (Tic-Tac-Toe) oyunu**

ELO puanlama sistemi, lobi sohbeti, özel oda desteği ve PWA ile donatılmış tam özellikli multiplayer oyun platformu.

## 🚀 Render.com'da Yayınlama

### 1. Ortam Değişkenleri (Environment Variables)

Render.com dashboard'unda şu değişkenleri ayarlayın:

| Değişken | Açıklama | Zorunlu |
|---|---|---|
| `MONGO_URI` | MongoDB Atlas bağlantı dizesi | Hayır (in-memory fallback) |
| `JWT_SECRET` | JWT imzalama anahtarı | **Evet** |
| `NODE_ENV` | `production` olarak ayarlayın | **Evet** |

### 2. Build & Start Komutları

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Node Version:** 18+

### 3. MongoDB Atlas (Opsiyonel)

MongoDB olmadan da çalışır (in-memory). Kalıcı veri için Atlas'tan ücretsiz cluster alın ve `MONGO_URI`'yi ayarlayın.

## 🛠️ Lokal Geliştirme

```bash
npm install
cp .env.example .env
# .env içinde gerekli değerleri ayarlayın
npm run dev
```

## ✨ Özellikler

- 🎯 **Gerçek Zamanlı Multiplayer** - Socket.IO ile anlık oyun
- 📊 **ELO Sistemi** - Rekabetçi sıralama
- 🏆 **Liderlik Tablosu** - Top 500 oyuncu
- 💬 **Lobi & Oda Sohbeti** - Anlık mesajlaşma
- 🔐 **JWT Kimlik Doğrulama** - Güvenli oturum yönetimi
- 🎭 **Özel Odalar** - Arkadaşlarla özel maç
- 📱 **PWA Desteği** - Mobil'e eklenebilir uygulama
- 🗄️ **MongoDB Atlas** - Kalıcı veri (opsiyonel)
- ⚡ **In-Memory Fallback** - Veritabanı olmadan da çalışır
