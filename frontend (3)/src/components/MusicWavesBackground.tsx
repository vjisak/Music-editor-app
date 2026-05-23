import { useEffect, useRef, useState, type CSSProperties } from "react";

type WavePulse = {
  id: number;
  duration: number;
  peakScale: number;
  repelScale: number;
  opacity: number;
  x: number;
  y: number;
  packetSize: number;
};

export default function MusicWavesBackground() {
  const [pulse, setPulse] = useState<WavePulse | null>(null);
  const idRef = useRef(1);
  const spawnTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const randomEdgeOrigin = () => {
      const side = Math.floor(Math.random() * 4);
      const span = 4 + Math.random() * 92;
      const inset = Math.random() * 3;

      if (side === 0) return { x: span, y: inset }; // top
      if (side === 1) return { x: span, y: 100 - inset }; // bottom
      if (side === 2) return { x: inset, y: span }; // left
      return { x: 100 - inset, y: span }; // right
    };

    const spawnPulse = () => {
      const id = idRef.current++;
      const duration = 5.2 + Math.random() * 1.8;
      const peakScale = 108 + Math.random() * 20;
      const repelScale = peakScale - (8 + Math.random() * 10);
      const opacity = 0.06 + Math.random() * 0.08;
      const packetSize = 3 + Math.floor(Math.random() * 2);
      const origin = randomEdgeOrigin();

      setPulse({ id, duration, peakScale, repelScale, opacity, x: origin.x, y: origin.y, packetSize });

      const nextDelay = duration * 1000 + 350 + Math.random() * 900;
      spawnTimerRef.current = window.setTimeout(spawnPulse, nextDelay);
    };

    spawnPulse();

    return () => {
      if (spawnTimerRef.current) {
        window.clearTimeout(spawnTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="music-waves-bg" aria-hidden="true">
      {pulse && (
        Array.from({ length: pulse.packetSize }).map((_, layerIndex) => (
          <span
            key={`${pulse.id}-${layerIndex}`}
            className="music-free-wave"
            style={
              {
                left: `${pulse.x}%`,
                top: `${pulse.y}%`,
                "--wave-duration": `${pulse.duration}s`,
                "--wave-peak-scale": pulse.peakScale - layerIndex * 4,
                "--wave-repel-scale": pulse.repelScale - layerIndex * 3,
                "--wave-opacity": Math.max(0.03, pulse.opacity - layerIndex * 0.012),
                "--wave-delay": `${layerIndex * 0.24}s`,
              } as CSSProperties
            }
          />
        ))
      )}
    </div>
  );
}
