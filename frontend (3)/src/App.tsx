import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import KeyboardPage from "./pages/KeyboardPage";
import GroovePadPage from "./pages/GroovePadPage";
import MusicEditorPage from "./pages/MusicEditorPage";
import InstrumentSelection from "./pages/InstrumentSelection";
import Moods from "./pages/Moods";
import Trophies from "./pages/Trophies";
import NotFound from "./pages/NotFound";
import Transcribe from "./pages/Transcribe";
import MusicWavesBackground from "./components/MusicWavesBackground";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="relative min-h-screen overflow-x-hidden">
          <MusicWavesBackground />
          <div className="relative z-10">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/moods" element={<Moods />} />
              <Route path="/trophies" element={<Trophies />} />
              <Route path="/keyboard" element={<KeyboardPage />} />
              <Route path="/groove-pad" element={<GroovePadPage />} />
              <Route path="/editor" element={<MusicEditorPage />} />
              <Route path="/selection" element={<InstrumentSelection />} />
              <Route path="/transcribe" element={<Transcribe />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
