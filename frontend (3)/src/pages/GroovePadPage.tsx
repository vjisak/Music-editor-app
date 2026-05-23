import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Disc, Circle, Square, Play, RotateCcw, Minus, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { playNote } from "@/utils/sound";
import { toast } from "sonner";

type Pad = {
  id: string;
  label: string;
  note: string;
  keybind: string;
  accent: string;
};

const MOODS = ["calm", "night", "soft", "mind", "focus"];

const PADS: Pad[] = [
  { id: "kick", label: "Kick", note: "C2", keybind: "Q", accent: "from-emerald-500/40 to-emerald-300/20" },
  { id: "snare", label: "Snare", note: "D2", keybind: "W", accent: "from-cyan-500/40 to-cyan-300/20" },
  { id: "clap", label: "Clap", note: "E2", keybind: "E", accent: "from-blue-500/40 to-blue-300/20" },
  { id: "hat", label: "Hi-Hat", note: "F#2", keybind: "R", accent: "from-indigo-500/40 to-indigo-300/20" },
  { id: "tom1", label: "Tom Low", note: "G2", keybind: "A", accent: "from-lime-500/40 to-lime-300/20" },
  { id: "tom2", label: "Tom Mid", note: "A2", keybind: "S", accent: "from-green-500/40 to-green-300/20" },
  { id: "tom3", label: "Tom High", note: "B2", keybind: "D", accent: "from-teal-500/40 to-teal-300/20" },
  { id: "perc1", label: "Perc", note: "C3", keybind: "F", accent: "from-sky-500/40 to-sky-300/20" },
  { id: "ride", label: "Ride", note: "D3", keybind: "Z", accent: "from-yellow-500/40 to-yellow-300/20" },
  { id: "crash", label: "Crash", note: "E3", keybind: "X", accent: "from-orange-500/40 to-orange-300/20" },
  { id: "shaker", label: "Shaker", note: "G3", keybind: "C", accent: "from-red-500/35 to-red-300/20" },
  { id: "fx", label: "FX", note: "A3", keybind: "V", accent: "from-pink-500/40 to-pink-300/20" },
];

export default function GroovePadPage() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [playingPattern, setPlayingPattern] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [bpm, setBpm] = useState(108);
  const [mood, setMood] = useState("focus");
  const [recordedNotes, setRecordedNotes] = useState<{ note: string; time: number }[]>([]);
  const [activePads, setActivePads] = useState<Record<string, boolean>>({});
  const recordingStartTimeRef = useRef<number | null>(null);
  const playbackTimeoutsRef = useRef<number[]>([]);
  const keyMap = useMemo(() => Object.fromEntries(PADS.map((pad) => [pad.keybind.toLowerCase(), pad])), []);

  const triggerPad = useCallback(
    (pad: Pad) => {
      playNote(pad.note);
      setActivePads((prev) => ({ ...prev, [pad.id]: true }));
      window.setTimeout(() => {
        setActivePads((prev) => ({ ...prev, [pad.id]: false }));
      }, 140);

      if (recording && recordingStartTimeRef.current !== null) {
        const timeElapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordedNotes((prev) => [...prev, { note: pad.note, time: timeElapsed }]);
      }
    },
    [recording],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const pad = keyMap[event.key.toLowerCase()];
      if (!pad) return;
      event.preventDefault();
      triggerPad(pad);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keyMap, triggerPad]);

  useEffect(() => {
    if (!metronomeOn) return;
    const interval = window.setInterval(() => {
      playNote("C6");
    }, Math.max(120, Math.round((60_000 / bpm))));

    return () => window.clearInterval(interval);
  }, [metronomeOn, bpm]);

  useEffect(() => {
    return () => {
      playbackTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      playbackTimeoutsRef.current = [];
    };
  }, []);

  const handlePlayPattern = useCallback(() => {
    if (recordedNotes.length === 0) {
      toast("No recorded pattern yet.");
      return;
    }

    playbackTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    playbackTimeoutsRef.current = [];
    setPlayingPattern(true);

    recordedNotes.forEach((item) => {
      const timeoutId = window.setTimeout(() => playNote(item.note), item.time * 1000);
      playbackTimeoutsRef.current.push(timeoutId);
    });

    const maxTime = Math.max(...recordedNotes.map((item) => item.time));
    const finishTimeout = window.setTimeout(() => {
      setPlayingPattern(false);
    }, (maxTime + 0.3) * 1000);
    playbackTimeoutsRef.current.push(finishTimeout);
  }, [recordedNotes]);

  const handleClearPattern = useCallback(() => {
    playbackTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    playbackTimeoutsRef.current = [];
    setPlayingPattern(false);
    setRecordedNotes([]);
    toast("Pattern cleared.");
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      setRecording(false);
      if (recordedNotes.length > 0) {
        try {
          await api.createSong({
            title: `Groove Pad Session ${new Date().toLocaleString()}`,
            artist: "You",
            instrument: "Groove Pad",
            mood,
            notes: recordedNotes,
          });
          toast.success(`Groove saved as ${mood} mood!`);
        } catch {
          toast.error("Failed to save groove.");
        }
      } else {
        toast("Recording stopped (no pads hit).");
      }
      setRecordedNotes([]);
      recordingStartTimeRef.current = null;
      return;
    }

    recordingStartTimeRef.current = Date.now();
    setRecordedNotes([]);
    setRecording(true);
    toast("Groove recording started...");
  }, [mood, recordedNotes, recording]);

  return (
    <div className="min-h-screen p-6 pb-28 md:p-10 md:pb-32 bg-background/85 backdrop-blur-[1px]">
      <header className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="bg-secondary rounded-full p-3">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Disc size={20} className="text-primary" />
            <h1 className="text-2xl font-extrabold">Groove Pad</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!recording && (
            <select
              value={mood}
              onChange={(event) => setMood(event.target.value)}
              className="bg-secondary text-xs font-bold rounded-lg px-2 py-1 outline-none border-none capitalize"
            >
              {MOODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={toggleRecording}
            className={`flex items-center gap-2 px-3 py-2 rounded-full font-bold text-sm ${
              recording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {recording ? <Square size={14} /> : <Circle size={14} />}
            {recording ? "Stop" : "Record"}
          </button>
        </div>
      </header>

      <div className="rounded-3xl border border-border bg-card/70 backdrop-blur-[1px] p-4 md:p-6 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1">
            <button onClick={() => setBpm((value) => Math.max(60, value - 1))} className="p-1 rounded-full hover:bg-muted">
              <Minus size={14} />
            </button>
            <span className="text-xs font-bold w-16 text-center">{bpm} BPM</span>
            <button onClick={() => setBpm((value) => Math.min(180, value + 1))} className="p-1 rounded-full hover:bg-muted">
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={() => setMetronomeOn((value) => !value)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              metronomeOn ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-foreground"
            }`}
          >
            {metronomeOn ? "Metronome On" : "Metronome Off"}
          </button>

          <button
            onClick={handlePlayPattern}
            className="px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-secondary text-foreground flex items-center gap-1"
            disabled={playingPattern}
          >
            <Play size={12} />
            {playingPattern ? "Playing..." : "Play Pattern"}
          </button>

          <button
            onClick={handleClearPattern}
            className="px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-secondary text-foreground flex items-center gap-1"
          >
            <RotateCcw size={12} />
            Clear
          </button>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Tap pads or use keyboard: Q W E R / A S D F / Z X C V ({recordedNotes.length} hits recorded)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {PADS.map((pad) => {
            const active = Boolean(activePads[pad.id]);
            return (
              <button
                key={pad.id}
                onClick={() => triggerPad(pad)}
                className={`relative h-24 rounded-2xl border border-border transition-all text-left px-3 py-2 bg-gradient-to-br ${pad.accent} ${
                  active ? "scale-[0.97] ring-2 ring-primary shadow-[0_0_22px_rgba(163,230,53,0.35)]" : "hover:scale-[1.01]"
                }`}
              >
                <div className="text-sm font-bold">{pad.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{pad.note}</div>
                <div className="absolute right-2 bottom-2 text-[10px] font-black text-foreground/80 bg-background/45 px-2 py-0.5 rounded">
                  {pad.keybind}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
