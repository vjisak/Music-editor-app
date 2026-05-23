import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { setInstrument, getInstrument, type InstrumentType, playNote } from "@/utils/sound";

import instElectric from "@/assets/inst-electric.png";
import instGrand from "@/assets/inst-grand.png";
import instUpright from "@/assets/inst-upright.png";
import instAccordion from "@/assets/inst-accordion.png";
import instFlute from "@/assets/inst-flute.png";
import instHarp from "@/assets/inst-harp.png";
import instSaxophone from "@/assets/inst-saxophone.png";
import instTabla from "@/assets/inst-tabla.png";
import instTrumpet from "@/assets/inst-trumpet.png";

const INSTRUMENTS: { id: InstrumentType; name: string; img: string }[] = [
  { id: "electric", name: "Electric Piano", img: instElectric },
  { id: "grand", name: "Grand Piano", img: instGrand },
  { id: "upright", name: "Upright Piano", img: instUpright },
  { id: "accordion", name: "Accordion", img: instAccordion },
  { id: "flute", name: "Flute", img: instFlute },
  { id: "harp", name: "Harp", img: instHarp },
  { id: "saxophone", name: "Saxophone", img: instSaxophone },
  { id: "tabla", name: "Tabla", img: instTabla },
  { id: "trumpet", name: "Trumpet", img: instTrumpet },
];

export default function InstrumentSelection() {
  const [selected, setSelected] = useState<InstrumentType>(getInstrument());
  const navigate = useNavigate();

  const handleSelect = (id: InstrumentType) => {
    setSelected(id);
    playNote("C4");
  };

  const handleChoose = () => {
    setInstrument(selected);
    navigate("/keyboard");
  };

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-10">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate(-1)} className="bg-secondary rounded-full p-3">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-extrabold">Piano</h1>
      </header>

      <div className="flex-1 flex items-center">
        <div className="flex gap-5 overflow-x-auto scrollbar-hide w-full pb-4">
          {INSTRUMENTS.map((inst) => (
            <button
              key={inst.id}
              onClick={() => handleSelect(inst.id)}
              className={`flex-shrink-0 w-44 h-56 rounded-2xl bg-secondary flex flex-col items-center justify-center gap-4 relative transition-all border-2 ${
                selected === inst.id
                  ? "border-primary shadow-lg shadow-primary/20"
                  : "border-transparent hover:border-border"
              }`}
            >
              {selected === inst.id && (
                <div className="absolute top-3 right-3 bg-primary rounded-full p-1">
                  <Check size={14} className="text-primary-foreground" />
                </div>
              )}
              <img
                src={inst.img}
                alt={inst.name}
                className="w-24 h-24 object-contain"
                loading="lazy"
                width={96}
                height={96}
              />
              <p className="font-bold text-sm">{inst.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center py-8">
        <button
          onClick={handleChoose}
          className="bg-primary text-primary-foreground font-extrabold py-4 px-24 rounded-full text-lg"
        >
          Choose
        </button>
      </div>
    </div>
  );
}
