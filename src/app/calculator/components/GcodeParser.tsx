"use client";

import { useCallback, useRef, useState } from "react";
import { Printer, FileCode2, CheckCircle2, X, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GcodeData {
  weightInGrams: number;
  timeInHours: number;
}

interface GcodeParserProps {
  onDataExtracted: (data: GcodeData) => void;
}

// ─── File Format Detection ────────────────────────────────────────────────────

function is3mfFile(name: string): boolean {
  return name.toLowerCase().endsWith(".3mf");
}

function isGcodeFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".gcode") || lower.endsWith(".gcode.3mf");
}

// ─── Regex Patterns (Bambu Studio real output) ───────────────────────────────

/**
 * Bambu Studio (AMS multi-filament) format:
 *   ; total filament weight [g] : 56.51,1.96,1.76
 * The first value is the dominant filament. We sum all values.
 *
 * Also matches older single-extruder format:
 *   ; filament used [g] = 12.34
 *   ; total filament used [g] = 12.34
 */
const WEIGHT_MULTI_REGEX =
  /;\s*total\s+filament\s+weight\s*\[g\]\s*[=:]\s*([\d.,]+)/i;

const WEIGHT_LEGACY_REGEX =
  /;\s*(?:total\s+)?filament\s+(?:used|weight)\s*\[g\]\s*[=:]\s*([\d.]+)/i;

/**
 * Bambu Studio packs both times on one line:
 *   ; model printing time: 3h 43m 28s; total estimated time: 3h 50m 37s
 *
 * We prefer "total estimated time" and fall back to "model printing time".
 *
 * Also matches:
 *   ; estimated printing time (normal mode) = 1h 25m 30s
 *   ; estimated printing time = 45m 12s
 */
const TIME_TOTAL_REGEX =
  /total\s+estimated\s+time[=:\s]+(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i;

const TIME_MODEL_REGEX =
  /model\s+printing\s+time[=:\s]+(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i;

const TIME_LEGACY_REGEX =
  /;\s*estimated\s+printing\s+time(?:\s*\([^)]*\))?\s*[=:]\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i;

// ─── Core Parser ──────────────────────────────────────────────────────────────

function parseGcodeText(text: string): GcodeData | null {
  // --- Weight ---
  let weightInGrams = 0;

  const multiMatch = text.match(WEIGHT_MULTI_REGEX);
  if (multiMatch) {
    // Sum all comma-separated weights (e.g. "56.51,1.96,1.76" → 60.23)
    weightInGrams = multiMatch[1]
      .split(",")
      .reduce((sum, v) => sum + (parseFloat(v.trim()) || 0), 0);
  } else {
    const legacyMatch = text.match(WEIGHT_LEGACY_REGEX);
    if (legacyMatch) weightInGrams = parseFloat(legacyMatch[1]);
  }

  // --- Time ---
  function matchToHours(m: RegExpMatchArray | null): number {
    if (!m) return 0;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const s = m[3] ? parseInt(m[3], 10) : 0;
    return h + min / 60 + s / 3600;
  }

  let timeInHours =
    matchToHours(text.match(TIME_TOTAL_REGEX)) ||
    matchToHours(text.match(TIME_MODEL_REGEX)) ||
    matchToHours(text.match(TIME_LEGACY_REGEX));

  if (weightInGrams === 0 && timeInHours === 0) return null;

  return {
    weightInGrams: Math.round(weightInGrams * 100) / 100,
    timeInHours: Math.round(timeInHours * 100) / 100,
  };
}

// ─── ZIP / 3MF Extraction ────────────────────────────────────────────────────

/**
 * Reads a .3mf file (ZIP container) using the native DecompressionStream API
 * available in modern browsers — no external library needed.
 *
 * 3MF stores the G-code slice at:  Metadata/plate_1.gcode  (or plate_N.gcode)
 *
 * We scan the ZIP central directory to find it, then inflate the entry.
 */
async function extractGcodeFrom3mf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Find ZIP End-of-Central-Directory record (signature 0x06054b50)
  // Walk backwards from end of file
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("EOCD record not found — not a valid ZIP.");

  const view = new DataView(buffer);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  // Walk the Central Directory and find all plate_N.gcode entries
  const decoder = new TextDecoder("utf-8");
  let pos = cdOffset;
  let gcodeEntries: { name: string; localOffset: number; compressedSize: number; method: number }[] = [];

  while (pos < cdOffset + cdSize) {
    if (
      bytes[pos] !== 0x50 ||
      bytes[pos + 1] !== 0x4b ||
      bytes[pos + 2] !== 0x01 ||
      bytes[pos + 3] !== 0x02
    )
      break;

    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const fileNameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.slice(pos + 46, pos + 46 + fileNameLen));

    if (/Metadata\/plate_\d+\.gcode$/i.test(name)) {
      gcodeEntries.push({ name, localOffset, compressedSize, method });
    }

    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  if (gcodeEntries.length === 0) {
    throw new Error("Nenhum arquivo .gcode encontrado dentro do .3mf.");
  }

  // Sort: plate_1 first
  gcodeEntries.sort((a, b) => a.name.localeCompare(b.name));
  const entry = gcodeEntries[0];

  // Navigate to local file header to get actual data offset
  const localHeaderPos = entry.localOffset;
  const localFileNameLen = view.getUint16(localHeaderPos + 26, true);
  const localExtraLen = view.getUint16(localHeaderPos + 28, true);
  const dataStart = localHeaderPos + 30 + localFileNameLen + localExtraLen;

  const compressedData = bytes.slice(dataStart, dataStart + entry.compressedSize);

  // Method 0 = stored (no compression), Method 8 = deflated
  if (entry.method === 0) {
    return decoder.decode(compressedData);
  } else if (entry.method === 8) {
    // Use native DecompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+)
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compressedData);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return decoder.decode(out);
  } else {
    throw new Error(`Método de compressão ZIP não suportado: ${entry.method}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDecimalTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GcodeParser({ onDataExtracted }: GcodeParserProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [parsedData, setParsedData] = useState<GcodeData | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File Processing ──────────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      if (!isGcodeFile(file.name)) {
        toast.error("Formato inválido", {
          description:
            "Aceito apenas arquivos .gcode ou .gcode.3mf exportados pelo Bambu Studio.",
        });
        return;
      }

      setIsReading(true);
      setFileName(file.name);

      try {
        let gcodeText: string;

        if (is3mfFile(file.name)) {
          // .3mf → unzip → extract Metadata/plate_1.gcode
          gcodeText = await extractGcodeFrom3mf(file);
        } else {
          // Plain .gcode → read as text
          gcodeText = await file.text();
        }

        const data = parseGcodeText(gcodeText);

        if (!data) {
          toast.error("Metadados não encontrados", {
            description:
              "Não foi possível extrair peso e tempo. Verifique se o fatiamento foi concluído no Bambu Studio.",
          });
          setIsReading(false);
          setFileName("");
          return;
        }

        setParsedData(data);
        setIsReading(false);
        onDataExtracted(data);

        toast.success("G-code lido com sucesso!", {
          description: `${data.weightInGrams}g · ${formatDecimalTime(data.timeInHours)}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Falha ao processar o arquivo", { description: message });
        setIsReading(false);
        setFileName("");
      }
    },
    [onDataExtracted]
  );

  // ── Drag & Drop Handlers ──────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const handleClear = useCallback(() => {
    setParsedData(null);
    setFileName("");
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (parsedData) {
    return (
      <SuccessState data={parsedData} fileName={fileName} onClear={handleClear} />
    );
  }

  return (
    <>
      {/* Hidden file input — accepts both plain gcode and 3mf containers */}
      <input
        ref={inputRef}
        type="file"
        accept=".gcode,.3mf"
        className="sr-only"
        onChange={handleFileInputChange}
        aria-label="Selecionar arquivo .gcode ou .3mf"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={isReading}
        aria-label="Área de drag and drop para arquivo .gcode ou .3mf"
        className={[
          "relative w-full rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer",
          "flex flex-col items-center justify-center gap-3 py-8 px-6 text-center",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-60",
          isDragOver
            ? "border-primary/70 bg-primary/10 scale-[1.01] shadow-lg shadow-primary/10"
            : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]",
        ].join(" ")}
      >
        {/* Icon cluster */}
        <div
          className={[
            "relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300",
            isDragOver ? "bg-primary/20 text-primary" : "bg-white/5 text-white/40",
          ].join(" ")}
        >
          {isReading ? (
            <span className="animate-spin text-primary">
              <svg
                className="w-7 h-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </span>
          ) : isDragOver ? (
            <UploadCloud className="w-7 h-7" />
          ) : (
            <>
              <Printer className="w-7 h-7" />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-white/15 flex items-center justify-center">
                <FileCode2 className="w-3 h-3 text-white/50" />
              </span>
            </>
          )}
        </div>

        {/* Text */}
        <div className="space-y-1">
          <p
            className={[
              "text-sm font-medium transition-colors duration-200",
              isDragOver ? "text-primary" : "text-white/70",
            ].join(" ")}
          >
            {isReading
              ? `Processando ${fileName}…`
              : isDragOver
              ? "Solte o arquivo aqui"
              : "Arraste o arquivo do Bambu Studio aqui"}
          </p>
          {!isReading && (
            <p className="text-xs text-white/30">
              Suporta{" "}
              <span className="text-white/50 font-mono">.gcode</span> e{" "}
              <span className="text-white/50 font-mono">.gcode.3mf</span>
              {" · "}
              <span className="underline underline-offset-2 text-white/40">
                clique para selecionar
              </span>
            </p>
          )}
        </div>

        {/* Animated glow on drag */}
        {isDragOver && (
          <div className="absolute inset-0 rounded-xl pointer-events-none ring-2 ring-primary/40 animate-pulse" />
        )}
      </button>
    </>
  );
}

// ─── Success State ────────────────────────────────────────────────────────────

interface SuccessStateProps {
  data: GcodeData;
  fileName: string;
  onClear: () => void;
}

function SuccessState({ data, fileName, onClear }: SuccessStateProps) {
  return (
    <div className="w-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
        <CheckCircle2 className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-400/70 font-medium truncate mb-1">
          {fileName}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Pill label="Peso Total" value={`${data.weightInGrams}g`} />
          <span className="text-white/20 text-xs">·</span>
          <Pill
            label="Tempo"
            value={`${formatDecimalTime(data.timeInHours)} (${data.timeInHours}h)`}
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 w-8 h-8 text-white/30 hover:text-white/70 hover:bg-white/5 rounded-lg"
        onClick={onClear}
        aria-label="Limpar e ler outro arquivo"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-white/30">{label}</span>
      <span className="text-sm font-semibold text-emerald-300 tabular-nums">
        {value}
      </span>
    </div>
  );
}
