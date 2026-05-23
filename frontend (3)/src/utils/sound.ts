const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
let audioCtx: AudioContext | null = null;

const NOTE_FREQS: Record<string, number> = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63,
  'F': 349.23, 'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00,
  'A#': 466.16, 'B': 493.88,
};

export type InstrumentType = 'electric' | 'grand' | 'upright' | 'accordion' | 'flute' | 'harp' | 'saxophone' | 'tabla' | 'trumpet';

interface InstrumentConfig {
  oscType: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gain: number;
  detune?: number;
  useSecondOsc?: boolean;
  secondOscType?: OscillatorType;
  secondOscDetune?: number;
  secondOscGain?: number;
}

const INSTRUMENT_CONFIGS: Record<InstrumentType, InstrumentConfig> = {
  electric: {
    oscType: 'sine',
    attack: 0.01,
    decay: 0.3,
    sustain: 0.4,
    release: 0.8,
    gain: 0.5,
    useSecondOsc: true,
    secondOscType: 'triangle',
    secondOscDetune: 5,
    secondOscGain: 0.2,
  },
  grand: {
    oscType: 'triangle',
    attack: 0.02,
    decay: 0.5,
    sustain: 0.3,
    release: 1.2,
    gain: 0.4,
    useSecondOsc: true,
    secondOscType: 'sine',
    secondOscDetune: -3,
    secondOscGain: 0.15,
  },
  upright: {
    oscType: 'triangle',
    attack: 0.03,
    decay: 0.4,
    sustain: 0.25,
    release: 0.9,
    gain: 0.35,
    detune: 8,
  },
  accordion: {
    oscType: 'sawtooth',
    attack: 0.08,
    decay: 0.1,
    sustain: 0.6,
    release: 0.3,
    gain: 0.25,
    useSecondOsc: true,
    secondOscType: 'square',
    secondOscDetune: 3,
    secondOscGain: 0.1,
  },
  flute: {
    oscType: 'sine',
    attack: 0.12,
    decay: 0.2,
    sustain: 0.7,
    release: 0.4,
    gain: 0.35,
    useSecondOsc: true,
    secondOscType: 'sine',
    secondOscDetune: 1200,
    secondOscGain: 0.05,
  },
  harp: {
    oscType: 'triangle',
    attack: 0.01,
    decay: 0.8,
    sustain: 0.1,
    release: 2.0,
    gain: 0.4,
    useSecondOsc: true,
    secondOscType: 'sine',
    secondOscDetune: 1200,
    secondOscGain: 0.08,
  },
  saxophone: {
    oscType: 'sawtooth',
    attack: 0.06,
    decay: 0.15,
    sustain: 0.5,
    release: 0.5,
    gain: 0.2,
    useSecondOsc: true,
    secondOscType: 'square',
    secondOscDetune: 7,
    secondOscGain: 0.08,
  },
  tabla: {
    oscType: 'triangle',
    attack: 0.005,
    decay: 0.15,
    sustain: 0.05,
    release: 0.3,
    gain: 0.5,
    detune: -1200,
  },
  trumpet: {
    oscType: 'sawtooth',
    attack: 0.04,
    decay: 0.1,
    sustain: 0.6,
    release: 0.3,
    gain: 0.2,
    useSecondOsc: true,
    secondOscType: 'square',
    secondOscDetune: 0,
    secondOscGain: 0.12,
  },
};

let currentInstrument: InstrumentType = (localStorage.getItem('savedInstrument') as InstrumentType) || 'grand';

export const setInstrument = (instrument: InstrumentType) => {
  currentInstrument = instrument;
  localStorage.setItem('savedInstrument', instrument);
};

export const getInstrument = () => currentInstrument;

export const playNote = (noteName: string) => {
  if (!audioCtx) audioCtx = new AudioCtx();

  const match = noteName.match(/^([A-G]#?)(\d)$/);
  if (!match) return;

  const [, note, octave] = match;
  const baseFreq = NOTE_FREQS[note];
  if (!baseFreq) return;
  const freq = baseFreq * Math.pow(2, parseInt(octave) - 4);

  const config = INSTRUMENT_CONFIGS[currentInstrument];
  const now = audioCtx.currentTime;

  const masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  const createOsc = (type: OscillatorType, detune: number, gainVal: number) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (detune) osc.detune.setValueAtTime(detune, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + config.attack);
    gain.gain.linearRampToValueAtTime(gainVal * config.sustain, now + config.attack + config.decay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config.attack + config.decay + config.release);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + config.attack + config.decay + config.release + 0.1);
  };

  createOsc(config.oscType, config.detune || 0, config.gain);

  if (config.useSecondOsc && config.secondOscType) {
    createOsc(config.secondOscType, config.secondOscDetune || 0, config.secondOscGain || 0.1);
  }
};
