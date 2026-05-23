import { Trash2, Download } from "lucide-react";

interface SongCardProps {
  title: string;
  artist: string;
  cover: string;
  isFirst?: boolean;
  onPlay?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
}

export default function SongCard({ title, artist, cover, isFirst, onPlay, onDelete, onDownload }: SongCardProps) {
  return (
    <div
      className={`flex-shrink-0 rounded-3xl border border-border bg-card overflow-hidden flex items-center gap-5 relative group hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 ${
        isFirst ? "min-w-[380px] p-5 border-primary/30" : "min-w-[300px] p-4"
      }`}
    >
      <div className="relative">
        <img
          src={cover}
          alt={title}
          className={`rounded-2xl object-cover ${isFirst ? "w-36 h-36" : "w-28 h-28"}`}
          loading="lazy"
          width={isFirst ? 144 : 112}
          height={isFirst ? 144 : 112}
        />
        {isFirst && (
          <button onClick={onPlay} className="absolute bottom-2 right-2 bg-background/60 backdrop-blur-sm rounded-full p-2 hover:bg-background/80 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-primary text-xs font-extrabold uppercase">New</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onDownload && (
               <button
                  onClick={onDownload}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                  title="Download PDF"
               >
                 <Download size={16} />
               </button>
            )}
            {onDelete && (
               <button
                  onClick={onDelete}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                  title="Delete"
               >
                 <Trash2 size={16} />
               </button>
            )}
          </div>
        </div>
        <h3 className="font-bold text-base truncate">{title}</h3>
        <p className="text-muted-foreground text-sm">{artist}</p>
        {isFirst && (
          <button onClick={onPlay} className="mt-3 bg-primary text-primary-foreground font-extrabold py-3 px-8 rounded-full text-sm self-start hover:brightness-110 active:brightness-90 transition-all">
            Play
          </button>
        )}
      </div>
    </div>
  );
}
