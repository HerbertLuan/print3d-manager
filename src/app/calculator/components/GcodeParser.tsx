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

// ─── Regex Patterns (Bambu Studio G-code) ─────────────────────────────────────

/**
 * Matches lines such as:
 *   ; filament used [g] = 12.34
 *   ; total filament used [g] = 12.34
 */
const WEIGHT_REGEX =
  /;\s*(?:total\s+)?filament\s+used\s*\[g\]\s*=\s*([\d.]+)/i;

/**
 * Matches the Bambu Studio time line, e.g.:
 *   ; estimated printing time (normal mode) = 1h 25m 30s
 *   ; estimated printing time (normal mode) = 45m 12s
 *   ; estimated printing time (normal mode) = 2h 3m
 *   ; estimated printing time = 1h 30m
 * Captures optional hours, optional minutes, optional seconds.
 */
const TIME_REGEX =
  /;\s*estimated printing time(?:\s*\([^)]*\))?\s*=\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseGcode(text: string): GcodeData | null {
  const weightMatch = text.match(WEIGHT_REGEX);
  const timeMatch = text.match(TIME_REGEX);

  if (!weightMatch && !timeMatch) return null;

  const weightInGrams = weightMatch ? parseFloat(weightMatch[1]) : 0;

  const hours = timeMatch?.[1] ? parseInt(timeMatch[1], 10) : 0;
  const minutes = timeMatch?.[2] ? parseInt(timeMatch[2], 10) : 0;
  const seconds = timeMatch?.[3] ? parseInt(timeMatch[3], 10) : 0;
  const timeInHours = hours + minutes / 60 + seconds / 3600;

  return {
    weightInGrams: Math.round(weightInGrams * 100) / 100,
    timeInHours: Math.round(timeInHours * 100) / 100,
  };
}

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
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".gcode")) {
        toast.error("Formato inválido", {
          description: "Apenas arquivos .gcode do Bambu Studio são aceitos.",
        });
        return;
      }

      setIsReading(true);
      setFileName(file.name);

      const reader = new FileReader();

      reader.onload = (e) => {
        const text = e.target?.result as string;
        const data = parseGcode(text);

        if (!data || (data.weightInGrams === 0 && data.timeInHours === 0)) {
          toast.error("Metadados não encontrados", {
            description:
              "Não foi possível extrair peso e tempo. Verifique se o arquivo foi gerado pelo Bambu Studio.",
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
      };

      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo", {
          description: "Não foi possível ler o arquivo. Tente novamente.",
        });
        setIsReading(false);
        setFileName("");
      };

      reader.readAsText(file, "utf-8");
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
      // Reset input so the same file can be re-selected after clearing
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
      <SuccessState
        data={parsedData}
        fileName={fileName}
        onClear={handleClear}
      />
    );
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".gcode"
        className="sr-only"
        onChange={handleFileInputChange}
        aria-label="Selecionar arquivo .gcode"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={isReading}
        aria-label="Área de drag and drop para arquivo .gcode"
        className={[
          "w-full rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer",
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
            isDragOver
              ? "bg-primary/20 text-primary"
              : "bg-white/5 text-white/40",
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
              ? `Lendo ${fileName}…`
              : isDragOver
              ? "Solte o arquivo aqui"
              : "Arraste o arquivo .gcode do Bambu Studio aqui"}
          </p>
          {!isReading && (
            <p className="text-xs text-white/30">
              ou{" "}
              <span className="underline underline-offset-2 text-white/50">
                clique para selecionar
              </span>
            </p>
          )}
        </div>

        {/* Animated border glow on drag over */}
        {isDragOver && (
          <div className="absolute inset-0 rounded-xl pointer-events-none ring-2 ring-primary/40 ring-offset-0 animate-pulse" />
        )}
      </button>
    </>
  );
}

// ─── Success State Sub-component ──────────────────────────────────────────────

interface SuccessStateProps {
  data: GcodeData;
  fileName: string;
  onClear: () => void;
}

function SuccessState({ data, fileName, onClear }: SuccessStateProps) {
  return (
    <div className="w-full rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Check icon */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
        <CheckCircle2 className="w-5 h-5" />
      </div>

      {/* Data */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-400/70 font-medium truncate mb-1">
          {fileName}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Pill label="Peso" value={`${data.weightInGrams}g`} />
          <span className="text-white/20 text-xs">·</span>
          <Pill
            label="Tempo"
            value={`${formatDecimalTime(data.timeInHours)} (${data.timeInHours}h)`}
          />
        </div>
      </div>

      {/* Clear button */}
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

// ─── Pill ─────────────────────────────────────────────────────────────────────

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
