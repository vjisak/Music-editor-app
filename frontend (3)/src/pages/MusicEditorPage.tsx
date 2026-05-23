import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  FolderOpen,
  Play,
  Pause,
  Scissors,
  Crop,
  Waves,
  Undo2,
  Download,
  ZoomIn,
  ZoomOut,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

type TimeRange = { start: number; end: number };
type AiTask = "denoise" | "dehum" | "voice" | "music" | "brighten" | "warm" | "compress";
type AiPlan = { label: string; tasks: AiTask[] };
type NoiseProfile = { floor: number; low: number; mid: number; high: number; trained: boolean };
type SongSection = {
  id: number;
  name: string;
  bars: number;
  intensity: number;
  color: string;
};
type SongBlueprint = {
  title: string;
  vibe: string;
  bpm: number;
  key: string;
  sections: SongSection[];
};
type StemMix = { vocals: number; drums: number; bass: number; music: number };
type MasterPreset = "Suno Pop" | "Cinematic Wide" | "Lo-Fi Chill" | "Vocal Focus";
type TrimSilenceSettings = {
  thresholdDb: number;
  minSilenceSec: number;
  targetSilenceSec: number;
  keepLeadingTrailing: boolean;
};
type EqBand = { frequency: number; gain: number; q: number };
type EqSettings = {
  low: EqBand;
  mid: EqBand;
  high: EqBand;
};
type ProjectSnapshot = {
  version: 1;
  savedAt: string;
  fileName: string;
  aiPrompt: string;
  aiStrength: number;
  songPrompt: string;
  songLyrics: string;
  songGenre: string;
  songMood: string;
  songBpm: number;
  songKey: string;
  masterPreset: MasterPreset;
  stemMix: StemMix;
  trimSettings: TrimSilenceSettings;
  eqSettings: EqSettings;
  comfortProfile?: ComfortProfile;
};
type QualityReport = {
  peakDb: number;
  rmsDb: number;
  crestDb: number;
  clippingSamples: number;
  noiseFloorDb: number;
  score: number;
};
type ListeningDevice = "Headphones" | "Earbuds" | "Speakers";
type TastePreset = "Balanced" | "Warm Soft" | "Low Bass Focus" | "Ultra Gentle";
type ComfortProfile = {
  device: ListeningDevice;
  taste: TastePreset;
  fatigueLevel: number;
  bassRelief: number;
  beatSoftness: number;
  trebleSoftness: number;
  loudnessGuard: number;
  headacheMode: boolean;
  autoLearn: boolean;
};
type ComfortTrainerFeedback = "better" | "worse";
type ComfortModelEntry = {
  key: string;
  samples: number;
  fatigueLevel: number;
  bassRelief: number;
  beatSoftness: number;
  trebleSoftness: number;
  loudnessGuard: number;
  confidence: number;
  updatedAt: string;
};
type ComfortModelState = {
  version: 1;
  entries: Record<string, ComfortModelEntry>;
};
type AiTrainerPromptEntry = {
  key: string;
  taskWeights: Record<AiTask, number>;
  preferredStrength: number;
  samples: number;
  confidence: number;
  updatedAt: string;
};
type AiTrainerModel = {
  version: 1;
  globalWeights: Record<AiTask, number>;
  prompts: Record<string, AiTrainerPromptEntry>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const PROJECT_SNAPSHOT_KEY = "musicapp.editor.snapshot.v1";
const COMFORT_PROFILE_KEY = "musicapp.editor.comfort.v1";
const COMFORT_MODEL_KEY = "musicapp.editor.comfort-model.v1";
const AI_TRAINER_MODEL_KEY = "musicapp.editor.ai-trainer.v1";

const SECTION_COLORS = [
  "from-cyan-400/75 to-emerald-400/65",
  "from-fuchsia-400/70 to-indigo-400/60",
  "from-amber-300/75 to-rose-400/60",
  "from-sky-400/75 to-teal-400/65",
];

function hashText(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildSongBlueprint(
  prompt: string,
  mood: string,
  genre: string,
  targetBpm: number,
  targetKey: string,
) {
  const planSeed = hashText(`${prompt}-${mood}-${genre}-${targetBpm}-${targetKey}`);
  const random = seededRandom(planSeed);
  const sectionNames = ["Intro", "Verse", "Pre", "Chorus", "Bridge", "Drop", "Outro"];
  const sectionCount = 4 + Math.floor(random() * 3);
  const sections: SongSection[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const bars = 4 + Math.floor(random() * 5) * 2;
    const intensity = clamp(0.35 + random() * 0.65, 0.1, 1);
    sections.push({
      id: i + 1,
      name: sectionNames[i] || `Part ${i + 1}`,
      bars,
      intensity,
      color: SECTION_COLORS[i % SECTION_COLORS.length],
    });
  }

  const ideaTitles = ["Neon Drift", "Echo Bloom", "City Halo", "Silver Pulse", "Friction Sky"];
  return {
    title: ideaTitles[Math.floor(random() * ideaTitles.length)],
    vibe: `${genre} · ${mood}`,
    bpm: targetBpm,
    key: targetKey,
    sections,
  } satisfies SongBlueprint;
}

function getAudioContext(): AudioContext {
  const ExistingAudioContext = window.AudioContext || (window as any).webkitAudioContext;
  return new ExistingAudioContext();
}

function cloneBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  fromSeconds = 0,
  toSeconds = buffer.duration,
): AudioBuffer {
  const start = clamp(fromSeconds, 0, buffer.duration);
  const end = clamp(toSeconds, start, buffer.duration);
  const startSample = Math.floor(start * buffer.sampleRate);
  const endSample = Math.floor(end * buffer.sampleRate);
  const frameCount = Math.max(1, endSample - startSample);
  const result = ctx.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel).subarray(startSample, endSample);
    result.getChannelData(channel).set(source);
  }
  return result;
}

function cutRangeFromBuffer(ctx: AudioContext, buffer: AudioBuffer, range: TimeRange): AudioBuffer {
  const start = clamp(Math.min(range.start, range.end), 0, buffer.duration);
  const end = clamp(Math.max(range.start, range.end), 0, buffer.duration);
  if (end - start <= 0.001) return buffer;

  const cutStartSample = Math.floor(start * buffer.sampleRate);
  const cutEndSample = Math.floor(end * buffer.sampleRate);
  const removedSamples = cutEndSample - cutStartSample;
  const totalFrames = Math.max(1, buffer.length - removedSamples);
  const result = ctx.createBuffer(buffer.numberOfChannels, totalFrames, buffer.sampleRate);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const src = buffer.getChannelData(channel);
    const dst = result.getChannelData(channel);
    dst.set(src.subarray(0, cutStartSample), 0);
    dst.set(src.subarray(cutEndSample), cutStartSample);
  }

  return result;
}

function normalizeAudioBuffer(buffer: AudioBuffer) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  if (peak <= 0.0001) return;
  const gain = 0.98 / peak;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}

function applyFade(buffer: AudioBuffer, range: TimeRange, type: "in" | "out") {
  const start = clamp(Math.min(range.start, range.end), 0, buffer.duration);
  const end = clamp(Math.max(range.start, range.end), 0, buffer.duration);
  const startSample = Math.floor(start * buffer.sampleRate);
  const endSample = Math.floor(end * buffer.sampleRate);
  const span = Math.max(1, endSample - startSample);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let sample = startSample; sample < endSample; sample++) {
      const position = (sample - startSample) / span;
      const amount = type === "in" ? position : 1 - position;
      data[sample] *= amount;
    }
  }
}

function onePoleHighPass(data: Float32Array, cutoffHz: number, sampleRate: number) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  let prevInput = data[0] || 0;
  let prevOutput = data[0] || 0;
  for (let i = 1; i < data.length; i++) {
    const input = data[i];
    const output = alpha * (prevOutput + input - prevInput);
    data[i] = output;
    prevInput = input;
    prevOutput = output;
  }
}

function onePoleLowPass(data: Float32Array, cutoffHz: number, sampleRate: number) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  let prev = data[0] || 0;
  for (let i = 1; i < data.length; i++) {
    prev = prev + alpha * (data[i] - prev);
    data[i] = prev;
  }
}

function estimateNoiseFloor(data: Float32Array) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 3) {
    const value = Math.abs(data[i]);
    if (value < 0.035) {
      sum += value;
      count++;
    }
  }
  return count > 0 ? sum / count : 0.003;
}

function averageAbs(data: Float32Array) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
  return data.length > 0 ? sum / data.length : 0;
}

function extractSegment(
  data: Float32Array,
  sampleRate: number,
  range?: TimeRange | null,
): Float32Array {
  if (!range) return data;
  const start = clamp(Math.floor(Math.min(range.start, range.end) * sampleRate), 0, data.length - 1);
  const end = clamp(Math.floor(Math.max(range.start, range.end) * sampleRate), start + 1, data.length);
  return data.slice(start, end);
}

function buildNoiseProfile(buffer: AudioBuffer, range?: TimeRange | null): NoiseProfile {
  const channel = buffer.getChannelData(0);
  const segment = extractSegment(channel, buffer.sampleRate, range);
  const low = segment.slice();
  const high = segment.slice();
  onePoleLowPass(low, 260, buffer.sampleRate);
  onePoleHighPass(high, 2200, buffer.sampleRate);
  const total = averageAbs(segment);
  const lowE = averageAbs(low);
  const highE = averageAbs(high);
  const midE = Math.max(0, total - lowE * 0.55 - highE * 0.45);
  return {
    floor: estimateNoiseFloor(segment),
    low: lowE,
    mid: midE,
    high: highE,
    trained: true,
  };
}

function softCompressor(data: Float32Array, threshold: number, ratio: number) {
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const amplitude = Math.abs(value);
    if (amplitude <= threshold) continue;
    const excess = amplitude - threshold;
    const compressed = threshold + excess / ratio;
    data[i] = Math.sign(value) * compressed;
  }
}

function addPresence(data: Float32Array, sampleRate: number, amount: number) {
  if (amount <= 0) return;
  const high = data.slice();
  onePoleHighPass(high, 2600, sampleRate);
  for (let i = 0; i < data.length; i++) {
    data[i] = clamp(data[i] + high[i] * amount, -1, 1);
  }
}

function addWarmth(data: Float32Array, sampleRate: number, amount: number) {
  if (amount <= 0) return;
  const low = data.slice();
  onePoleLowPass(low, 240, sampleRate);
  for (let i = 0; i < data.length; i++) {
    data[i] = clamp(data[i] + low[i] * amount, -1, 1);
  }
}

function applyStemMixer(buffer: AudioBuffer, mix: StemMix) {
  const vocalLevel = clamp(mix.vocals, 0.4, 1.8);
  const drumLevel = clamp(mix.drums, 0.4, 1.8);
  const bassLevel = clamp(mix.bass, 0.4, 1.8);
  const musicLevel = clamp(mix.music, 0.4, 1.8);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel);
    const low = source.slice();
    const high = source.slice();
    const body = source.slice();

    onePoleLowPass(low, 180, buffer.sampleRate);
    onePoleHighPass(high, 2900, buffer.sampleRate);
    onePoleHighPass(body, 220, buffer.sampleRate);
    onePoleLowPass(body, 2600, buffer.sampleRate);

    for (let i = 0; i < source.length; i++) {
      const bassLayer = low[i] * bassLevel * 0.95;
      const vocalLayer = body[i] * vocalLevel * 0.88;
      const drumLayer = high[i] * drumLevel * 0.82;
      const musicLayer = source[i] * musicLevel * 0.6;
      source[i] = clamp((bassLayer + vocalLayer + drumLayer + musicLayer) * 0.55, -1, 1);
    }
  }
}

function getMasterPresetPlan(preset: MasterPreset): { plan: AiPlan; strength: number; stemMix: StemMix } {
  if (preset === "Cinematic Wide") {
    return {
      plan: { label: "AI Plan: music, warm, dehum, compress", tasks: ["music", "warm", "dehum", "compress"] },
      strength: 2.4,
      stemMix: { vocals: 0.95, drums: 0.9, bass: 1.2, music: 1.1 },
    };
  }
  if (preset === "Lo-Fi Chill") {
    return {
      plan: { label: "AI Plan: denoise, warm, music", tasks: ["denoise", "warm", "music"] },
      strength: 1.7,
      stemMix: { vocals: 0.85, drums: 0.8, bass: 1.12, music: 1.06 },
    };
  }
  if (preset === "Vocal Focus") {
    return {
      plan: { label: "AI Plan: voice, denoise, brighten, compress", tasks: ["voice", "denoise", "brighten", "compress"] },
      strength: 2.3,
      stemMix: { vocals: 1.3, drums: 0.8, bass: 0.85, music: 0.95 },
    };
  }
  return {
    plan: { label: "AI Plan: music, brighten, compress", tasks: ["music", "brighten", "compress"] },
    strength: 2,
    stemMix: { vocals: 1.05, drums: 1.12, bass: 1.02, music: 1 },
  };
}

function applyAdvancedAiPlan(
  buffer: AudioBuffer,
  plan: AiPlan,
  strength: number,
  learnedProfile?: NoiseProfile | null,
) {
  const intensity = clamp(strength, 1, 3);
  const intensityScale = intensity / 2;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    const noiseFloor = learnedProfile?.floor ?? estimateNoiseFloor(data);

    if (plan.tasks.includes("dehum")) {
      onePoleHighPass(data, 70 + 20 * intensityScale, buffer.sampleRate);
    }

    if (plan.tasks.includes("denoise")) {
      onePoleLowPass(data, 12000 - 800 * intensityScale, buffer.sampleRate);
      const threshold = noiseFloor * (2.8 + 0.7 * intensityScale) + 0.0018;
      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const amplitude = Math.abs(value);
        if (amplitude < threshold) {
          data[i] = value * (0.12 + 0.1 * intensityScale);
        } else if (amplitude < threshold * 1.8) {
          data[i] = value * (0.42 + 0.16 * intensityScale);
        }
      }
    }

    if (plan.tasks.includes("voice")) {
      onePoleHighPass(data, 95 + 25 * intensityScale, buffer.sampleRate);
      onePoleLowPass(data, 8800 - 600 * intensityScale, buffer.sampleRate);
      softCompressor(data, 0.32, 2.8 + 0.7 * intensityScale);
    }

    if (plan.tasks.includes("music")) {
      onePoleHighPass(data, 40, buffer.sampleRate);
      onePoleLowPass(data, 14000, buffer.sampleRate);
      softCompressor(data, 0.42, 2.1 + 0.5 * intensityScale);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.tanh(data[i] * (1.08 + 0.09 * intensityScale));
      }
    }

    if (plan.tasks.includes("brighten")) addPresence(data, buffer.sampleRate, 0.09 * intensityScale);
    if (plan.tasks.includes("warm")) addWarmth(data, buffer.sampleRate, 0.08 * intensityScale);
    if (plan.tasks.includes("compress")) softCompressor(data, 0.36, 3 + intensityScale);
  }

  normalizeAudioBuffer(buffer);
}

function parseAiPrompt(prompt: string): AiPlan {
  const text = prompt.toLowerCase();
  const tasks = new Set<AiTask>();
  const cueResults: Array<{ task: AiTask; positive: RegExp; negative: RegExp }> = [
    {
      task: "denoise",
      positive: /\b(hiss|noise|clean|denoise|reduce noise|background noise)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(denoise|noise|hiss|noise reduction|clean)\b/,
    },
    {
      task: "dehum",
      positive: /\b(hum|rumble|dehum|buzz)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(dehum|hum|rumble|buzz)\b/,
    },
    {
      task: "voice",
      positive: /\b(voice|vocal|speech|podcast|mic|dialog)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(voice|vocal|speech|podcast|mic|dialog)\b/,
    },
    {
      task: "music",
      positive: /\b(music|song|instrument|track|master)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(music|song|instrument|track|master)\b/,
    },
    {
      task: "brighten",
      positive: /\b(bright|clarity|crisp|presence|air)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(bright|clarity|crisp|presence|air)\b/,
    },
    {
      task: "warm",
      positive: /\b(warm|body|bass|thick)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(warm|body|bass|thick)\b/,
    },
    {
      task: "compress",
      positive: /\b(compress|loud|punch|glue)\b/,
      negative: /\b(don'?t|do not|dont|without|skip|avoid|no)\b[\w\s]{0,22}\b(compress|loud|punch|glue)\b/,
    },
  ];

  let hasCue = false;
  let hasNegativeCue = false;
  for (const cue of cueResults) {
    const positive = cue.positive.test(text);
    const negative = cue.negative.test(text);
    if (positive || negative) hasCue = true;
    if (negative) hasNegativeCue = true;
    if (positive && !negative) tasks.add(cue.task);
  }

  if (tasks.size === 0 && !(hasCue && hasNegativeCue)) tasks.add("music");
  if (tasks.size === 0) return { tasks: [], label: "AI Plan: no processing (as requested)" };
  const labels = Array.from(tasks).map((task) => task.replace("_", " "));
  return { tasks: Array.from(tasks), label: `AI Plan: ${labels.join(", ")}` };
}

const ALL_AI_TASKS: AiTask[] = ["denoise", "dehum", "voice", "music", "brighten", "warm", "compress"];

function createNeutralTaskWeights(): Record<AiTask, number> {
  return {
    denoise: 1,
    dehum: 1,
    voice: 1,
    music: 1,
    brighten: 1,
    warm: 1,
    compress: 1,
  };
}

function createEmptyAiTrainerModel(): AiTrainerModel {
  return {
    version: 1,
    globalWeights: createNeutralTaskWeights(),
    prompts: {},
  };
}

function normalizePromptKey(prompt: string) {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function inferAiPlanWithModel(
  prompt: string,
  basePlan: AiPlan,
  currentStrength: number,
  model: AiTrainerModel,
) {
  const key = normalizePromptKey(prompt);
  const learned = model.prompts[key];
  const chosen: AiTask[] = [];

  for (const task of ALL_AI_TASKS) {
    const baseScore = basePlan.tasks.includes(task) ? 1 : 0;
    const globalBias = (model.globalWeights[task] ?? 1) - 1;
    const promptBias = (learned?.taskWeights?.[task] ?? 1) - 1;
    const score = baseScore * 0.72 + globalBias * 0.24 + promptBias * 0.42;
    if (score > 0.46) chosen.push(task);
  }

  const fallbackTasks = chosen.length > 0 ? chosen : basePlan.tasks;
  const inferredPlan: AiPlan =
    fallbackTasks.length > 0
      ? { tasks: fallbackTasks, label: `AI Plan: ${fallbackTasks.join(", ")}` }
      : { tasks: [], label: "AI Plan: no processing (as requested)" };

  const blend = learned ? clamp(0.1 + learned.confidence * 0.45, 0.1, 0.55) : 0;
  const inferredStrength = clamp(
    Math.round((currentStrength * (1 - blend) + (learned?.preferredStrength ?? currentStrength) * blend) * 10) / 10,
    1,
    3,
  );

  return { plan: inferredPlan, strength: inferredStrength, key, learned };
}

function trainAiModel(
  model: AiTrainerModel,
  prompt: string,
  plan: AiPlan,
  usedStrength: number,
  feedback: "better" | "worse",
): AiTrainerModel {
  const key = normalizePromptKey(prompt);
  if (!key) return model;

  const existing =
    model.prompts[key] ||
    ({
      key,
      taskWeights: createNeutralTaskWeights(),
      preferredStrength: usedStrength,
      samples: 0,
      confidence: 0,
      updatedAt: new Date().toISOString(),
    } satisfies AiTrainerPromptEntry);

  const rate = feedback === "better" ? 0.2 : 0.09;
  const updatedTaskWeights = { ...existing.taskWeights };
  const updatedGlobal = { ...model.globalWeights };

  for (const task of ALL_AI_TASKS) {
    const included = plan.tasks.includes(task);
    const localTarget =
      feedback === "better"
        ? included
          ? 1.35
          : 0.95
        : included
          ? 0.75
          : 1.08;
    const globalTarget =
      feedback === "better"
        ? included
          ? 1.14
          : 0.98
        : included
          ? 0.9
          : 1.04;

    updatedTaskWeights[task] = clamp(updatedTaskWeights[task] * (1 - rate) + localTarget * rate, 0.35, 2.2);
    updatedGlobal[task] = clamp(updatedGlobal[task] * (1 - rate * 0.5) + globalTarget * rate * 0.5, 0.5, 1.8);
  }

  const strengthTarget = feedback === "better" ? usedStrength : clamp(usedStrength - 0.2, 1, 3);
  const nextEntry: AiTrainerPromptEntry = {
    ...existing,
    taskWeights: updatedTaskWeights,
    preferredStrength: clamp(existing.preferredStrength * (1 - rate) + strengthTarget * rate, 1, 3),
    samples: existing.samples + 1,
    confidence: clamp(existing.confidence + (feedback === "better" ? 0.07 : 0.03), 0, 1),
    updatedAt: new Date().toISOString(),
  };

  return {
    version: 1,
    globalWeights: updatedGlobal,
    prompts: {
      ...model.prompts,
      [key]: nextEntry,
    },
  };
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  const channels = Array.from({ length: numChannels }, (_, index) => buffer.getChannelData(index));
  for (let sample = 0; sample < buffer.length; sample++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const value = clamp(channels[channel][sample], -1, 1);
      const int16 = value < 0 ? value * 0x8000 : value * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function dbToLinear(db: number) {
  return Math.pow(10, db / 20);
}

function linearToDb(linear: number) {
  return 20 * Math.log10(Math.max(linear, 1e-8));
}

function buildQualityReport(buffer: AudioBuffer): QualityReport {
  const channel = buffer.getChannelData(0);
  let peak = 0;
  let squared = 0;
  let clippingSamples = 0;
  for (let i = 0; i < channel.length; i++) {
    const value = Math.abs(channel[i]);
    peak = Math.max(peak, value);
    squared += channel[i] * channel[i];
    if (value >= 0.995) clippingSamples++;
  }
  const rms = Math.sqrt(squared / Math.max(1, channel.length));
  const noiseFloor = estimateNoiseFloor(channel);
  const peakDb = linearToDb(peak);
  const rmsDb = linearToDb(rms);
  const crestDb = peakDb - rmsDb;
  const noiseFloorDb = linearToDb(noiseFloor);

  let score = 100;
  if (peakDb > -0.1) score -= 18;
  if (peakDb < -2.5) score -= 8;
  if (rmsDb < -20) score -= 10;
  if (rmsDb > -8.5) score -= 12;
  if (crestDb < 5) score -= 12;
  if (crestDb > 16) score -= 8;
  if (clippingSamples > 0) score -= Math.min(22, clippingSamples * 0.01);
  if (noiseFloorDb > -32) score -= 10;
  score = clamp(Math.round(score), 0, 100);

  return { peakDb, rmsDb, crestDb, clippingSamples, noiseFloorDb, score };
}

function buildComfortPreset(taste: TastePreset, device: ListeningDevice): ComfortProfile {
  const baseByTaste: Record<TastePreset, Omit<ComfortProfile, "device" | "taste" | "autoLearn">> = {
    Balanced: {
      fatigueLevel: 0.35,
      bassRelief: 0.28,
      beatSoftness: 0.32,
      trebleSoftness: 0.3,
      loudnessGuard: 0.3,
      headacheMode: false,
    },
    "Warm Soft": {
      fatigueLevel: 0.45,
      bassRelief: 0.36,
      beatSoftness: 0.4,
      trebleSoftness: 0.46,
      loudnessGuard: 0.4,
      headacheMode: false,
    },
    "Low Bass Focus": {
      fatigueLevel: 0.5,
      bassRelief: 0.62,
      beatSoftness: 0.48,
      trebleSoftness: 0.33,
      loudnessGuard: 0.44,
      headacheMode: false,
    },
    "Ultra Gentle": {
      fatigueLevel: 0.68,
      bassRelief: 0.66,
      beatSoftness: 0.64,
      trebleSoftness: 0.62,
      loudnessGuard: 0.58,
      headacheMode: true,
    },
  };

  const profile = baseByTaste[taste];
  const deviceLift = device === "Speakers" ? -0.08 : device === "Earbuds" ? 0.05 : 0.1;
  return {
    device,
    taste,
    fatigueLevel: clamp(profile.fatigueLevel + deviceLift * 0.5, 0, 1),
    bassRelief: clamp(profile.bassRelief + deviceLift, 0, 1),
    beatSoftness: clamp(profile.beatSoftness + deviceLift * 0.65, 0, 1),
    trebleSoftness: clamp(profile.trebleSoftness + deviceLift * 0.4, 0, 1),
    loudnessGuard: clamp(profile.loudnessGuard + deviceLift * 0.65, 0, 1),
    headacheMode: profile.headacheMode,
    autoLearn: true,
  };
}

function applyComfortPartner(ctx: AudioContext, buffer: AudioBuffer, comfort: ComfortProfile) {
  const output = cloneBuffer(ctx, buffer);
  const fatigueBoost = comfort.headacheMode ? 0.22 : 0;
  const bassRelief = clamp(comfort.bassRelief + fatigueBoost * 0.55, 0, 1);
  const trebleRelief = clamp(comfort.trebleSoftness + fatigueBoost * 0.4, 0, 1);
  const beatSoftness = clamp(comfort.beatSoftness + fatigueBoost * 0.6, 0, 1);
  const loudnessGuard = clamp(comfort.loudnessGuard + fatigueBoost * 0.45 + comfort.fatigueLevel * 0.2, 0, 1);

  for (let channel = 0; channel < output.numberOfChannels; channel++) {
    const data = output.getChannelData(channel);
    const low = data.slice();
    const high = data.slice();
    const body = data.slice();

    onePoleLowPass(low, 180, output.sampleRate);
    onePoleHighPass(high, 2400, output.sampleRate);
    onePoleHighPass(body, 220, output.sampleRate);
    onePoleLowPass(body, 4200, output.sampleRate);

    softCompressor(data, 0.48 - beatSoftness * 0.2, 2.2 + beatSoftness * 3.4);

    const deviceWideProtect = comfort.device === "Headphones" || comfort.device === "Earbuds" ? 0.88 : 0.95;
    for (let i = 0; i < data.length; i++) {
      const reducedBass = low[i] * bassRelief * 0.58;
      const reducedTreble = high[i] * trebleRelief * 0.52;
      let next = data[i] - reducedBass - reducedTreble;
      next = next * (1 - loudnessGuard * 0.27) + body[i] * 0.06;
      data[i] = clamp(next * deviceWideProtect, -1, 1);
    }
  }

  if (output.numberOfChannels >= 2 && (comfort.device === "Headphones" || comfort.device === "Earbuds")) {
    const left = output.getChannelData(0);
    const right = output.getChannelData(1);
    const crossfeed = 0.04 + comfort.fatigueLevel * 0.08 + (comfort.headacheMode ? 0.04 : 0);
    for (let i = 0; i < output.length; i++) {
      const l = left[i];
      const r = right[i];
      left[i] = clamp(l * (1 - crossfeed) + r * crossfeed, -1, 1);
      right[i] = clamp(r * (1 - crossfeed) + l * crossfeed, -1, 1);
    }
  }

  normalizeAudioBuffer(output);
  const targetPeak = 0.82 - loudnessGuard * 0.18;
  let peak = 0;
  for (let channel = 0; channel < output.numberOfChannels; channel++) {
    const data = output.getChannelData(channel);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak > targetPeak) {
    const gain = targetPeak / Math.max(peak, 1e-6);
    for (let channel = 0; channel < output.numberOfChannels; channel++) {
      const data = output.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] *= gain;
    }
  }

  return output;
}

function getComfortModelKey(profile: ComfortProfile) {
  return `${profile.device}|${profile.taste}|${profile.headacheMode ? "headache" : "normal"}`;
}

function createEmptyComfortModel(): ComfortModelState {
  return { version: 1, entries: {} };
}

function trainComfortModel(
  model: ComfortModelState,
  profile: ComfortProfile,
  feedback: ComfortTrainerFeedback,
): ComfortModelState {
  const key = getComfortModelKey(profile);
  const existing = model.entries[key];
  const base: ComfortModelEntry =
    existing || {
      key,
      samples: 0,
      fatigueLevel: profile.fatigueLevel,
      bassRelief: profile.bassRelief,
      beatSoftness: profile.beatSoftness,
      trebleSoftness: profile.trebleSoftness,
      loudnessGuard: profile.loudnessGuard,
      confidence: 0,
      updatedAt: new Date().toISOString(),
    };

  const learnRate = feedback === "better" ? 0.22 : 0.08;
  const direction = feedback === "better" ? 1 : -1;
  const nudge = (value: number) => clamp(value + direction * 0.04, 0, 1);

  const next: ComfortModelEntry = {
    ...base,
    samples: base.samples + 1,
    fatigueLevel: clamp(base.fatigueLevel * (1 - learnRate) + nudge(profile.fatigueLevel) * learnRate, 0, 1),
    bassRelief: clamp(base.bassRelief * (1 - learnRate) + nudge(profile.bassRelief) * learnRate, 0, 1),
    beatSoftness: clamp(base.beatSoftness * (1 - learnRate) + nudge(profile.beatSoftness) * learnRate, 0, 1),
    trebleSoftness: clamp(base.trebleSoftness * (1 - learnRate) + nudge(profile.trebleSoftness) * learnRate, 0, 1),
    loudnessGuard: clamp(base.loudnessGuard * (1 - learnRate) + nudge(profile.loudnessGuard) * learnRate, 0, 1),
    confidence: clamp(base.confidence + (feedback === "better" ? 0.08 : 0.03), 0, 1),
    updatedAt: new Date().toISOString(),
  };

  return {
    version: 1,
    entries: {
      ...model.entries,
      [key]: next,
    },
  };
}

function inferComfortProfileFromModel(
  model: ComfortModelState,
  profile: ComfortProfile,
): ComfortProfile {
  const key = getComfortModelKey(profile);
  const entry = model.entries[key];
  if (!entry) return profile;
  const blend = clamp(0.15 + entry.confidence * 0.55, 0.15, 0.7);
  return {
    ...profile,
    fatigueLevel: clamp(profile.fatigueLevel * (1 - blend) + entry.fatigueLevel * blend, 0, 1),
    bassRelief: clamp(profile.bassRelief * (1 - blend) + entry.bassRelief * blend, 0, 1),
    beatSoftness: clamp(profile.beatSoftness * (1 - blend) + entry.beatSoftness * blend, 0, 1),
    trebleSoftness: clamp(profile.trebleSoftness * (1 - blend) + entry.trebleSoftness * blend, 0, 1),
    loudnessGuard: clamp(profile.loudnessGuard * (1 - blend) + entry.loudnessGuard * blend, 0, 1),
  };
}

function trimSilences(
  ctx: AudioContext,
  buffer: AudioBuffer,
  settings: TrimSilenceSettings,
): AudioBuffer {
  const threshold = dbToLinear(settings.thresholdDb);
  const minSilenceSamples = Math.max(1, Math.floor(settings.minSilenceSec * buffer.sampleRate));
  const targetSilenceSamples = Math.max(0, Math.floor(settings.targetSilenceSec * buffer.sampleRate));
  const detector = buffer.getChannelData(0);
  const segments: Array<{ start: number; end: number; silent: boolean }> = [];

  let index = 0;
  while (index < detector.length) {
    const silent = Math.abs(detector[index]) < threshold;
    const start = index;
    index++;
    while (index < detector.length && (Math.abs(detector[index]) < threshold) === silent) index++;
    const end = index;
    if (!silent || end - start >= minSilenceSamples) {
      segments.push({ start, end, silent });
    } else {
      segments.push({ start, end, silent: false });
    }
  }

  if (segments.length === 0) return buffer;

  let changed = false;
  let outLength = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const isEdge = i === 0 || i === segments.length - 1;
    if (segment.silent) {
      const shouldTrim = !isEdge || !settings.keepLeadingTrailing;
      if (shouldTrim) {
        outLength += targetSilenceSamples;
        changed = changed || targetSilenceSamples !== segment.end - segment.start;
      } else {
        outLength += segment.end - segment.start;
      }
    } else {
      outLength += segment.end - segment.start;
    }
  }

  if (!changed || outLength <= 0) return buffer;

  const output = ctx.createBuffer(buffer.numberOfChannels, outLength, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel);
    const target = output.getChannelData(channel);
    let writeHead = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isEdge = i === 0 || i === segments.length - 1;
      if (segment.silent) {
        const shouldTrim = !isEdge || !settings.keepLeadingTrailing;
        if (shouldTrim) {
          writeHead += targetSilenceSamples;
        } else {
          const chunk = source.subarray(segment.start, segment.end);
          target.set(chunk, writeHead);
          writeHead += chunk.length;
        }
      } else {
        const chunk = source.subarray(segment.start, segment.end);
        target.set(chunk, writeHead);
        writeHead += chunk.length;
      }
    }
  }

  return output;
}

async function applyParametricEq(buffer: AudioBuffer, eq: EqSettings) {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const low = offlineCtx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = eq.low.frequency;
  low.gain.value = eq.low.gain;

  const mid = offlineCtx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = eq.mid.frequency;
  mid.gain.value = eq.mid.gain;
  mid.Q.value = eq.mid.q;

  const high = offlineCtx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = eq.high.frequency;
  high.gain.value = eq.high.gain;

  source.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(offlineCtx.destination);
  source.start(0);
  return offlineCtx.startRendering();
}

function applyParametricEqFallback(ctx: AudioContext, buffer: AudioBuffer, eq: EqSettings) {
  const output = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const sampleRate = buffer.sampleRate;
  const lowGain = dbToLinear(eq.low.gain);
  const midGain = dbToLinear(eq.mid.gain);
  const highGain = dbToLinear(eq.high.gain);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel);
    const low = source.slice();
    const mid = source.slice();
    const high = source.slice();
    const dst = output.getChannelData(channel);

    onePoleLowPass(low, clamp(eq.low.frequency, 40, 500), sampleRate);
    onePoleHighPass(high, clamp(eq.high.frequency, 1800, 16000), sampleRate);

    const midLowCut = clamp(eq.mid.frequency / (1 + eq.mid.q * 0.9), 120, 5000);
    const midHighCut = clamp(eq.mid.frequency * (1 + eq.mid.q * 0.9), midLowCut + 100, sampleRate * 0.45);
    onePoleHighPass(mid, midLowCut, sampleRate);
    onePoleLowPass(mid, midHighCut, sampleRate);

    for (let i = 0; i < source.length; i++) {
      const combined = low[i] * lowGain + mid[i] * midGain + high[i] * highGain + source[i] * 0.12;
      dst[i] = clamp(combined, -1, 1);
    }
  }

  return output;
}

function buildEqCurvePath(eq: EqSettings, width: number, height: number) {
  const points: string[] = [];
  const minHz = 20;
  const maxHz = 20000;
  const minDb = -18;
  const maxDb = 18;

  for (let x = 0; x <= width; x += 6) {
    const ratio = x / width;
    const hz = minHz * Math.pow(maxHz / minHz, ratio);
    const lowInfluence = Math.exp(-Math.pow((Math.log(hz) - Math.log(eq.low.frequency)) / 1.25, 2));
    const midInfluence = Math.exp(-Math.pow((Math.log(hz) - Math.log(eq.mid.frequency)) / 0.7, 2));
    const highInfluence = Math.exp(-Math.pow((Math.log(hz) - Math.log(eq.high.frequency)) / 1.15, 2));
    const db = clamp(
      eq.low.gain * lowInfluence + eq.mid.gain * midInfluence + eq.high.gain * highInfluence,
      minDb,
      maxDb,
    );
    const y = ((maxDb - db) / (maxDb - minDb)) * height;
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

export default function MusicEditorPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const playStartTimeRef = useRef(0);
  const playOffsetRef = useRef(0);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [history, setHistory] = useState<AudioBuffer[]>([]);
  const [fileName, setFileName] = useState("Untitled");
  const [selection, setSelection] = useState<TimeRange | null>(null);
  const [cursor, setCursor] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("reduce background noise and make it clearer");
  const [aiStrength, setAiStrength] = useState(2);
  const [noiseProfile, setNoiseProfile] = useState<NoiseProfile | null>(null);
  const [songPrompt, setSongPrompt] = useState("dreamy synth pop night drive with emotional vocals");
  const [songLyrics, setSongLyrics] = useState("");
  const [songGenre, setSongGenre] = useState("Synth Pop");
  const [songMood, setSongMood] = useState("Uplifting");
  const [songBpm, setSongBpm] = useState(118);
  const [songKey, setSongKey] = useState("A Minor");
  const [songBlueprint, setSongBlueprint] = useState<SongBlueprint | null>(null);
  const [masterPreset, setMasterPreset] = useState<MasterPreset>("Suno Pop");
  const [stemMix, setStemMix] = useState<StemMix>({ vocals: 1, drums: 1, bass: 1, music: 1 });
  const [trimSettings, setTrimSettings] = useState<TrimSilenceSettings>({
    thresholdDb: -36,
    minSilenceSec: 0.45,
    targetSilenceSec: 0.1,
    keepLeadingTrailing: true,
  });
  const [eqSettings, setEqSettings] = useState<EqSettings>({
    low: { frequency: 120, gain: 0, q: 0.7 },
    mid: { frequency: 1200, gain: 0, q: 1.1 },
    high: { frequency: 5600, gain: 0, q: 0.8 },
  });
  const [processingFx, setProcessingFx] = useState(false);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [snapshotSavedAt, setSnapshotSavedAt] = useState<string | null>(null);
  const [hasExported, setHasExported] = useState(false);
  const [comfortProfile, setComfortProfile] = useState<ComfortProfile>(() =>
    buildComfortPreset("Balanced", "Headphones"),
  );
  const [comfortModel, setComfortModel] = useState<ComfortModelState>(() => createEmptyComfortModel());
  const [comfortIntent, setComfortIntent] = useState("reduce harsh beats, softer bass for long listening");
  const [aiTrainerModel, setAiTrainerModel] = useState<AiTrainerModel>(() => createEmptyAiTrainerModel());
  const [lastAiRun, setLastAiRun] = useState<{ prompt: string; plan: AiPlan; strength: number } | null>(null);

  const duration = audioBuffer?.duration ?? 0;

  const effectiveSelection = useMemo(() => {
    if (!selection) return null;
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    if (Math.abs(end - start) < 0.005) return null;
    return { start, end };
  }, [selection]);

  const eqCurvePath = useMemo(() => buildEqCurvePath(eqSettings, 440, 120), [eqSettings]);
  const readinessChecklist = useMemo(
    () => [
      { label: "Audio loaded", done: Boolean(audioBuffer) },
      { label: "Song idea generated", done: Boolean(songBlueprint) },
      { label: "Noise profile trained", done: Boolean(noiseProfile?.trained) },
      { label: "Master preset configured", done: Boolean(masterPreset) },
      { label: "Comfort partner tuned", done: comfortProfile.fatigueLevel > 0 || comfortProfile.headacheMode },
      { label: "Quality score ≥ 80", done: (qualityReport?.score ?? 0) >= 80 },
      { label: "Project snapshot saved", done: Boolean(snapshotSavedAt) },
      { label: "Final export generated", done: hasExported },
    ],
    [audioBuffer, songBlueprint, noiseProfile, masterPreset, comfortProfile, qualityReport, snapshotSavedAt, hasExported],
  );
  const comfortSummary = useMemo(() => {
    const lines = [];
    if (comfortProfile.headacheMode) lines.push("Headache relief enabled");
    if (comfortProfile.bassRelief > 0.55) lines.push("Strong bass reduction");
    if (comfortProfile.beatSoftness > 0.55) lines.push("Beats softened");
    if (comfortProfile.trebleSoftness > 0.5) lines.push("High-frequencies softened");
    if (comfortProfile.loudnessGuard > 0.5) lines.push("Loudness guard active");
    if (lines.length === 0) lines.push("Balanced comfort mode");
    return lines.join(" · ");
  }, [comfortProfile]);
  const comfortModelEntry = useMemo(
    () => comfortModel.entries[getComfortModelKey(comfortProfile)] || null,
    [comfortModel, comfortProfile],
  );
  const aiPromptEntry = useMemo(() => {
    const key = normalizePromptKey(aiPrompt);
    return key ? aiTrainerModel.prompts[key] || null : null;
  }, [aiPrompt, aiTrainerModel]);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = getAudioContext();
    return audioCtxRef.current;
  }, []);

  const saveProjectSnapshot = useCallback(() => {
    const snapshot: ProjectSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      fileName,
      aiPrompt,
      aiStrength,
      songPrompt,
      songLyrics,
      songGenre,
      songMood,
      songBpm,
      songKey,
      masterPreset,
      stemMix,
      trimSettings,
      eqSettings,
      comfortProfile,
    };
    localStorage.setItem(PROJECT_SNAPSHOT_KEY, JSON.stringify(snapshot));
    setSnapshotSavedAt(snapshot.savedAt);
    toast.success("Project snapshot saved.");
  }, [
    fileName,
    aiPrompt,
    aiStrength,
    songPrompt,
    songLyrics,
    songGenre,
    songMood,
    songBpm,
    songKey,
    masterPreset,
    stemMix,
    trimSettings,
    eqSettings,
    comfortProfile,
  ]);

  const loadProjectSnapshot = useCallback(() => {
    const raw = localStorage.getItem(PROJECT_SNAPSHOT_KEY);
    if (!raw) {
      toast("No saved project snapshot found.");
      return;
    }
    try {
      const snapshot = JSON.parse(raw) as ProjectSnapshot;
      if (!snapshot || snapshot.version !== 1) throw new Error("Invalid snapshot");
      setFileName(snapshot.fileName || "Untitled");
      setAiPrompt(snapshot.aiPrompt || "reduce background noise and make it clearer");
      setAiStrength(clamp(snapshot.aiStrength || 2, 1, 3));
      setSongPrompt(snapshot.songPrompt || "");
      setSongLyrics(snapshot.songLyrics || "");
      setSongGenre(snapshot.songGenre || "Synth Pop");
      setSongMood(snapshot.songMood || "Uplifting");
      setSongBpm(clamp(snapshot.songBpm || 118, 70, 190));
      setSongKey(snapshot.songKey || "A Minor");
      setMasterPreset(snapshot.masterPreset || "Suno Pop");
      setStemMix(snapshot.stemMix || { vocals: 1, drums: 1, bass: 1, music: 1 });
      setTrimSettings(
        snapshot.trimSettings || {
          thresholdDb: -36,
          minSilenceSec: 0.45,
          targetSilenceSec: 0.1,
          keepLeadingTrailing: true,
        },
      );
      setEqSettings(
        snapshot.eqSettings || {
          low: { frequency: 120, gain: 0, q: 0.7 },
          mid: { frequency: 1200, gain: 0, q: 1.1 },
          high: { frequency: 5600, gain: 0, q: 0.8 },
        },
      );
      setComfortProfile(snapshot.comfortProfile || buildComfortPreset("Balanced", "Headphones"));
      setSnapshotSavedAt(snapshot.savedAt);
      toast.success("Project snapshot restored.");
    } catch {
      toast.error("Could not restore saved snapshot.");
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setPlaying(false);
  }, []);

  const redrawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(23,29,32,0.92)";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(68,108,118,0.45)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!audioBuffer) return;
    const data = audioBuffer.getChannelData(0);
    const visibleDuration = Math.max(0.25, audioBuffer.duration / zoom);
    const maxWindowStart = Math.max(0, audioBuffer.duration - visibleDuration);
    const windowStart = clamp(cursor, 0, maxWindowStart);
    const windowEnd = Math.min(audioBuffer.duration, windowStart + visibleDuration);
    const rawStartSample = Math.floor((windowStart / audioBuffer.duration) * data.length);
    const rawEndSample = Math.max(rawStartSample + 1, Math.floor((windowEnd / audioBuffer.duration) * data.length));
    const startSample = clamp(rawStartSample, 0, Math.max(0, data.length - 1));
    const endSample = clamp(rawEndSample, startSample + 1, data.length);
    const span = endSample - startSample;
    const samplesPerPx = Math.max(1, Math.floor(span / width));

    ctx.strokeStyle = "#28e7d8";
    for (let x = 0; x < width; x++) {
      const index = startSample + x * samplesPerPx;
      let min = 0;
      let max = 0;
      let hasSample = false;
      for (let i = 0; i < samplesPerPx && index + i < endSample; i++) {
        const value = data[index + i];
        if (typeof value !== "number") continue;
        hasSample = true;
        if (value < min) min = value;
        if (value > max) max = value;
      }
      if (!hasSample) continue;
      const yTop = (1 - max) * 0.5 * height;
      const yBottom = (1 - min) * 0.5 * height;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBottom);
      ctx.stroke();
    }

    if (effectiveSelection) {
      const selectionStartX = ((effectiveSelection.start - windowStart) / visibleDuration) * width;
      const selectionEndX = ((effectiveSelection.end - windowStart) / visibleDuration) * width;
      const x = Math.max(0, Math.min(selectionStartX, selectionEndX));
      const w = Math.min(width, Math.abs(selectionEndX - selectionStartX));
      if (w > 0) {
        ctx.fillStyle = "rgba(125,224,255,0.15)";
        ctx.fillRect(x, 0, w, height);
      }
    }
  }, [audioBuffer, cursor, zoom, effectiveSelection]);

  useEffect(() => {
    redrawWaveform();
  }, [redrawWaveform]);

  useEffect(() => {
    const onResize = () => redrawWaveform();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redrawWaveform]);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_SNAPSHOT_KEY);
    if (!raw) return;
    try {
      const snapshot = JSON.parse(raw) as ProjectSnapshot;
      if (snapshot?.savedAt) setSnapshotSavedAt(snapshot.savedAt);
    } catch {}
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(COMFORT_PROFILE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ComfortProfile;
      if (parsed?.device && parsed?.taste) {
        setComfortProfile({
          device: parsed.device,
          taste: parsed.taste,
          fatigueLevel: clamp(parsed.fatigueLevel ?? 0.35, 0, 1),
          bassRelief: clamp(parsed.bassRelief ?? 0.3, 0, 1),
          beatSoftness: clamp(parsed.beatSoftness ?? 0.3, 0, 1),
          trebleSoftness: clamp(parsed.trebleSoftness ?? 0.3, 0, 1),
          loudnessGuard: clamp(parsed.loudnessGuard ?? 0.3, 0, 1),
          headacheMode: Boolean(parsed.headacheMode),
          autoLearn: parsed.autoLearn !== false,
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(COMFORT_PROFILE_KEY, JSON.stringify(comfortProfile));
  }, [comfortProfile]);

  useEffect(() => {
    const raw = localStorage.getItem(COMFORT_MODEL_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ComfortModelState;
      if (parsed?.version === 1 && parsed?.entries) setComfortModel(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(COMFORT_MODEL_KEY, JSON.stringify(comfortModel));
  }, [comfortModel]);

  useEffect(() => {
    const raw = localStorage.getItem(AI_TRAINER_MODEL_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as AiTrainerModel;
      if (parsed?.version === 1 && parsed?.prompts && parsed?.globalWeights) {
        setAiTrainerModel(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(AI_TRAINER_MODEL_KEY, JSON.stringify(aiTrainerModel));
  }, [aiTrainerModel]);

  useEffect(() => {
    if (!audioBuffer) {
      setQualityReport(null);
      return;
    }
    setQualityReport(buildQualityReport(audioBuffer));
  }, [audioBuffer]);

  useEffect(() => {
    if (!comfortProfile.autoLearn || !qualityReport) return;
    setComfortProfile((prev) => {
      let next = { ...prev };
      if (qualityReport.rmsDb > -10.5) next.loudnessGuard = clamp(prev.loudnessGuard + 0.03, 0, 1);
      if (qualityReport.peakDb > -0.5) next.beatSoftness = clamp(prev.beatSoftness + 0.025, 0, 1);
      if (qualityReport.crestDb < 5.5) next.bassRelief = clamp(prev.bassRelief + 0.02, 0, 1);
      return next;
    });
  }, [qualityReport, comfortProfile.autoLearn]);

  const toTime = (x: number) => {
    if (!audioBuffer || !canvasRef.current) return 0;
    const rect = canvasRef.current.getBoundingClientRect();
    const ratio = clamp((x - rect.left) / Math.max(1, rect.width), 0, 1);
    const visibleDuration = Math.max(0.25, audioBuffer.duration / zoom);
    return clamp(cursor + ratio * visibleDuration, 0, audioBuffer.duration);
  };

  const pushHistory = useCallback(
    (buffer: AudioBuffer) => {
      const copy = cloneBuffer(getCtx(), buffer);
      setHistory((prev) => [...prev.slice(-19), copy]);
    },
    [getCtx],
  );

  const openFile = async (file: File) => {
    try {
      stopPlayback();
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await getCtx().decodeAudioData(arrayBuffer.slice(0));
      setAudioBuffer(decoded);
      setHistory([]);
      setFileName(file.name.replace(/\.[^/.]+$/, ""));
      setSelection(null);
      setCursor(0);
      setZoom(1);
      setHasExported(false);
      toast.success("Audio loaded into editor.");
    } catch {
      toast.error("Couldn't decode this audio file.");
    }
  };

  const handleUndo = () => {
    if (history.length === 0) {
      toast("Nothing to undo.");
      return;
    }
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setAudioBuffer(cloneBuffer(getCtx(), previous));
    setSelection(null);
    toast.success("Undo applied.");
  };

  const handleTrim = () => {
    if (!audioBuffer || !effectiveSelection) {
      toast("Select a region first.");
      return;
    }
    pushHistory(audioBuffer);
    const trimmed = cloneBuffer(getCtx(), audioBuffer, effectiveSelection.start, effectiveSelection.end);
    setAudioBuffer(trimmed);
    setSelection(null);
    setCursor(0);
    toast.success("Trimmed to selection.");
  };

  const handleCut = () => {
    if (!audioBuffer || !effectiveSelection) {
      toast("Select a region first.");
      return;
    }
    pushHistory(audioBuffer);
    const cut = cutRangeFromBuffer(getCtx(), audioBuffer, effectiveSelection);
    setAudioBuffer(cut);
    setSelection(null);
    setCursor(clamp(effectiveSelection.start, 0, cut.duration));
    toast.success("Cut selection.");
  };

  const handleNormalize = () => {
    if (!audioBuffer) return;
    pushHistory(audioBuffer);
    const copy = cloneBuffer(getCtx(), audioBuffer);
    normalizeAudioBuffer(copy);
    setAudioBuffer(copy);
    toast.success("Normalized waveform.");
  };

  const handleFade = (type: "in" | "out") => {
    if (!audioBuffer) return;
    pushHistory(audioBuffer);
    const copy = cloneBuffer(getCtx(), audioBuffer);
    const defaultSpan = Math.min(1.5, copy.duration);
    const range =
      effectiveSelection ||
      (type === "in"
        ? { start: 0, end: defaultSpan }
        : { start: Math.max(0, copy.duration - defaultSpan), end: copy.duration });
    applyFade(copy, range, type);
    setAudioBuffer(copy);
    toast.success(type === "in" ? "Fade in applied." : "Fade out applied.");
  };

  const runAiAssistant = () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    const parsedPlan = parseAiPrompt(aiPrompt);
    const inferred = inferAiPlanWithModel(aiPrompt, parsedPlan, aiStrength, aiTrainerModel);
    if (inferred.plan.tasks.length === 0) {
      toast("Okay — no processing applied.");
      return;
    }
    pushHistory(audioBuffer);
    const copy = cloneBuffer(getCtx(), audioBuffer);
    applyAdvancedAiPlan(copy, inferred.plan, inferred.strength, noiseProfile);
    setAudioBuffer(copy);
    setLastAiRun({ prompt: aiPrompt, plan: inferred.plan, strength: inferred.strength });
    toast.success(`${inferred.plan.label} applied (strength ${inferred.strength.toFixed(1)}).`);
  };

  const trainNoiseProfile = () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    const trainingRange = effectiveSelection && effectiveSelection.end - effectiveSelection.start >= 0.08 ? effectiveSelection : null;
    const profile = buildNoiseProfile(audioBuffer, trainingRange);
    setNoiseProfile(profile);
    toast.success(trainingRange ? "AI trained from selected region." : "AI trained from full track profile.");
  };

  const trainAiAssistantFromFeedback = (feedback: "better" | "worse") => {
    const seedPlan = lastAiRun?.plan ?? parseAiPrompt(aiPrompt);
    if (seedPlan.tasks.length === 0) {
      toast("No active AI plan to train from.");
      return;
    }
    const usedStrength = lastAiRun?.strength ?? aiStrength;
    const updatedModel = trainAiModel(aiTrainerModel, aiPrompt, seedPlan, usedStrength, feedback);
    setAiTrainerModel(updatedModel);
    toast.success(feedback === "better" ? "AI trainer learned this preference." : "AI trainer reduced this pattern.");
  };

  const maxTrainAiAssistant = () => {
    const basePlan = parseAiPrompt(aiPrompt);
    if (basePlan.tasks.length === 0) {
      toast("Enter a prompt with at least one effect to max-train.");
      return;
    }
    let model = aiTrainerModel;
    for (let i = 0; i < 220; i++) {
      model = trainAiModel(model, aiPrompt, basePlan, aiStrength, "better");
    }
    setAiTrainerModel(model);
    toast.success("AI Audio Assistant trained to max local level.");
  };

  const generateSongIdea = () => {
    const prompt = `${songPrompt} ${songLyrics}`.trim();
    if (!prompt) {
      toast("Enter a song idea prompt first.");
      return;
    }
    const blueprint = buildSongBlueprint(prompt, songMood, songGenre, songBpm, songKey);
    setSongBlueprint(blueprint);
    setAiPrompt(`master a ${blueprint.vibe} track, clean noise and glue the mix`);
    toast.success(`Generated arrangement: ${blueprint.title}`);
  };

  const focusSection = (sectionIndex: number) => {
    if (!songBlueprint || !audioBuffer) return;
    const totalBars = songBlueprint.sections.reduce((sum, section) => sum + section.bars, 0);
    if (totalBars <= 0) return;
    const startBars = songBlueprint.sections.slice(0, sectionIndex).reduce((sum, section) => sum + section.bars, 0);
    const target = songBlueprint.sections[sectionIndex];
    const start = (startBars / totalBars) * audioBuffer.duration;
    const end = clamp(((startBars + target.bars) / totalBars) * audioBuffer.duration, start + 0.05, audioBuffer.duration);
    setSelection({ start, end });
    setCursor(start);
    toast.success(`Focused ${target.name} section.`);
  };

  const runSmartMaster = () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    pushHistory(audioBuffer);
    const copy = cloneBuffer(getCtx(), audioBuffer);
    const presetConfig = getMasterPresetPlan(masterPreset);
    applyAdvancedAiPlan(copy, presetConfig.plan, presetConfig.strength, noiseProfile);
    applyStemMixer(copy, {
      vocals: stemMix.vocals * presetConfig.stemMix.vocals,
      drums: stemMix.drums * presetConfig.stemMix.drums,
      bass: stemMix.bass * presetConfig.stemMix.bass,
      music: stemMix.music * presetConfig.stemMix.music,
    });
    normalizeAudioBuffer(copy);
    setAudioBuffer(copy);
    toast.success(`${masterPreset} master applied.`);
  };

  const applyTrimSilence = () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    const trimmed = trimSilences(getCtx(), audioBuffer, trimSettings);
    if (trimmed === audioBuffer) {
      toast("No qualifying silence detected.");
      return;
    }
    pushHistory(audioBuffer);
    setAudioBuffer(trimmed);
    setSelection(null);
    setCursor(clamp(cursor, 0, trimmed.duration));
    toast.success("Trim silence applied.");
  };

  const applyEqRack = async () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    const totalGainChange =
      Math.abs(eqSettings.low.gain) + Math.abs(eqSettings.mid.gain) + Math.abs(eqSettings.high.gain);
    if (totalGainChange < 0.2) {
      toast("EQ is nearly flat. Increase one or more gain sliders.");
      return;
    }
    setProcessingFx(true);
    try {
      const eqBuffer = await applyParametricEq(audioBuffer, eqSettings);
      const energy = averageAbs(eqBuffer.getChannelData(0));
      const processed =
        energy < 1e-6 ? applyParametricEqFallback(getCtx(), audioBuffer, eqSettings) : eqBuffer;
      const mastered = cloneBuffer(getCtx(), processed);
      pushHistory(audioBuffer);
      normalizeAudioBuffer(mastered);
      setAudioBuffer(mastered);
      toast.success("Parametric EQ applied.");
    } catch {
      try {
        const fallback = applyParametricEqFallback(getCtx(), audioBuffer, eqSettings);
        const mastered = cloneBuffer(getCtx(), fallback);
        pushHistory(audioBuffer);
        normalizeAudioBuffer(mastered);
        setAudioBuffer(mastered);
        toast.success("Parametric EQ applied (fallback engine).");
      } catch {
        toast.error("EQ processing failed.");
      }
    } finally {
      setProcessingFx(false);
    }
  };

  const runQualityAudit = () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    const report = buildQualityReport(audioBuffer);
    setQualityReport(report);
    toast.success(`Quality score: ${report.score}/100`);
  };

  const suggestComfortSettings = () => {
    const currentReport = audioBuffer ? buildQualityReport(audioBuffer) : qualityReport;
    const base = buildComfortPreset(comfortProfile.taste, comfortProfile.device);
    let next = inferComfortProfileFromModel(comfortModel, {
      ...base,
      autoLearn: comfortProfile.autoLearn,
      headacheMode: comfortProfile.headacheMode,
    });

    const intent = comfortIntent.toLowerCase();
    if (/(headache|pain|fatigue|tired|stress)/.test(intent)) {
      next.headacheMode = true;
      next.fatigueLevel = clamp(next.fatigueLevel + 0.18, 0, 1);
      next.loudnessGuard = clamp(next.loudnessGuard + 0.15, 0, 1);
    }
    if (/(bass|boomy|thump|kick)/.test(intent)) {
      next.bassRelief = clamp(next.bassRelief + 0.18, 0, 1);
      next.beatSoftness = clamp(next.beatSoftness + 0.12, 0, 1);
    }
    if (/(sharp|harsh|treble|high)/.test(intent)) {
      next.trebleSoftness = clamp(next.trebleSoftness + 0.2, 0, 1);
    }
    if (/(soft|gentle|calm|relax|smooth)/.test(intent)) {
      next.beatSoftness = clamp(next.beatSoftness + 0.15, 0, 1);
      next.loudnessGuard = clamp(next.loudnessGuard + 0.08, 0, 1);
    }

    if (comfortProfile.headacheMode) {
      next = {
        ...next,
        fatigueLevel: clamp(next.fatigueLevel + 0.2, 0, 1),
        bassRelief: clamp(next.bassRelief + 0.2, 0, 1),
        beatSoftness: clamp(next.beatSoftness + 0.18, 0, 1),
        trebleSoftness: clamp(next.trebleSoftness + 0.16, 0, 1),
        loudnessGuard: clamp(next.loudnessGuard + 0.16, 0, 1),
      };
    }

    if (currentReport) {
      if (currentReport.rmsDb > -10) next.loudnessGuard = clamp(next.loudnessGuard + 0.22, 0, 1);
      if (currentReport.peakDb > -0.7) next.beatSoftness = clamp(next.beatSoftness + 0.18, 0, 1);
      if (currentReport.crestDb < 6) next.beatSoftness = clamp(next.beatSoftness + 0.1, 0, 1);
    }

    setComfortProfile(next);
    toast.success("Comfort partner learned your listening preference.");
  };

  const applyComfortMode = () => {
    if (!audioBuffer) {
      toast("Open an audio file first.");
      return;
    }
    pushHistory(audioBuffer);
    const adjusted = applyComfortPartner(getCtx(), audioBuffer, comfortProfile);
    setAudioBuffer(adjusted);
    setSelection(null);
    setCursor(clamp(cursor, 0, adjusted.duration));
    toast.success("Comfort mode applied for easier listening.");
  };

  const trainComfortPartner = (feedback: ComfortTrainerFeedback) => {
    const updatedModel = trainComfortModel(comfortModel, comfortProfile, feedback);
    setComfortModel(updatedModel);
    const inferred = inferComfortProfileFromModel(updatedModel, comfortProfile);
    setComfortProfile(inferred);
    toast.success(
      feedback === "better"
        ? "Trainer updated: keeping this direction."
        : "Trainer updated: searching a softer alternative.",
    );
  };

  const maxTrainComfortPartner = () => {
    let model = comfortModel;
    for (let i = 0; i < 120; i++) {
      model = trainComfortModel(model, comfortProfile, "better");
    }
    setComfortModel(model);
    setComfortProfile(inferComfortProfileFromModel(model, comfortProfile));
    toast.success("Comfort model trained to maximum local depth.");
  };

  const startPlayback = async () => {
    if (!audioBuffer) return;
    stopPlayback();
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        toast.error("Audio engine is blocked by browser.");
        return;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const usingSelection = Boolean(effectiveSelection);
    const selectionStart = effectiveSelection?.start ?? 0;
    const selectionEnd = effectiveSelection?.end ?? audioBuffer.duration;

    let from = usingSelection ? selectionStart : cursor;
    let to = usingSelection ? selectionEnd : audioBuffer.duration;

    if (!usingSelection && from >= audioBuffer.duration - 0.01) {
      from = 0;
      to = audioBuffer.duration;
      setCursor(0);
      toast("Cursor reached end. Playback restarted from start.");
    }

    from = clamp(from, 0, Math.max(0, audioBuffer.duration - 0.01));
    to = clamp(to, from + 0.01, audioBuffer.duration);
    const length = Math.max(0.05, to - from);

    try {
      source.start(0, from, length);
    } catch {
      toast.error("Could not start playback. Try selecting a valid range.");
      source.disconnect();
      return;
    }
    sourceRef.current = source;
    setPlaying(true);
    playStartTimeRef.current = ctx.currentTime;
    playOffsetRef.current = from;

    const tick = () => {
      const elapsed = ctx.currentTime - playStartTimeRef.current;
      const at = playOffsetRef.current + elapsed;
      if (at >= to) {
        setCursor(to);
        stopPlayback();
        return;
      }
      setCursor(at);
      animationRef.current = window.requestAnimationFrame(tick);
    };
    animationRef.current = window.requestAnimationFrame(tick);

    source.onended = () => {
      stopPlayback();
    };
  };

  const exportWav = () => {
    if (!audioBuffer) return;
    const blob = audioBufferToWavBlob(audioBuffer);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName || "edited-audio"}.wav`;
    link.click();
    URL.revokeObjectURL(url);
    setHasExported(true);
    toast.success("Exported WAV.");
  };

  return (
    <div className="min-h-screen p-4 pb-28 md:p-6 md:pb-32 bg-background/85 backdrop-blur-[1px]">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/")} className="bg-secondary rounded-full p-2.5">
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-xl md:text-2xl font-extrabold">Wave Editor</h1>
          <span className="text-xs text-muted-foreground font-semibold">{fileName}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.flac"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openFile(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-bold flex items-center gap-2"
          >
            <FolderOpen size={14} />
            Open
          </button>
          <button
            onClick={playing ? stopPlayback : startPlayback}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2"
            disabled={!audioBuffer}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={exportWav}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-bold flex items-center gap-2"
            disabled={!audioBuffer}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-[1px] p-3 md:p-4 mb-3">
        <div className="rounded-xl border border-primary/25 bg-secondary/35 p-3 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.13em]">Release Readiness</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={loadProjectSnapshot}
                className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold"
              >
                Load Snapshot
              </button>
              <button
                onClick={saveProjectSnapshot}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs md:text-sm font-bold"
              >
                Save Snapshot
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em]">Quality Analyzer</h3>
                <button
                  onClick={runQualityAudit}
                  className="px-2.5 py-1.5 rounded-md bg-secondary border border-border text-xs font-semibold"
                >
                  Recheck
                </button>
              </div>
              {qualityReport ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md border border-border/65 bg-background/45 p-2">
                    <div className="text-muted-foreground">Score</div>
                    <div className="text-sm font-bold">{qualityReport.score}/100</div>
                  </div>
                  <div className="rounded-md border border-border/65 bg-background/45 p-2">
                    <div className="text-muted-foreground">Peak</div>
                    <div className="text-sm font-bold">{qualityReport.peakDb.toFixed(1)} dB</div>
                  </div>
                  <div className="rounded-md border border-border/65 bg-background/45 p-2">
                    <div className="text-muted-foreground">RMS</div>
                    <div className="text-sm font-bold">{qualityReport.rmsDb.toFixed(1)} dB</div>
                  </div>
                  <div className="rounded-md border border-border/65 bg-background/45 p-2">
                    <div className="text-muted-foreground">Crest</div>
                    <div className="text-sm font-bold">{qualityReport.crestDb.toFixed(1)} dB</div>
                  </div>
                  <div className="rounded-md border border-border/65 bg-background/45 p-2">
                    <div className="text-muted-foreground">Clipping Samples</div>
                    <div className="text-sm font-bold">{Math.round(qualityReport.clippingSamples)}</div>
                  </div>
                  <div className="rounded-md border border-border/65 bg-background/45 p-2">
                    <div className="text-muted-foreground">Noise Floor</div>
                    <div className="text-sm font-bold">{qualityReport.noiseFloorDb.toFixed(1)} dB</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Load audio to run quality analysis.</div>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-2.5">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] mb-2">Market Checklist</h3>
              <div className="space-y-1.5 text-xs">
                {readinessChecklist.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                    <span>{item.label}</span>
                    <span className={item.done ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>
                      {item.done ? "Done" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Snapshot: {snapshotSavedAt ? new Date(snapshotSavedAt).toLocaleString() : "Not saved yet"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/25 bg-secondary/35 p-3 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.13em]">Listening Comfort Partner</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={suggestComfortSettings}
                className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold"
              >
                Learn My Taste
              </button>
              <button
                onClick={applyComfortMode}
                disabled={!audioBuffer}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs md:text-sm font-bold disabled:opacity-50"
              >
                Apply Comfort
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-2 mb-2">
            <input
              value={comfortIntent}
              onChange={(event) => setComfortIntent(event.target.value)}
              placeholder="Tell me your comfort need (e.g. harsh beats give me headache)"
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => trainComfortPartner("better")}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-bold"
            >
              Better 👍
            </button>
            <button
              onClick={() => trainComfortPartner("worse")}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-bold"
            >
              Worse 👎
            </button>
            <button
              onClick={maxTrainComfortPartner}
              className="px-3 py-2 rounded-lg bg-primary/90 text-primary-foreground text-xs font-bold"
            >
              Max Train
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <select
              value={comfortProfile.device}
              onChange={(event) =>
                setComfortProfile((prev) => ({ ...prev, device: event.target.value as ListeningDevice }))
              }
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option>Headphones</option>
              <option>Earbuds</option>
              <option>Speakers</option>
            </select>
            <select
              value={comfortProfile.taste}
              onChange={(event) => {
                const taste = event.target.value as TastePreset;
                setComfortProfile((prev) => ({
                  ...buildComfortPreset(taste, prev.device),
                  autoLearn: prev.autoLearn,
                  headacheMode: prev.headacheMode,
                }));
              }}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option>Balanced</option>
              <option>Warm Soft</option>
              <option>Low Bass Focus</option>
              <option>Ultra Gentle</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {(
              [
                ["fatigueLevel", "Fatigue Sensitivity"],
                ["bassRelief", "Reduce Bass / Thump"],
                ["beatSoftness", "Soften Beat Impact"],
                ["trebleSoftness", "Reduce Sharp Highs"],
                ["loudnessGuard", "Loudness Guard"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="rounded-lg border border-border/70 bg-background/40 p-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{Math.round(comfortProfile[key] * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={comfortProfile[key]}
                  onChange={(event) =>
                    setComfortProfile((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
            ))}
            <label className="rounded-lg border border-border/70 bg-background/40 p-2 flex items-center justify-between text-xs">
              <span>Headache Relief Mode</span>
              <input
                type="checkbox"
                checked={comfortProfile.headacheMode}
                onChange={(event) =>
                  setComfortProfile((prev) => ({ ...prev, headacheMode: event.target.checked }))
                }
              />
            </label>
            <label className="rounded-lg border border-border/70 bg-background/40 p-2 flex items-center justify-between text-xs">
              <span>Auto Learn Taste</span>
              <input
                type="checkbox"
                checked={comfortProfile.autoLearn}
                onChange={(event) =>
                  setComfortProfile((prev) => ({ ...prev, autoLearn: event.target.checked }))
                }
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {comfortSummary}
            {qualityReport ? ` · Current RMS ${qualityReport.rmsDb.toFixed(1)}dB.` : ""}
            {comfortModelEntry
              ? ` · Trained samples ${comfortModelEntry.samples}, confidence ${Math.round(
                  comfortModelEntry.confidence * 100,
                )}%.`
              : " · No personal model yet, start with Better/Worse training."}
          </p>
        </div>

        <div className="rounded-xl border border-primary/25 bg-secondary/35 p-3 mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.13em]">Create Studio (Suno-style)</h2>
            <button
              onClick={generateSongIdea}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs md:text-sm font-bold"
            >
              Generate Idea
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <input
              value={songPrompt}
              onChange={(event) => setSongPrompt(event.target.value)}
              placeholder="Describe your song idea"
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary lg:col-span-2"
            />
            <textarea
              value={songLyrics}
              onChange={(event) => setSongLyrics(event.target.value)}
              placeholder="Optional lyrics hook..."
              rows={2}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary lg:col-span-2 resize-none"
            />
            <select
              value={songGenre}
              onChange={(event) => setSongGenre(event.target.value)}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option>Synth Pop</option>
              <option>Afro Beat</option>
              <option>Melodic Techno</option>
              <option>Cinematic</option>
              <option>Lo-Fi</option>
              <option>Acoustic Folk</option>
            </select>
            <select
              value={songMood}
              onChange={(event) => setSongMood(event.target.value)}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option>Uplifting</option>
              <option>Dark</option>
              <option>Dreamy</option>
              <option>Hype</option>
              <option>Emotional</option>
              <option>Chill</option>
            </select>
            <input
              type="number"
              value={songBpm}
              min={70}
              max={190}
              onChange={(event) => setSongBpm(clamp(Number(event.target.value) || 120, 70, 190))}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={songKey}
              onChange={(event) => setSongKey(event.target.value)}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option>A Minor</option>
              <option>C Major</option>
              <option>D Minor</option>
              <option>E Minor</option>
              <option>F Major</option>
              <option>G Major</option>
            </select>
          </div>
          {songBlueprint ? (
            <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
                <span className="font-extrabold">{songBlueprint.title}</span>
                <span className="text-muted-foreground">{songBlueprint.vibe}</span>
                <span className="text-muted-foreground">{songBlueprint.bpm} BPM</span>
                <span className="text-muted-foreground">{songBlueprint.key}</span>
              </div>
              <div className="flex items-end gap-1.5 h-16">
                {songBlueprint.sections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => focusSection(index)}
                    className={`flex-1 rounded-md bg-gradient-to-t ${section.color} border border-white/15 hover:brightness-110 transition`}
                    style={{ height: `${35 + section.intensity * 55}%` }}
                    title={`${section.name} • ${section.bars} bars`}
                  />
                ))}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Tap a block to focus that section on waveform.
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-primary/25 bg-secondary/45 p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-primary" />
            <h2 className="text-sm font-extrabold uppercase tracking-[0.13em]">AI Audio Assistant</h2>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="e.g. reduce noise and enhance vocals"
              className="flex-1 bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              value={aiStrength}
              onChange={(event) => setAiStrength(Number(event.target.value))}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary min-w-[110px]"
            >
              <option value={1}>Strength: Low</option>
              <option value={2}>Strength: Medium</option>
              <option value={3}>Strength: High</option>
            </select>
            <button
              onClick={trainNoiseProfile}
              disabled={!audioBuffer}
              className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-bold"
            >
              Train Noise
            </button>
            <button
              onClick={runAiAssistant}
              disabled={!audioBuffer}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
            >
              Run AI Enhance
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => trainAiAssistantFromFeedback("better")}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-bold"
            >
              Better Result 👍
            </button>
            <button
              onClick={() => trainAiAssistantFromFeedback("worse")}
              className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-bold"
            >
              Too Strong 👎
            </button>
            <button
              onClick={maxTrainAiAssistant}
              className="px-3 py-1.5 rounded-lg bg-primary/90 text-primary-foreground text-xs font-bold"
            >
              Max Train AI
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Local mini-AI mode: prompt-parsed multi-step chain + trainable noise profile.
            {noiseProfile
              ? ` Trained floor ${noiseProfile.floor.toFixed(4)} | low ${noiseProfile.low.toFixed(4)} | mid ${noiseProfile.mid.toFixed(4)} | high ${noiseProfile.high.toFixed(4)}.`
              : " Tip: select a noisy region then click Train Noise for better denoise."}
            {aiPromptEntry
              ? ` AI trainer samples ${aiPromptEntry.samples}, confidence ${Math.round(
                  aiPromptEntry.confidence * 100,
                )}%, preferred strength ${aiPromptEntry.preferredStrength.toFixed(1)}.`
              : " AI trainer is ready: run Max Train AI to build your personalized prompt model."}
          </p>
        </div>

        <div className="rounded-xl border border-primary/25 bg-secondary/35 p-3 mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.13em]">Smart Master + Stem Mixer</h2>
            <button
              onClick={runSmartMaster}
              disabled={!audioBuffer}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs md:text-sm font-bold disabled:opacity-50"
            >
              Run Smart Master
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={masterPreset}
              onChange={(event) => setMasterPreset(event.target.value as MasterPreset)}
              className="bg-background/70 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option>Suno Pop</option>
              <option>Cinematic Wide</option>
              <option>Lo-Fi Chill</option>
              <option>Vocal Focus</option>
            </select>
            <div className="rounded-lg border border-border/70 bg-background/40 p-2 text-[11px] text-muted-foreground">
              Preset + AI chain + virtual stem levels for vocals/drums/bass/music.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {(
              [
                ["vocals", "Vocals"],
                ["drums", "Drums"],
                ["bass", "Bass"],
                ["music", "Music"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="rounded-lg border border-border/70 bg-background/40 p-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{stemMix[key].toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.6}
                  step={0.01}
                  value={stemMix[key]}
                  onChange={(event) =>
                    setStemMix((prev) => ({
                      ...prev,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="w-full"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-primary/25 bg-secondary/35 p-3 mb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.13em] mb-2">Pro FX Rack</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em]">Trim Silences</h3>
                <button
                  onClick={applyTrimSilence}
                  disabled={!audioBuffer}
                  className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span>Silence Threshold</span>
                    <span className="text-muted-foreground">{trimSettings.thresholdDb.toFixed(0)} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-60}
                    max={-12}
                    step={1}
                    value={trimSettings.thresholdDb}
                    onChange={(event) =>
                      setTrimSettings((prev) => ({ ...prev, thresholdDb: Number(event.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span>Minimum Silence Length</span>
                    <span className="text-muted-foreground">{trimSettings.minSilenceSec.toFixed(2)} s</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.05}
                    value={trimSettings.minSilenceSec}
                    onChange={(event) =>
                      setTrimSettings((prev) => ({ ...prev, minSilenceSec: Number(event.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span>New Silence Length</span>
                    <span className="text-muted-foreground">{trimSettings.targetSilenceSec.toFixed(2)} s</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={trimSettings.targetSilenceSec}
                    onChange={(event) =>
                      setTrimSettings((prev) => ({ ...prev, targetSilenceSec: Number(event.target.value) }))
                    }
                    className="w-full"
                  />
                </label>
                <label className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={trimSettings.keepLeadingTrailing}
                    onChange={(event) =>
                      setTrimSettings((prev) => ({ ...prev, keepLeadingTrailing: event.target.checked }))
                    }
                  />
                  Keep leading/trailing silence
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em]">Parametric EQ</h3>
                <button
                  onClick={() => void applyEqRack()}
                  disabled={!audioBuffer || processingFx}
                  className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                >
                  {processingFx ? "Processing..." : "Apply EQ"}
                </button>
              </div>
              <div className="rounded-md border border-border/80 bg-[#1f2529] p-2 mb-2">
                <svg viewBox="0 0 440 120" className="w-full h-28">
                  <line x1="0" y1="60" x2="440" y2="60" stroke="rgba(140,170,178,0.35)" strokeWidth="1" />
                  <polyline points={eqCurvePath} fill="none" stroke="#30e8dc" strokeWidth="2.4" />
                </svg>
              </div>
              <div className="space-y-2">
                {(
                  [
                    ["low", "Low Shelf", 50, 320],
                    ["mid", "Mid Peak", 350, 3500],
                    ["high", "High Shelf", 2800, 14000],
                  ] as const
                ).map(([bandKey, label, minFreq, maxFreq]) => (
                  <div key={bandKey} className="rounded-md border border-border/65 bg-background/40 p-2">
                    <div className="text-[11px] font-semibold mb-1">
                      {label} • {Math.round(eqSettings[bandKey].frequency)}Hz • {eqSettings[bandKey].gain.toFixed(1)}dB
                      {bandKey === "mid" ? ` • Q ${eqSettings[bandKey].q.toFixed(1)}` : ""}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[11px]">
                        Freq
                        <input
                          type="range"
                          min={minFreq}
                          max={maxFreq}
                          step={10}
                          value={eqSettings[bandKey].frequency}
                          onChange={(event) =>
                            setEqSettings((prev) => ({
                              ...prev,
                              [bandKey]: { ...prev[bandKey], frequency: Number(event.target.value) },
                            }))
                          }
                          className="w-full"
                        />
                      </label>
                      <label className="text-[11px]">
                        Gain
                        <input
                          type="range"
                          min={-16}
                          max={16}
                          step={0.5}
                          value={eqSettings[bandKey].gain}
                          onChange={(event) =>
                            setEqSettings((prev) => ({
                              ...prev,
                              [bandKey]: { ...prev[bandKey], gain: Number(event.target.value) },
                            }))
                          }
                          className="w-full"
                        />
                      </label>
                      <label className="text-[11px]">
                        Q
                        <input
                          type="range"
                          min={0.3}
                          max={3}
                          step={0.1}
                          value={eqSettings[bandKey].q}
                          onChange={(event) =>
                            setEqSettings((prev) => ({
                              ...prev,
                              [bandKey]: { ...prev[bandKey], q: Number(event.target.value) },
                            }))
                          }
                          className="w-full"
                          disabled={bandKey !== "mid"}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={handleCut}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold flex items-center gap-1.5"
            disabled={!audioBuffer}
          >
            <Scissors size={13} />
            Cut
          </button>
          <button
            onClick={handleTrim}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold flex items-center gap-1.5"
            disabled={!audioBuffer}
          >
            <Crop size={13} />
            Trim
          </button>
          <button
            onClick={handleNormalize}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold flex items-center gap-1.5"
            disabled={!audioBuffer}
          >
            <Waves size={13} />
            Normalize
          </button>
          <button
            onClick={() => handleFade("in")}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold"
            disabled={!audioBuffer}
          >
            Fade In
          </button>
          <button
            onClick={() => handleFade("out")}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold"
            disabled={!audioBuffer}
          >
            Fade Out
          </button>
          <button
            onClick={handleUndo}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold flex items-center gap-1.5"
            disabled={!history.length}
          >
            <Undo2 size={13} />
            Undo
          </button>
          <button
            onClick={() => setZoom((value) => clamp(value * 1.35, 1, 32))}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold flex items-center gap-1.5"
            disabled={!audioBuffer}
          >
            <ZoomIn size={13} />
            Zoom In
          </button>
          <button
            onClick={() => setZoom((value) => clamp(value / 1.35, 1, 32))}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs md:text-sm font-bold flex items-center gap-1.5"
            disabled={!audioBuffer}
          >
            <ZoomOut size={13} />
            Zoom Out
          </button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-[#2f3135]">
          <canvas
            ref={canvasRef}
            className="w-full h-[360px] cursor-crosshair"
            onMouseDown={(event) => {
              if (!audioBuffer) return;
              const time = toTime(event.clientX);
              dragStartRef.current = time;
              setSelection({ start: time, end: time });
            }}
            onMouseMove={(event) => {
              if (dragStartRef.current === null) return;
              const time = toTime(event.clientX);
              setSelection({ start: dragStartRef.current, end: time });
            }}
            onMouseUp={() => {
              dragStartRef.current = null;
            }}
            onMouseLeave={() => {
              dragStartRef.current = null;
            }}
            onClick={(event) => {
              if (!audioBuffer || dragStartRef.current !== null) return;
              const time = toTime(event.clientX);
              setCursor(time);
            }}
          />
        </div>

        <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-3">
          <span>Duration: {duration.toFixed(2)}s</span>
          <span>Cursor: {cursor.toFixed(2)}s</span>
          <span>
            Selection:{" "}
            {effectiveSelection ? `${effectiveSelection.start.toFixed(2)}s → ${effectiveSelection.end.toFixed(2)}s` : "None"}
          </span>
          <span>Zoom: {zoom.toFixed(1)}x</span>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
