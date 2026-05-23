import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, FileMusic, Download, Music, Save,
  CheckCircle2, Activity, Disc, ListMusic, FileText,
  Loader2, RotateCcw, Zap, Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { api, TranscribedNote } from "@/lib/api";
import { toast } from "sonner";
import { downloadSongPDF } from "@/utils/pdfExport";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DetectedNote {
  time: number;
  note: string;
  frequency: number;
  duration: number;
  amplitude?: number;
}

type ProcessingPhase =
  | 'idle'
  | 'uploading'
  | 'preprocessing'
  | 'pitch_detection'
  | 'beat_detection'
  | 'note_segmentation'
  | 'notation_generator'
  | 'complete';

type Engine = 'basic_pitch' | 'fallback' | null;

// ─── Pipeline Phases ─────────────────────────────────────────────────────────

const PHASES: { id: ProcessingPhase; label: string; icon: any; description: string }[] = [
  { id: 'uploading',          label: 'Audio Input',           icon: Upload,       description: 'Sending audio to server' },
  { id: 'preprocessing',      label: 'Preprocessing',         icon: Activity,     description: 'Resampling & normalizing' },
  { id: 'pitch_detection',    label: 'Pitch Detection',       icon: Disc,         description: 'ML model inference (Basic Pitch)' },
  { id: 'beat_detection',     label: 'Beat / Tempo Detection',icon: Activity,     description: 'Tempo & beat grid analysis' },
  { id: 'note_segmentation',  label: 'Note Segmentation',     icon: ListMusic,    description: 'Onset & offset detection' },
  { id: 'notation_generator', label: 'Notation Generator',    icon: FileText,     description: 'Generating sheet music & MIDI' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function frequencyToNote(freq: number): string {
  if (freq < 20 || freq > 8000) return "";
  const noteNum = 12 * (Math.log2(freq / 440));
  const noteIndex = Math.round(noteNum) + 69;
  const octave = Math.floor(noteIndex / 12) - 1;
  const name = NOTE_NAMES[noteIndex % 12];
  return `${name}${octave}`;
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thresh = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thresh) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thresh) { r2 = SIZE - i; break; }
  }

  const buf = buffer.slice(r1, r2);
  const len = buf.length;
  const c = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) {
      c[i] += buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxVal = -1, maxPos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }

  const T0 = maxPos;
  if (T0 === 0) return -1;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a ? -b / (2 * a) : 0;
  return sampleRate / (T0 + shift);
}

function detectTempo(channelData: Float32Array, sampleRate: number): number {
  const hopSize = 2048;
  const peaks: number[] = [];
  const threshold = 0.5;
  for (let i = 0; i < channelData.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < hopSize && i + j < channelData.length; j++) sum += Math.abs(channelData[i + j]);
    if (sum / hopSize > threshold) peaks.push(i / sampleRate);
  }
  if (peaks.length < 2) return 120;
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const diff = peaks[i] - peaks[i - 1];
    if (diff > 0.2 && diff < 2.0) intervals.push(diff);
  }
  if (intervals.length === 0) return 120;
  intervals.sort((a, b) => a - b);
  return Math.round(60 / intervals[Math.floor(intervals.length / 2)]);
}

// Fallback: pure browser-side pipeline
async function processFallback(
  file: File,
  onProgress: (phase: ProcessingPhase, p: number) => void
): Promise<{ notes: DetectedNote[]; bpm: number }> {
  onProgress('preprocessing', 10);
  const arrayBuffer = await file.arrayBuffer();
  onProgress('preprocessing', 40);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  onProgress('preprocessing', 100);

  onProgress('pitch_detection', 0);
  const windowSize = 2048;
  const hopSize = 1024;
  const totalSteps = Math.floor((channelData.length - windowSize) / hopSize);
  const rawNotes: { time: number; note: string; freq: number }[] = [];

  await new Promise(r => setTimeout(r, 100));
  for (let i = 0; i < totalSteps; i++) {
    const start = i * hopSize;
    const segment = channelData.slice(start, start + windowSize);
    const freq = autoCorrelate(segment, sampleRate);
    if (freq > 0) {
      const note = frequencyToNote(freq);
      if (note) rawNotes.push({ time: start / sampleRate, note, freq });
    }
    if (i % 500 === 0) {
      onProgress('pitch_detection', Math.round((i / totalSteps) * 100));
      await new Promise(r => setTimeout(r, 0));
    }
  }
  onProgress('pitch_detection', 100);

  onProgress('beat_detection', 0);
  await new Promise(r => setTimeout(r, 200));
  const bpm = detectTempo(channelData, sampleRate);
  onProgress('beat_detection', 100);

  onProgress('note_segmentation', 0);
  await new Promise(r => setTimeout(r, 300));
  const merged: DetectedNote[] = [];
  let current: DetectedNote | null = null;
  for (const rn of rawNotes) {
    if (current && current.note === rn.note && rn.time - (current.time + current.duration) < 0.08) {
      current.duration = rn.time - current.time + hopSize / sampleRate;
    } else {
      if (current && current.duration >= 0.05) merged.push(current);
      current = { time: rn.time, note: rn.note, frequency: rn.freq, duration: hopSize / sampleRate };
    }
  }
  if (current && current.duration >= 0.05) merged.push(current);
  onProgress('note_segmentation', 100);

  onProgress('notation_generator', 0);
  await new Promise(r => setTimeout(r, 500));
  onProgress('notation_generator', 100);

  audioCtx.close();
  return { notes: merged.sort((a, b) => a.time - b.time), bpm };
}

// Convert MIDI base64 to a downloadable Blob URL
function midiB64ToObjectUrl(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/midi' });
  return URL.createObjectURL(blob);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Transcribe() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ProcessingPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState<DetectedNote[]>([]);
  const [bpm, setBpm] = useState<number>(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mood, setMood] = useState<string>("calm");
  const [engine, setEngine] = useState<Engine>(null);
  const [midiB64, setMidiB64] = useState<string>("");

  // ── Stepper helpers ──────────────────────────────────────────────────────

  const phaseIndex = PHASES.findIndex(p => p.id === phase);

  const reset = useCallback(() => {
    setNotes([]);
    setPhase('idle');
    setProgress(0);
    setBpm(0);
    setEngine(null);
    setError("");
    setMidiB64("");
  }, []);

  const clearSelection = useCallback(() => {
    setFile(null);
    reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;
      const ext = selected.name.split(".").pop()?.toLowerCase() ?? "";
      const isMidi = ext === "mid" || ext === "midi";
      const isAudio = selected.type.startsWith("audio/");
      if (!isAudio && !isMidi) {
        toast.error("Unsupported file type. Upload audio (MP3, WAV, FLAC, etc.) or MIDI.");
        if (e.target) e.target.value = "";
        return;
      }
      setFile(selected);
      reset();
    },
    [reset]
  );

  // ── Main extraction ───────────────────────────────────────────────────────

  const handleExtract = useCallback(async () => {
    if (!file) return;
    reset();

    try {
      // ── Strategy 1: Backend Basic Pitch ──────────────────────────────────
      try {
        // Simulate progressive pipeline stages while the backend processes
        const simulateStages = async () => {
          const stages: Array<[ProcessingPhase, number]> = [
            ['uploading', 100],
            ['preprocessing', 100],
            ['pitch_detection', 100],
            ['beat_detection', 100],
            ['note_segmentation', 100],
            ['notation_generator', 100],
          ];
          for (const [stg, _] of stages) {
            setPhase(stg);
            // Animate progress bar filling
            for (let p = 0; p <= 90; p += 15) {
              setProgress(p);
              await new Promise(r => setTimeout(r, 80));
            }
          }
        };

        // Run backend call and UI animation in parallel
        const [result] = await Promise.all([
          api.transcribeAudio(file),
          simulateStages(),
        ]);

        const transcribedNotes: DetectedNote[] = result.notes.map(n => ({
          time: n.time,
          note: n.note,
          frequency: n.frequency,
          duration: n.duration,
          amplitude: n.amplitude,
        }));

        setNotes(transcribedNotes);
        setBpm(result.bpm);
        setMidiB64(result.midi_base64 ?? "");
        setEngine('basic_pitch');
        setPhase('complete');
        toast.success(`Transcribed ${result.note_count} notes via Spotify Basic Pitch!`, { duration: 4000 });
        return;
      } catch (backendErr: any) {
        console.warn("Backend Basic Pitch failed, falling back to browser pipeline:", backendErr);
        toast.warning("Server unavailable — using browser audio engine.", { duration: 3000 });
      }

      // ── Strategy 2: Browser Fallback ──────────────────────────────────────
      const fallbackResult = await processFallback(file, (p, val) => {
        setPhase(p);
        setProgress(val);
      });

      if (fallbackResult.notes.length === 0) {
        setError("No musical notes detected. Try a clearer recording with a single instrument.");
        setPhase('idle');
        return;
      }

      setNotes(fallbackResult.notes);
      setBpm(fallbackResult.bpm);
      setEngine('fallback');
      setPhase('complete');
    } catch (err) {
      setError("Failed to process audio. Please try a different file format.");
      setPhase('idle');
      console.error(err);
    }
  }, [file, reset]);

  // ── Downloads ─────────────────────────────────────────────────────────────

  const handleDownloadMIDI = useCallback(() => {
    if (!file) return;
    if (midiB64) {
      const url = midiB64ToObjectUrl(midiB64);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${file.name.replace(/\.[^/.]+$/, "")}_basic_pitch.mid`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("MIDI file downloaded!");
    } else {
      toast.info("MIDI export requires backend transcription. Backend unavailable in this session.");
    }
  }, [midiB64, file]);

  const handleDownloadPDF = useCallback(() => {
    if (notes.length > 0 && file) {
      downloadSongPDF(file.name.replace(/\.[^/.]+$/, ""), "Unknown", notes);
    }
  }, [notes, file]);

  const handleSaveToLibrary = useCallback(async () => {
    if (notes.length === 0 || !file) return;
    setSaving(true);
    try {
      await api.createSong({
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown",
        instrument: "Transcription",
        mood,
        notes: notes.map(n => ({ note: n.note, time: n.time })),
      });
      toast.success("Saved to your library!");
    } catch (err) {
      toast.error("Failed to save to library.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [notes, file, mood]);

  // ── Sub-renders ───────────────────────────────────────────────────────────

  const renderStepper = () => {
    if (phase === 'idle' || phase === 'complete') return null;

    return (
      <div className="bg-card/70 backdrop-blur-md border border-border rounded-3xl p-6 mb-6 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg uppercase tracking-widest text-primary">Processing Pipeline</h3>
          <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/30 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Server size={11} /> Backend AI
          </span>
        </div>

        <div className="flex flex-col gap-5">
          {PHASES.map((p, index) => {
            const isPast = phaseIndex > index;
            const isCurrent = phase === p.id;
            const Icon = p.icon;

            return (
              <div
                key={p.id}
                className={`flex items-center gap-4 transition-all duration-500 ${
                  isCurrent ? 'opacity-100 scale-[1.02]' : isPast ? 'opacity-60' : 'opacity-25'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-500 flex-shrink-0 ${
                    isPast
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30'
                      : isCurrent
                      ? 'border-primary text-primary shadow-[0_0_20px_rgba(var(--primary),0.4)]'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {isPast ? <CheckCircle2 size={20} /> : <Icon size={20} className={isCurrent ? "animate-pulse" : ""} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-bold text-sm ${isCurrent ? 'text-primary' : ''}`}>{p.label}</p>
                    {isCurrent && <span className="text-xs text-muted-foreground font-medium">{progress}%</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  {isCurrent && (
                    <div className="w-full bg-secondary rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPianoRoll = () => {
    if (notes.length === 0) return null;

    const maxTime = Math.max(...notes.map(n => n.time + n.duration));
    const minTime = Math.min(...notes.map(n => n.time));
    const timeSpan = maxTime - minTime || 1;

    // Get unique notes and their MIDI numbers for layout
    const getNoteY = (noteName: string): number => {
      const name = noteName.replace(/\d/g, "");
      const octave = parseInt(noteName.replace(/\D/g, "")) || 4;
      const semitone = NOTE_NAMES.indexOf(name);
      const midi = (octave + 1) * 12 + semitone;
      return midi;
    };
    const allMidi = notes.map(n => getNoteY(n.note));
    const minMidi = Math.min(...allMidi);
    const maxMidi = Math.max(...allMidi);
    const midiRange = Math.max(maxMidi - minMidi, 1);

    return (
      <div className="bg-secondary/30 border border-primary/20 rounded-2xl p-4 overflow-hidden relative mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-primary font-extrabold text-xs uppercase tracking-widest">Piano Roll Preview</span>
            <span className="text-muted-foreground text-xs font-semibold ml-2">· {bpm} BPM</span>
          </div>
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold">
            {notes.length} notes
          </span>
        </div>

        <div className="relative w-full overflow-x-auto h-40">
          <div className="relative h-full" style={{ width: `${Math.max(100, timeSpan * 25)}%`, minWidth: '100%' }}>
            {/* Measure lines */}
            {Array.from({ length: Math.ceil(timeSpan) }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-border/30"
                style={{ left: `${(i / timeSpan) * 100}%` }}
              />
            ))}

            {/* Note blocks */}
            {notes.slice(0, 500).map((n, i) => {
              const left = ((n.time - minTime) / timeSpan) * 100;
              const width = (n.duration / timeSpan) * 100;
              const midiVal = getNoteY(n.note);
              const bottom = ((midiVal - minMidi) / midiRange) * 85;
              const isSharp = n.note.includes('#');

              return (
                <div
                  key={i}
                  className={`absolute rounded-sm transition-transform cursor-pointer hover:scale-110 ${
                    isSharp
                      ? 'bg-primary/80 shadow-[0_0_6px_rgba(var(--primary),0.6)]'
                      : 'bg-primary shadow-[0_0_10px_rgba(var(--primary),0.4)]'
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(0.4, width)}%`,
                    bottom: `${bottom}%`,
                    height: '9%',
                    opacity: 0.85 + (n.amplitude ?? 0) * 0.15,
                  }}
                  title={`${n.note} @ ${n.time.toFixed(2)}s`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 pb-28 md:p-10 md:pb-32 bg-background/85 backdrop-blur-[1px]">

      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="bg-secondary rounded-full p-3 hover:bg-muted transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold italic tracking-tight">Transcribe Pipeline</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Powered by Spotify Basic Pitch AI
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5">
          <Zap size={13} className="text-primary" />
          <span className="text-xs font-bold text-primary">AI Transcription</span>
        </div>
      </header>

      {/* Upload area */}
      {phase === 'idle' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/60 hover:bg-primary/10 transition-all duration-300 mb-6 group shadow-lg"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mid,.midi"
            className="hidden"
            onChange={handleFileSelect}
          />
          {file ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileMusic size={32} className="text-primary" />
              </div>
              <p className="font-bold text-lg text-center break-all">{file.name}</p>
              <p className="text-muted-foreground text-sm font-medium">
                {(file.size / (1024 * 1024)).toFixed(2)} MB · Click to change
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                <Upload size={36} />
              </div>
              <div className="text-center">
                <p className="text-foreground font-bold text-lg">Tap to upload a track</p>
                <p className="text-muted-foreground/80 text-sm font-semibold mt-1">MP3, WAV, FLAC, OGG, M4A, MIDI</p>
              </div>
              <div className="flex items-center gap-2 mt-2 bg-card border border-border rounded-2xl px-4 py-2">
                <Server size={14} className="text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Processed by <span className="text-primary">Spotify Basic Pitch</span> on server
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Extract button */}
      {file && phase === 'idle' && (
        <div className="flex gap-3 mb-6">
          <Button
            onClick={handleExtract}
            className="flex-1 rounded-full h-14 text-lg font-extrabold gap-3 shadow-xl hover:shadow-primary/20 transition-all"
          >
            <Music size={22} />
            Start AI Pipeline
          </Button>
          <Button
            onClick={clearSelection}
            variant="outline"
            className="rounded-full h-14 px-5 font-bold"
          >
            <RotateCcw size={18} />
          </Button>
        </div>
      )}

      {/* Pipeline Stepper */}
      {renderStepper()}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive font-semibold rounded-2xl p-5 text-sm mb-6 animate-in fade-in">
          {error}
        </div>
      )}

      {/* Results */}
      {phase === 'complete' && notes.length > 0 && (
        <div className="space-y-5 animate-in slide-in-from-bottom-8 duration-700">

          {/* Summary card */}
          <div className="bg-card/70 backdrop-blur-md border border-border p-5 rounded-3xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <p className="font-extrabold text-2xl text-primary">
                  {notes.length} <span className="text-foreground text-lg font-bold">notes detected</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground uppercase font-black tracking-wider">Mood:</span>
                  <select
                    value={mood}
                    onChange={e => setMood(e.target.value)}
                    className="bg-secondary text-sm font-bold rounded-xl px-3 py-1 outline-none border border-transparent focus:border-primary transition-colors capitalize cursor-pointer"
                  >
                    {["calm", "night", "soft", "mind", "focus"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <span className={`text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-wide border ${
                    engine === 'basic_pitch'
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}>
                    {engine === 'basic_pitch' ? '✨ Spotify Basic Pitch' : '⚡ Browser Fallback'}
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">{bpm} BPM</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSaveToLibrary}
                  variant="default"
                  className="rounded-full gap-2 px-5 font-bold"
                  disabled={saving}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  variant="secondary"
                  className="rounded-full gap-2 font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <FileText size={16} />
                  PDF
                </Button>
                <Button
                  onClick={handleDownloadMIDI}
                  variant="secondary"
                  className={`rounded-full gap-2 font-bold hover:bg-primary hover:text-primary-foreground transition-colors ${!midiB64 ? 'opacity-60' : ''}`}
                >
                  <Download size={16} />
                  MIDI
                </Button>
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  className="rounded-full gap-2 font-bold"
                >
                  <RotateCcw size={16} />
                  New File
                </Button>
              </div>
            </div>
          </div>

          {/* Piano Roll */}
          {renderPianoRoll()}

          {/* Note tags */}
          <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto bg-secondary/30 rounded-3xl p-5 border border-border/50">
            {notes.slice(0, 200).map((n, i) => (
              <span
                key={i}
                className="bg-background border border-primary/20 text-foreground font-mono text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm hover:border-primary/50 transition-colors"
                title={`${n.note} · ${n.time.toFixed(2)}s · ${n.duration.toFixed(2)}s`}
              >
                {n.note}
              </span>
            ))}
            {notes.length > 200 && (
              <span className="text-muted-foreground font-bold text-xs py-1.5 px-2">
                +{notes.length - 200} more
              </span>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
