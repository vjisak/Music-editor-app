import { useState, useRef, useEffect } from "react";
import { Settings, Flame, Loader2, SkipBack, SkipForward, Play, Heart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import SongCard from "@/components/SongCard";
import BottomNav from "@/components/BottomNav";
import SettingsSidebar from "@/components/SettingsSidebar";
import PlaybackBar from "@/components/PlaybackBar";
import { api, Song } from "@/lib/api";
import { playNote } from "@/utils/sound";
import { toast } from "sonner";
import { downloadSongPDF } from "@/utils/pdfExport";

import coverGymnopedie from "@/assets/cover-gymnopedie.jpg";
import coverRiver from "@/assets/cover-river.jpg";
import coverKissRain from "@/assets/cover-kiss-rain.jpg";

const DEFAULT_SONGS = [
  { 
    id: -1, 
    title: "Gymnopédie No. 1", 
    artist: "Erik Satie", 
    cover: coverGymnopedie, 
    notes: [
      { note: "G4", time: 0.5 }, { note: "B4", time: 1.5 }, { note: "D5", time: 2.5 },
      { note: "F#5", time: 3.5 }, { note: "A5", time: 4.5 }
    ] 
  },
  { 
    id: -2, 
    title: "River Flows in You", 
    artist: "Yiruma", 
    cover: coverRiver, 
    notes: [
      { note: "A4", time: 0.2 }, { note: "E5", time: 0.6 }, { note: "A5", time: 1.0 }, 
      { note: "B5", time: 1.4 }, { note: "C6", time: 1.8 }
    ] 
  },
  { 
    id: -3, 
    title: "Kiss the Rain", 
    artist: "Yiruma", 
    cover: coverKissRain, 
    notes: [
      { note: "E4", time: 0.4 }, { note: "A4", time: 0.8 }, { note: "B4", time: 1.2 }, 
      { note: "C5", time: 1.6 }, { note: "D5", time: 2.0 }
    ] 
  },
];

export default function Dashboard() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playingSong, setPlayingSong] = useState<Song | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [likedSamples, setLikedSamples] = useState<number[]>([]);
  const [searchParams] = useSearchParams();
  const moodFilter = searchParams.get('mood');
  const queryClient = useQueryClient();
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['songs', moodFilter],
    queryFn: () => api.getSongs(moodFilter),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSong(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      toast.success("Song deleted");
    },
    onError: () => toast.error("Failed to delete song"),
  });

  const handleStop = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setPlayingSong(null);
  };

  const handlePlay = (song: Song | any) => {
    if (!song.notes || song.notes.length === 0) {
      toast("No notes to play for this preview");
      return;
    }

    // Stop any current playback
    handleStop();

    setPlayingSong(song);
    
    // Find song duration to auto-clean up state
    const maxTime = Math.max(...song.notes.map((n: any) => n.time));
    
    song.notes.forEach((noteData: any) => {
      const tid = setTimeout(() => {
        playNote(noteData.note);
      }, noteData.time * 1000);
      timeoutsRef.current.push(tid);
    });

    const finalTid = setTimeout(() => {
      setPlayingSong(null);
    }, (maxTime + 1) * 1000);
    timeoutsRef.current.push(finalTid);
  };

  useEffect(() => {
    const stored = localStorage.getItem("likedSampleSongIds");
    if (stored) {
      try {
        setLikedSamples(JSON.parse(stored));
      } catch {
        setLikedSamples([]);
      }
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleDownload = (song: Song | any) => {
    if (!song.notes || song.notes.length === 0) {
      toast("No notes available in this transcription to download.");
      return;
    }
    // Map backend response if needed (matches NoteItem interface)
    downloadSongPDF(song.title, song.artist || "Unknown", song.notes);
    toast.success("Downloading transcription PDF...");
  };

  const displaySongs = (songs.length > 0 || moodFilter)
    ? songs.map((song: Song) => ({
        ...song,
        artist: song.artist || "Unknown Artist",
        cover: song.cover_image || coverGymnopedie,
      }))
    : DEFAULT_SONGS;

  const sampleSongs = displaySongs.slice(0, Math.min(displaySongs.length, 10));
  const activeSample = sampleSongs[sampleIndex] || null;

  const playSampleSnippet = (song: Song | any) => {
    if (!song?.notes || song.notes.length === 0) {
      toast("No notes available for sample preview.");
      return;
    }
    handleStop();

    const snippet = song.notes.slice(0, 14);
    snippet.forEach((noteData: any, index: number) => {
      const tid = setTimeout(() => {
        playNote(noteData.note);
      }, index * 180);
      timeoutsRef.current.push(tid);
    });

    const finish = setTimeout(() => {
      setPlayingSong(null);
    }, snippet.length * 180 + 220);
    timeoutsRef.current.push(finish);
  };

  const goSample = (direction: "prev" | "next") => {
    if (sampleSongs.length === 0) return;
    setSampleIndex((current) => {
      if (direction === "next") return (current + 1) % sampleSongs.length;
      return (current - 1 + sampleSongs.length) % sampleSongs.length;
    });
  };

  const toggleLikeSample = (songId: number) => {
    setLikedSamples((prev) => {
      const next = prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId];
      localStorage.setItem("likedSampleSongIds", JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen p-6 pb-28 md:p-10 md:pb-32">
      <header className="flex items-center justify-between mb-8">
        <div>
           <h1 className="text-3xl font-extrabold italic">For You</h1>
           {moodFilter && <p className="text-primary mt-1 text-sm font-semibold capitalize">Mood: {moodFilter}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-secondary rounded-full p-3 hover:bg-muted transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {activeSample && (
        <section className="mb-7 rounded-3xl border border-primary/20 bg-card/70 backdrop-blur-[1px] p-4 md:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-[0.18em] font-extrabold text-primary">Quick Samples</h2>
            <div className="text-[11px] text-muted-foreground font-semibold">
              {sampleIndex + 1}/{sampleSongs.length}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => goSample("prev")}
              className="p-2.5 rounded-full bg-secondary hover:bg-muted transition-colors"
              aria-label="Previous sample"
            >
              <SkipBack size={16} />
            </button>

            <div className="flex-1 flex items-center gap-3 bg-secondary/45 rounded-2xl p-2.5 border border-border">
              <img
                src={activeSample.cover}
                alt={activeSample.title}
                className="w-16 h-16 rounded-xl object-cover"
                loading="lazy"
                width={64}
                height={64}
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{activeSample.title}</p>
                <p className="text-sm text-muted-foreground truncate">{activeSample.artist}</p>
              </div>
              <button
                onClick={() => playSampleSnippet(activeSample)}
                className="px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5"
              >
                <Play size={12} />
                Play Sample
              </button>
              <button
                onClick={() => toggleLikeSample(activeSample.id)}
                className={`p-2 rounded-full border ${
                  likedSamples.includes(activeSample.id)
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Like sample"
              >
                <Heart size={14} fill={likedSamples.includes(activeSample.id) ? "currentColor" : "none"} />
              </button>
            </div>

            <button
              onClick={() => goSample("next")}
              className="p-2.5 rounded-full bg-secondary hover:bg-muted transition-colors"
              aria-label="Next sample"
            >
              <SkipForward size={16} />
            </button>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4">
          {displaySongs.map((song, i) => (
            <SongCard
              key={song.id}
              title={song.title}
              artist={song.artist}
              cover={song.cover}
              isFirst={i === 0}
              onPlay={() => handlePlay(song)}
              onDelete={song.id > 0 ? () => deleteMutation.mutate(song.id) : undefined}
              onDownload={() => handleDownload(song)}
            />
          ))}
          {displaySongs.length === 0 && <p className="text-muted-foreground p-4">No songs found for this mood.</p>}
        </div>
      )}

      <PlaybackBar song={playingSong} onStop={handleStop} />
      <BottomNav />
      <SettingsSidebar isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
