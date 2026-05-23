import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

from music_app.models import Song

def notes_from_sequence(sequence, step=0.5, start=0.0):
    return [{"note": note, "time": round(start + index * step, 2)} for index, note in enumerate(sequence)]

SONGS_TO_SEED = [
    {
        "title": "Clair de Lune",
        "artist": "Claude Debussy",
        "instrument": "Keyboard",
        "mood": "calm",
        "notes": notes_from_sequence(["D4", "A4", "D5", "F5", "A5", "F5", "E5", "D5"], step=0.75),
    },
    {
        "title": "Für Elise",
        "artist": "Ludwig van Beethoven",
        "instrument": "Keyboard",
        "mood": "mind",
        "notes": notes_from_sequence(["E5", "D#5", "E5", "D#5", "E5", "B4", "D5", "C5", "A4"], step=0.4),
    },
    {
        "title": "Turkish March",
        "artist": "Wolfgang Amadeus Mozart",
        "instrument": "Keyboard",
        "mood": "focus",
        "notes": notes_from_sequence(
            ["B4", "A4", "G#4", "A4", "C5", "B4", "A#4", "B4", "D5", "C5", "B4", "C5", "E5", "D5", "C#5", "D5"],
            step=0.25,
        ),
    },
    {
        "title": "Canon in D",
        "artist": "Johann Pachelbel",
        "instrument": "Keyboard",
        "mood": "soft",
        "notes": notes_from_sequence(["F#5", "E5", "D5", "C#5", "B4", "A4", "B4", "C#5", "D5", "C#5", "B4", "A4"]),
    },
    {
        "title": "Gymnopédie No. 1",
        "artist": "Erik Satie",
        "instrument": "Keyboard",
        "mood": "calm",
        "notes": notes_from_sequence(["G4", "B4", "D5", "F#5", "A5", "F#5", "D5", "B4"], step=0.8),
    },
    {
        "title": "River Flows in You",
        "artist": "Yiruma",
        "instrument": "Keyboard",
        "mood": "night",
        "notes": notes_from_sequence(["A4", "E5", "A5", "B5", "C6", "B5", "A5", "E5"], step=0.45),
    },
    {
        "title": "Kiss the Rain",
        "artist": "Yiruma",
        "instrument": "Keyboard",
        "mood": "soft",
        "notes": notes_from_sequence(["E4", "A4", "B4", "C5", "D5", "C5", "B4", "A4"], step=0.55),
    },
    {
        "title": "Nocturne Op.9 No.2",
        "artist": "Frédéric Chopin",
        "instrument": "Keyboard",
        "mood": "night",
        "notes": notes_from_sequence(["E5", "G#5", "B5", "E6", "D#6", "B5", "G#5", "F#5"], step=0.6),
    },
    {
        "title": "Moonlight Sonata",
        "artist": "Ludwig van Beethoven",
        "instrument": "Keyboard",
        "mood": "night",
        "notes": notes_from_sequence(["C#4", "E4", "G#4", "C#5", "E5", "G#5", "E5", "C#5"], step=0.5),
    },
    {
        "title": "Prelude in C Major",
        "artist": "J. S. Bach",
        "instrument": "Keyboard",
        "mood": "mind",
        "notes": notes_from_sequence(["C4", "E4", "G4", "C5", "E5", "G5", "E5", "C5"], step=0.35),
    },
    {
        "title": "Comptine d'un autre été",
        "artist": "Yann Tiersen",
        "instrument": "Keyboard",
        "mood": "calm",
        "notes": notes_from_sequence(["E4", "B4", "E5", "G5", "F#5", "E5", "B4", "E4"], step=0.5),
    },
    {
        "title": "The Entertainer",
        "artist": "Scott Joplin",
        "instrument": "Keyboard",
        "mood": "focus",
        "notes": notes_from_sequence(["D4", "D#4", "E4", "C5", "E4", "C5", "E5", "C5"], step=0.3),
    },
    {
        "title": "Amazing Grace",
        "artist": "Traditional",
        "instrument": "Flute",
        "mood": "soft",
        "notes": notes_from_sequence(["G4", "C5", "E5", "C5", "E5", "D5", "C5", "A4"], step=0.7),
    },
    {
        "title": "Autumn Leaves",
        "artist": "Joseph Kosma",
        "instrument": "Saxophone",
        "mood": "mind",
        "notes": notes_from_sequence(["A4", "D5", "F5", "G5", "E5", "D5", "C5", "A4"], step=0.55),
    },
    {
        "title": "Greensleeves",
        "artist": "Traditional",
        "instrument": "Harp",
        "mood": "calm",
        "notes": notes_from_sequence(["A4", "C5", "D5", "E5", "F5", "E5", "D5", "C5"], step=0.65),
    },
]

def seed():
    count = 0
    for song_data in SONGS_TO_SEED:
        song, created = Song.objects.update_or_create(
            title=song_data["title"],
            defaults={
                "artist": song_data["artist"],
                "instrument": song_data["instrument"],
                "mood": song_data.get("mood"),
                "notes": song_data["notes"],
            }
        )
        count += 1
    
    print(f"Successfully processed {count} songs!")

if __name__ == '__main__':
    seed()
