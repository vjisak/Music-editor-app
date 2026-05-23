export interface Song {
  id: number;
  title: string;
  artist: string | null;
  cover_image: string | null;
  instrument: string;
  mood?: string | null;
  notes: any[];
  created_at: string;
}

export interface TranscribedNote {
  time: number;
  duration: number;
  note: string;
  pitch_midi: number;
  frequency: number;
  amplitude: number;
}

export interface TranscriptionResult {
  success: boolean;
  engine: 'basic_pitch' | 'fallback';
  note_count: number;
  bpm: number;
  notes: TranscribedNote[];
  midi_base64: string;
}

const API_BASE_URL = 'http://localhost:4000/api';

export const api = {
  async getSongs(mood?: string | null): Promise<Song[]> {
    let url = `${API_BASE_URL}/songs/`;
    if (mood) {
      url += `?mood=${encodeURIComponent(mood)}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch songs: ${response.statusText}`);
    }
    return response.json();
  },

  async createSong(songData: Partial<Song>): Promise<Song> {
    const response = await fetch(`${API_BASE_URL}/songs/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(songData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create song: ${response.statusText}`);
    }
    return response.json();
  },

  async deleteSong(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/songs/${id}/`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete song: ${response.statusText}`);
    }
  },

  async transcribeAudio(file: File): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('audio', file);

    const response = await fetch(`${API_BASE_URL}/transcribe/`, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type header — browser sets it with the boundary automatically
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `Transcription failed: ${response.statusText}`);
    }

    return data as TranscriptionResult;
  },
};
