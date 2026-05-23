import { Settings, Flame } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import SettingsSidebar from "@/components/SettingsSidebar";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const MOODS = [
  {
    id: "calm",
    title: "Calm Flow",
    subtitle: "Unwind & play gently",
    gradient: "from-emerald-900/80 via-emerald-800/60 to-lime-500/40",
    accent: "bg-lime-400/30",
    icon: (
      <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M40 15c-8 0-15 7-15 15s7 15 15 15 15-7 15-15-7-15-15-15z" />
        <path d="M40 10v-5M40 75v-5M10 40H5M75 40h-5" />
        <circle cx="40" cy="40" r="5" fill="currentColor" opacity="0.3" />
        <path d="M25 55c4 8 12 13 15 13s11-5 15-13" />
        <path d="M20 30c-5 5-5 15 0 20M60 30c5 5 5 15 0 20" />
      </svg>
    ),
  },
  {
    id: "night",
    title: "Night Drift",
    subtitle: "Slow down before sleep",
    gradient: "from-indigo-900/80 via-purple-800/60 to-violet-500/40",
    accent: "bg-violet-400/30",
    icon: (
      <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M40 10l5 15h16l-13 10 5 15-13-10-13 10 5-15-13-10h16z" />
        <circle cx="40" cy="40" r="8" fill="currentColor" opacity="0.2" />
      </svg>
    ),
  },
  {
    id: "soft",
    title: "Soft Start",
    subtitle: "A gentle way to begin",
    gradient: "from-orange-900/80 via-amber-700/60 to-orange-400/40",
    accent: "bg-orange-400/30",
    icon: (
      <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M40 15c-12 0-20 10-20 20s20 30 20 30 20-20 20-30-8-20-20-20z" />
        <path d="M30 35l10-10 10 10M30 45l10 10 10-10" />
      </svg>
    ),
  },
  {
    id: "mind",
    title: "Mind Clear",
    subtitle: "Clear your thoughts",
    gradient: "from-blue-900/80 via-blue-800/60 to-cyan-500/40",
    accent: "bg-cyan-400/30",
    icon: (
      <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="40" cy="40" r="20" />
        <circle cx="40" cy="40" r="10" />
        <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "focus",
    title: "Deep Focus",
    subtitle: "Concentrate & perform",
    gradient: "from-teal-900/80 via-teal-800/60 to-emerald-500/40",
    accent: "bg-emerald-400/30",
    icon: (
      <svg viewBox="0 0 80 80" className="w-20 h-20 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="20" y="20" width="40" height="40" rx="8" />
        <line x1="40" y1="15" x2="40" y2="65" />
        <line x1="15" y1="40" x2="65" y2="40" />
      </svg>
    ),
  },
];

export default function Moods() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-6 pb-28 md:p-10 md:pb-32">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold italic">Your Space</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-secondary rounded-full p-3 hover:bg-muted transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 snap-x">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            onClick={() => navigate(`/?mood=${mood.id}`)}
            className={`snap-center flex-shrink-0 w-60 h-72 rounded-2xl bg-gradient-to-b ${mood.gradient} border border-white/10 flex flex-col items-start justify-between p-5 relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div>
              <h3 className="text-lg font-bold text-foreground">{mood.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{mood.subtitle}</p>
            </div>
            <div className="flex items-center justify-center w-full flex-1 text-foreground/50">
              {mood.icon}
            </div>
            <div className={`w-full h-1.5 rounded-full ${mood.accent}`} />
          </button>
        ))}
      </div>

      <BottomNav />
      <SettingsSidebar isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
