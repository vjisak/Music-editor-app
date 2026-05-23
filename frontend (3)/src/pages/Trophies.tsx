import { useState, useMemo } from "react";
import { Settings, Flame, Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import SettingsSidebar from "@/components/SettingsSidebar";
import { useQuery } from "@tanstack/react-query";
import { api, Song } from "@/lib/api";

const STATIC_TROPHIES = [
  { id: "peace", title: "Moment of Peace", goal: 1, type: "days" },
  { id: "soft", title: "Soft Connection", goal: 3, type: "days" },
  { id: "steady", title: "Steady Comfort", goal: 5, type: "days" },
  { id: "weekly", title: "Weekly Stillness", goal: 7, type: "days" },
  { id: "comp", title: "First Composition", goal: 1, type: "keyboard" },
  { id: "trans", title: "Transcriber Pro", goal: 1, type: "transcribe" },
  { id: "mood", title: "Mood Master", goal: 3, type: "moods" },
  { id: "poly", title: "Sound Mastery", goal: 3, type: "instruments" },
];

function HexBadge({ trophy, current, unlocked }: { trophy: any, current: number, unlocked: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-36">
        <svg viewBox="0 0 120 140" className="w-full h-full">
          {/* Outer hex border */}
          <polygon
            points="60,4 112,35 112,97 60,128 8,97 8,35"
            fill="none"
            stroke={unlocked ? "hsl(var(--primary))" : "hsl(var(--muted))"}
            strokeWidth="3"
          />
          {/* Inner hex fill */}
          <polygon
            points="60,12 106,39 106,93 60,120 14,93 14,39"
            fill={unlocked ? "hsl(var(--secondary))" : "hsl(var(--muted))"}
          />
          {/* Flame icon */}
          <g transform="translate(60, 55)" opacity={unlocked ? 1 : 0.3}>
            <path
              d="M0,-22 C8,-14 14,-6 14,4 C14,14 8,22 0,22 C-8,22 -14,14 -14,4 C-14,-6 -8,-14 0,-22Z"
              fill="none"
              stroke={unlocked ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeWidth="2"
            />
            <path
              d="M0,-10 C4,-6 6,-2 6,2 C6,6 4,10 0,10 C-4,10 -6,6 -6,2 C-6,-2 -4,-6 0,-10Z"
              fill={unlocked ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              opacity="0.3"
            />
          </g>
          {/* Goal progress */}
          <text
            x="60"
            y="85"
            textAnchor="middle"
            fontSize="18"
            fontWeight="bold"
            fill={unlocked ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
          >
            {unlocked ? "✓" : `${current}/${trophy.goal}`}
          </text>
        </svg>
        {/* Glow effect for unlocked */}
        {unlocked && (
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl -z-10" />
        )}
      </div>
      <p className={`text-sm font-semibold text-center ${unlocked ? "text-primary" : "text-muted-foreground"}`}>
        {trophy.title}
      </p>
    </div>
  );
}

export default function Trophies() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['songs'],
    queryFn: () => api.getSongs(),
  });

  const stats = useMemo(() => {
    const dates = new Set(songs.map((s: Song) => new Date(s.created_at).setHours(0, 0, 0, 0)));
    const instruments = new Set(songs.map((s: Song) => s.instrument));
    const moods = new Set(songs.filter((s: Song) => s.mood).map((s: Song) => s.mood!));
    const keyboardCount = songs.filter((s: Song) => s.instrument === "Keyboard").length;
    const transcribeCount = songs.filter((s: Song) => s.instrument === "Transcription").length;

    return {
      days: dates.size,
      instruments: instruments.size,
      moods: moods.size,
      keyboard: keyboardCount,
      transcribe: transcribeCount
    };
  }, [songs]);

  const trophies = STATIC_TROPHIES.map(t => {
    const currentValue = (stats as any)[t.type] || 0;
    return {
      ...t,
      current: currentValue,
      unlocked: currentValue >= t.goal
    };
  });

  const totalPoints = trophies.filter(t => t.unlocked).length;

  return (
    <div className="min-h-screen p-6 pb-28 md:p-10 md:pb-32">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold italic">Your Moments</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-secondary rounded-xl px-4 py-2 font-bold text-sm">
            <span>{totalPoints}</span>
            <Flame size={16} className={`text-orange-400 ${totalPoints > 0 ? "animate-pulse" : ""}`} />
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-secondary rounded-full p-3 hover:bg-muted transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin w-8 h-8 text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pb-4">
          {trophies.map((trophy) => (
            <div key={trophy.id} className="flex justify-center">
              <HexBadge trophy={trophy} current={trophy.current} unlocked={trophy.unlocked} />
            </div>
          ))}
        </div>
      )}

      <BottomNav />
      <SettingsSidebar isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
