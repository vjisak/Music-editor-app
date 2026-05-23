import { useCallback } from "react";
import { playNote } from "@/utils/sound";

const OCTAVE_NOTES = [
  { note: "C", black: false },
  { note: "C#", black: true },
  { note: "D", black: false },
  { note: "D#", black: true },
  { note: "E", black: false },
  { note: "F", black: false },
  { note: "F#", black: true },
  { note: "G", black: false },
  { note: "G#", black: true },
  { note: "A", black: false },
  { note: "A#", black: true },
  { note: "B", black: false },
];

interface PianoKeyboardProps {
  octaves?: number;
  startOctave?: number;
  onNotePlay?: (noteName: string) => void;
}

export default function PianoKeyboard({ octaves = 2, startOctave = 3, onNotePlay }: PianoKeyboardProps) {
  const handlePlay = useCallback((noteName: string) => {
    playNote(noteName);
    onNotePlay?.(noteName);
  }, [onNotePlay]);

  const whiteKeys: { note: string; keyName: string; index: number }[] = [];
  const blackKeys: { note: string; keyName: string; whiteIndex: number }[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    const octaveNum = startOctave + oct;
    let whiteCount = whiteKeys.length;
    OCTAVE_NOTES.forEach((n) => {
      const keyName = `${n.note}${octaveNum}`;
      if (!n.black) {
        whiteKeys.push({ note: n.note, keyName, index: whiteCount });
        whiteCount++;
      } else {
        blackKeys.push({ note: n.note, keyName, whiteIndex: whiteCount - 1 });
      }
    });
  }

  const totalWhite = whiteKeys.length;

  return (
    <div className="relative w-full" style={{ height: "100%" }}>
      {/* White keys */}
      <div className="flex h-full">
        {whiteKeys.map((k) => (
          <button
            key={k.keyName}
            onPointerDown={() => handlePlay(k.keyName)}
            className="relative flex-1 border-r border-border/30 rounded-b-lg active:brightness-90 transition-all"
            style={{
              background: "linear-gradient(to bottom, #ffffff 0%, #e8e8e8 100%)",
            }}
          />
        ))}
      </div>
      {/* Black keys */}
      {blackKeys.map((k) => {
        const leftPercent = ((k.whiteIndex + 0.65) / totalWhite) * 100;
        const widthPercent = (0.7 / totalWhite) * 100;
        return (
          <button
            key={k.keyName}
            onPointerDown={() => handlePlay(k.keyName)}
            className="absolute top-0 rounded-b-md active:brightness-125 transition-all z-10"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              height: "62%",
              background: "linear-gradient(to bottom, #333 0%, #111 100%)",
              boxShadow: "2px 4px 8px rgba(0,0,0,0.6)",
            }}
          />
        );
      })}
    </div>
  );
}
