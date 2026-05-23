import jsPDF from "jspdf";

export interface NoteItem {
  note: string;
  time: number;
}

export const downloadSongPDF = (title: string, artist: string, notes: NoteItem[]) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  let y = 30;

  // Title
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text("Musical Transcription", pageWidth / 2, y, { align: "center" });
  y += 12;

  pdf.setFontSize(14);
  pdf.text(title, pageWidth / 2, y, { align: "center" });
  y += 8;

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Composer: ${artist}`, pageWidth / 2, y, { align: "center" });
  y += 8;
  pdf.text(`Total notes detected: ${notes.length}`, pageWidth / 2, y, { align: "center" });
  y += 15;

  // Table header
  const cols = [margin, margin + 40, margin + 100];
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setFillColor(40, 40, 40);
  pdf.rect(margin, y - 5, pageWidth - margin * 2, 8, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.text("#", cols[0] + 5, y);
  pdf.text("Note / Key", cols[1], y);
  pdf.text("Time Marker (s)", cols[2], y);
  pdf.setTextColor(0, 0, 0);
  y += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  notes.forEach((note, idx) => {
    if (y > 275) {
      pdf.addPage();
      y = 20;
    }

    if (idx % 2 === 0) {
      pdf.setFillColor(248, 248, 248);
      pdf.rect(margin, y - 4, pageWidth - margin * 2, 6, "F");
    }

    pdf.text(`${idx + 1}`, cols[0] + 5, y);
    pdf.text(note.note, cols[1], y);
    pdf.text(note.time.toFixed(2), cols[2], y);
    y += 7;
  });

  // Note sequence summary
  if (y > 240) { pdf.addPage(); y = 20; }
  y += 15;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Melody Sequence", margin, y);
  y += 10;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const sequence = notes.map(n => n.note).join("  ");
  const lines = pdf.splitTextToSize(sequence, pageWidth - margin * 2);
  for (const line of lines) {
    if (y > 280) { pdf.addPage(); y = 20; }
    pdf.text(line, margin, y);
    y += 6;
  }

  pdf.save(`${title.replace(/\s+/g, '_')}_transcription.pdf`);
};
