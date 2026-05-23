import os
import io
import base64
import tempfile
import pathlib
import logging

from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt

from .models import Song
from .serializers import SongSerializer

logger = logging.getLogger(__name__)

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


class SongViewSet(viewsets.ModelViewSet):
    queryset = Song.objects.all().order_by('-created_at')
    serializer_class = SongSerializer


def midi_to_base64(midi_data) -> str:
    """Serialize a pretty_midi object to a base64 encoded MIDI string."""
    buf = io.BytesIO()
    midi_data.write(buf)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


@api_view(['POST'])
@csrf_exempt
def transcribe_audio(request):
    """
    POST /api/transcribe/
    Accepts an audio file upload, runs Spotify Basic Pitch inference,
    and returns note events + base64 MIDI data.
    """
    if 'audio' not in request.FILES:
        return Response({'error': 'No audio file provided. Use key "audio".'}, status=status.HTTP_400_BAD_REQUEST)

    audio_file = request.FILES['audio']

    # Validate file type
    allowed_extensions = {'.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aiff', '.aac'}
    ext = os.path.splitext(audio_file.name)[1].lower()
    if ext not in allowed_extensions:
        return Response(
            {'error': f'Unsupported file type: {ext}. Supported: {", ".join(allowed_extensions)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Write uploaded file to a temp location
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        for chunk in audio_file.chunks():
            tmp.write(chunk)
        tmp_path = pathlib.Path(tmp.name)

    try:
        # Import Basic Pitch here (lazy) to avoid slow startup
        from basic_pitch.inference import predict, DEFAULT_ONSET_THRESHOLD, DEFAULT_FRAME_THRESHOLD
        from basic_pitch import ICASSP_2022_MODEL_PATH

        logger.info(f"Running Basic Pitch on: {tmp_path}")

        # Run prediction
        _model_output, midi_data, note_events = predict(
            audio_path=tmp_path,
            onset_threshold=DEFAULT_ONSET_THRESHOLD,
            frame_threshold=DEFAULT_FRAME_THRESHOLD,
            minimum_note_length=127.7,
            melodia_trick=True,
        )

        # Convert note_events to JSON-serializable format
        # note_events: list of (start_time_s, end_time_s, pitch_midi, amplitude, pitch_bend_list)
        notes = []
        for start_time, end_time, pitch_midi, amplitude, _pitch_bends in note_events:
            note_name = NOTE_NAMES[int(pitch_midi) % 12]
            octave = int(pitch_midi) // 12 - 1
            frequency = round(440.0 * (2 ** ((int(pitch_midi) - 69) / 12)), 2)
            notes.append({
                "time": round(float(start_time), 4),
                "duration": round(float(end_time) - float(start_time), 4),
                "note": f"{note_name}{octave}",
                "pitch_midi": int(pitch_midi),
                "frequency": frequency,
                "amplitude": round(float(amplitude), 4),
            })

        # Estimate BPM from midi tempo (pretty_midi)
        estimated_bpm = 120
        try:
            tempo_change_times, tempos = midi_data.get_tempo_changes()
            if len(tempos) > 0:
                estimated_bpm = round(float(tempos[0]))
        except Exception:
            pass

        # Encode MIDI to base64
        midi_b64 = midi_to_base64(midi_data)

        return Response({
            'success': True,
            'engine': 'basic_pitch',
            'note_count': len(notes),
            'bpm': estimated_bpm,
            'notes': notes,
            'midi_base64': midi_b64,
        })

    except ImportError as e:
        logger.error(f"Basic Pitch import error: {e}")
        return Response(
            {'error': 'Basic Pitch library is not installed on the server. Please install it via pip.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.exception(f"Transcription failed: {e}")
        return Response(
            {'error': f'Transcription failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    finally:
        # Always clean up the temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
