import { Link, useLocation } from "react-router-dom";
import { Home, Sparkles, Trophy, Piano, FileMusic, Disc, SlidersHorizontal } from "lucide-react";

const navItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Moods", path: "/moods", icon: Sparkles },
  { name: "Trophies", path: "/trophies", icon: Trophy },
  { name: "Transcribe", path: "/transcribe", icon: FileMusic },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2">
      <div className="flex bg-secondary/80 backdrop-blur-xl rounded-full p-1.5 border border-border shadow-2xl">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm transition-all ${
                active
                  ? "bg-muted text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
      <Link
        to="/keyboard"
        className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm border border-border bg-secondary/80 backdrop-blur-xl shadow-2xl transition-all ${
          location.pathname === "/keyboard"
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Piano size={18} />
        <span>Keyboard</span>
      </Link>
      <Link
        to="/groove-pad"
        className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm border border-border bg-secondary/80 backdrop-blur-xl shadow-2xl transition-all ${
          location.pathname === "/groove-pad"
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Disc size={18} />
        <span>Groove</span>
      </Link>
      <Link
        to="/editor"
        className={`flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm border border-border bg-secondary/80 backdrop-blur-xl shadow-2xl transition-all ${
          location.pathname === "/editor"
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <SlidersHorizontal size={18} />
        <span>Editor</span>
      </Link>
    </nav>
  );
}
