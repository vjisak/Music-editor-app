import { X, Globe, Share2, Star, ShieldCheck, FileText, Music } from "lucide-react";

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const settingsItems = [
  { name: "Language", icon: Globe },
  { name: "Share", icon: Share2 },
  { name: "Rate", icon: Star },
  { name: "Privacy", icon: ShieldCheck },
  { name: "Term of use", icon: FileText },
];

export default function SettingsSidebar({ isOpen, onClose }: SettingsSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-[340px] bg-card border-l border-border p-8 flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-extrabold">Setting</h2>
          <button onClick={onClose} className="text-foreground hover:text-muted-foreground transition-colors">
            <X size={28} />
          </button>
        </div>

        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/15 to-transparent p-5 mb-8 flex items-center justify-between">
          <div>
            <p className="text-gold font-bold text-sm mb-2">👑 The full experience</p>
            <button className="bg-gold text-gold-foreground px-5 py-2 rounded-full font-extrabold text-sm">
              Try for free
            </button>
          </div>
          <Music className="text-gold/30" size={40} />
        </div>

        <ul className="space-y-1 flex-1">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.name}
                className="flex items-center gap-5 py-5 border-b border-border/50 text-foreground font-semibold cursor-pointer hover:text-primary transition-colors"
              >
                <Icon size={22} />
                <span>{item.name}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
