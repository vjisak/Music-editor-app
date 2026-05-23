import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Piano, X, List, Minus, Plus, Save } from "lucide-react";
import PianoKeyboard from "@/components/PianoKeyboard";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TIME_SIGNATURES = ["1/4", "3/4", "4/4"];

export default function KeyboardPage() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [octaves, setOctaves] = useState(2);
  const [showMetronome, setShowMetronome] = useState(false);
  const [timeSignature, setTimeSignature] = useState("1/4");
  const [tempo, setTempo] = useState(120);
  const [mood, setMood] = useState<string>("calm");

  const [recordedNotes, setRecordedNotes] = useState<{note: string, time: number}[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);

  const handleNotePlay = useCallback((noteName: string) => {
    if (recording && recordingStartTimeRef.current !== null) {
      const timeElapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      setRecordedNotes(prev => [...prev, { note: noteName, time: timeElapsed }]);
    }
  }, [recording]);

  const toggleRecording = async () => {
    if (recording) {
      // Stop recording
      setRecording(false);
      if (recordedNotes.length > 0) {
        try {
          await api.createSong({
            title: `Recorded Session ${new Date().toLocaleString()}`,
            artist: "You",
            instrument: "Keyboard",
            mood: mood,
            notes: recordedNotes,
          });
          toast.success(`Recording saved as ${mood} mood!`);
        } catch (err) {
          toast.error("Failed to save recording.");
        }
      } else {
        toast("Recording stopped (no notes played).");
      }
      setRecordedNotes([]);
      recordingStartTimeRef.current = null;
    } else {
      // Start recording
      setRecordedNotes([]);
      recordingStartTimeRef.current = Date.now();
      setRecording(true);
      toast("Recording started...");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/60 border-b border-border">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/")} className="bg-muted rounded-full p-2.5">
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => navigate("/selection")}
            className="bg-muted rounded-full p-2.5"
          >
            <Piano size={20} />
          </button>
          {/* Metronome toggle */}
          <button
            onClick={() => setShowMetronome(!showMetronome)}
            className={`bg-muted rounded-full p-2.5 ${showMetronome ? "ring-2 ring-primary" : ""}`}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L6 22h12L12 2z" />
              <line x1="12" y1="18" x2="12" y2="8" />
              <line x1="12" y1="8" x2="16" y2="4" />
            </svg>
          </button>
        </div>

        {/* Metronome controls inline */}
        {showMetronome && (
          <div className="flex items-center gap-2 bg-secondary/80 rounded-full px-3 py-1.5 border border-border">
            {TIME_SIGNATURES.map((ts) => (
              <button
                key={ts}
                onClick={() => setTimeSignature(ts)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  timeSignature === ts
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ts}
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-2 min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-mono">50</span>
              <Slider
                value={[tempo]}
                onValueChange={(v) => setTempo(v[0])}
                min={50}
                max={250}
                step={1}
                className="flex-1"
              />
              <span className="text-[10px] text-muted-foreground font-mono">250</span>
            </div>
            <button
              onClick={() => setShowMetronome(false)}
              className="text-muted-foreground hover:text-foreground ml-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!recording && recordedNotes.length === 0 && (
            <select 
              value={mood} 
              onChange={(e) => setMood(e.target.value)}
              className="bg-muted text-xs font-bold rounded-lg px-2 py-1 outline-none border-none capitalize"
            >
              {["calm", "night", "soft", "mind", "focus"].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <span className="text-muted-foreground text-sm font-bold uppercase">{recording ? "Stop" : "Record"}</span>
          <button
            onClick={toggleRecording}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              recording ? "bg-destructive animate-pulse-record" : "bg-destructive"
            }`}
          />
          <button className="bg-muted rounded-full p-2.5">
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Mini keyboard map + zoom */}
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary/40">
        <button
          onClick={() => setOctaves(Math.max(1, octaves - 1))}
          className="text-muted-foreground hover:text-foreground"
        >
          <Minus size={18} />
        </button>
        <div className="flex-1 h-8 bg-muted rounded overflow-hidden relative">
          <div className="flex h-full">
            {Array.from({ length: 7 * 7 }).map((_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  background:
                    [1, 3, 6, 8, 10].includes(i % 12) ? "#222" : "#666",
                }}
              />
            ))}
          </div>
          <div
            className="absolute top-0 h-full border-2 border-primary/60 rounded"
            style={{
              left: "20%",
              width: `${(octaves / 7) * 100}%`,
            }}
          />
        </div>
        <button
          onClick={() => setOctaves(Math.min(5, octaves + 1))}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Piano keys */}
      <div className="flex-1 bg-background p-2">
        <PianoKeyboard octaves={octaves} startOctave={3} onNotePlay={handleNotePlay} />
      </div>
    </div>
  );
}
