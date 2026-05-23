# 🎵 Music Learning App

A full-stack, AI-powered music learning web application built with **React + Vite** (frontend) and **Django REST Framework** (backend). Features an audio transcription pipeline powered by **Spotify's Basic Pitch** machine learning model.

![Music App](./frontend%20(3)/public/placeholder.svg)

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🎹 **Virtual Keyboard** | Interactive piano keyboard with sound playback |
| 🎸 **Guitar Page** | Guitar chord & note learning interface |
| 🥁 **Groove Pad** | Beat-making drum pad with multiple sounds |
| 🎼 **Transcribe Pipeline** | AI audio-to-notes/MIDI transcription (Spotify Basic Pitch) |
| 🎧 **Moods** | Browse & play songs filtered by mood |
| 🏆 **Trophies** | Achievement & progress tracking |
| 📚 **Song Library** | Save, manage, and replay transcribed songs |

---

## 🏗️ Tech Stack

### Frontend
- **React 18** + **TypeScript**
- **Vite** build tool
- **Tailwind CSS** + **shadcn/ui** components
- **React Router v6**
- **Lucide React** icons
- **Sonner** toast notifications
- **jsPDF** for PDF export

### Backend
- **Django 4+** + **Django REST Framework**
- **django-cors-headers**
- **SQLite** (development) / PostgreSQL (production-ready)

### AI Transcription
- **[Spotify Basic Pitch](https://github.com/spotify/basic-pitch)** — state-of-the-art audio-to-MIDI ML model
- Runs via **ONNX Runtime** (no TensorFlow required!)
- Fallback: browser-side autocorrelation pitch detection

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+ (3.11+ supported via ONNX)
- Node.js 18+
- npm or pnpm

---

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/music-learning-app.git
cd music-learning-app
```

---

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Basic Pitch (ONNX backend, no TensorFlow needed)
# Clone or download: https://github.com/spotify/basic-pitch
pip install basic-pitch[onnx]

# Run database migrations
cd backend
python manage.py migrate

# (Optional) Seed sample songs
python seed_songs.py

# Start Django server on port 4000
python manage.py runserver 4000
```

The API will be available at: `http://localhost:4000/api/`

---

### 3. Frontend Setup

```bash
cd "frontend (3)"

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at: `http://localhost:8080`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/songs/` | List all songs |
| `POST` | `/api/songs/` | Create / save a song |
| `DELETE` | `/api/songs/{id}/` | Delete a song |
| `POST` | `/api/transcribe/` | **AI transcription** — upload audio, get notes + MIDI |

### Transcription API Example

```bash
curl -X POST http://localhost:4000/api/transcribe/ \
  -F "audio=@my_song.mp3"
```

**Response:**
```json
{
  "success": true,
  "engine": "basic_pitch",
  "note_count": 142,
  "bpm": 120,
  "notes": [
    { "time": 0.23, "duration": 0.4, "note": "C4", "pitch_midi": 60, "frequency": 261.63, "amplitude": 0.82 }
  ],
  "midi_base64": "TVRoZA..."
}
```

---

## 🎛️ Transcription Pipeline

```
Audio File Upload
      ↓
  Preprocessing       (librosa resampling & normalization)
      ↓
  Pitch Detection     (Spotify Basic Pitch ML model via ONNX)
      ↓
 Beat/Tempo Detection (tempo analysis from MIDI output)
      ↓
 Note Segmentation    (onset/offset detection, note merging)
      ↓
Notation Generator    (sheet music preview + MIDI export)
      ↓
  PDF / MIDI / Save to Library
```

---

## 📁 Project Structure

```
music-learning-app/
├── backend/                    # Django backend
│   ├── music_app/
│   │   ├── models.py           # Song model
│   │   ├── views.py            # API views (songs + transcription)
│   │   ├── serializers.py
│   │   └── urls.py
│   └── project/
│       ├── settings.py
│       └── urls.py
├── frontend (3)/               # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── Transcribe.tsx  # AI transcription pipeline UI
│       │   ├── KeyboardPage.tsx
│       │   ├── GuitarPage.tsx
│       │   ├── GroovePadPage.tsx
│       │   └── Dashboard.tsx
│       ├── components/
│       ├── lib/
│       │   └── api.ts          # API client
│       └── utils/
├── requirements.txt            # Python dependencies
└── README.md
```

---

## 📝 License

MIT License — feel free to use, modify, and share!

---

## 🙏 Credits

- [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) — audio-to-MIDI ML model
- [shadcn/ui](https://ui.shadcn.com/) — UI components
- [Lucide](https://lucide.dev/) — icons
