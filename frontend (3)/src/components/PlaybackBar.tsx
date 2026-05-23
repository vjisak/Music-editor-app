import { X, Music } from "lucide-react";
import { Song } from "@/lib/api";

interface PlaybackBarProps {
  song: Song | any;
  onStop: () => void;
}

export default function PlaybackBar({ song, onStop }: PlaybackBarProps) {
  if (!song) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] md:w-[400px]">
      <div className="bg-background/80 backdrop-blur-xl border border-primary/20 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-300">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center relative overflow-hidden">
           <Music className="text-primary" size={20} />
           {/* Pulsing animation */}
           <div className="absolute inset-0 bg-primary/20 animate-pulse" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Now Playing</p>
          <h4 className="font-bold text-sm truncate">{song.title}</h4>
          <p className="text-muted-foreground text-xs truncate">{song.artist}</p>
        </div>

        <button 
          onClick={onStop}
          className="bg-secondary hover:bg-muted p-2 rounded-full transition-colors flex-shrink-0"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
