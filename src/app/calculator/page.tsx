"use client";

import { useState } from "react";
import { Calculator, Save, TrendingUp, Zap, Clock, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  calculatePrintCost,
  formatBRL,
  formatTime,
  MATERIAL_OPTIONS,
  DEFAULT_PROFIT_MARGIN,
  CostCalculationResult,
} from "@/lib/calculations";
import { addCatalogItem } from "@/lib/firestore";
import { uploadImage } from "@/lib/storage";
import { CalculatorFormData } from "@/lib/types";

export default function CalculatorPage() {
  const [form, setForm] = useState<CalculatorFormData>({
    weightGrams: "",
    material: "PLA",
    required_filaments: [{ id: "1", material: "PLA", weight: "", color: "" }],
    timeHours: "",
    timeMinutes: "",
    profitMarginPercent: String(DEFAULT_PROFIT_MARGIN * 100),
  });
  const [result, setResult] = useState<CostCalculationResult | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pieceName, setPieceName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function handleGenericChange(field: keyof CalculatorFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setResult(null);
  }

  function handleAddFilament() {
    setForm(prev => ({
      ...prev,
      required_filaments: [...prev.required_filaments, { id: Math.random().toString(), material: "PLA", weight: "", color: "" }]
    }));
    setResult(null);
  }

  function handleRemoveFilament(id: string) {
    if (form.required_filaments.length <= 1) return;
    setForm(prev => ({
      ...prev,
      required_filaments: prev.required_filaments.filter(f => f.id !== id)
    }));
    setResult(null);
  }

  function handleFilamentChange(id: string, field: 'material' | 'weight' | 'color', value: string) {
    setForm(prev => ({
      ...prev,
      required_filaments: prev.required_filaments.map(f => f.id === id ? { ...f, [field]: value } : f)
    }));
    setResult(null);
  }

  function handleCalculate() {
    const timeHours = parseInt(form.timeHours || "0", 10);
    const timeMinutes = parseInt(form.timeMinutes || "0", 10);

    if (timeHours === 0 && timeMinutes === 0) return;

    // Convert string inputs to correct types
    const filamentsList = form.required_filaments.map(f => ({
      material: f.material,
      weight_grams: parseFloat(f.weight) || 0,
      color: f.color
    })).filter(f => f.weight_grams > 0);

    if (filamentsList.length === 0) return;

    const calc = calculatePrintCost({
      timeHours,
      timeMinutes,
      filaments: filamentsList,
      profitMarginPercent: parseFloat(form.profitMarginPercent),
    });
    setResult(calc);
  }

  async function handleSave() {
    if (!result || !pieceName.trim()) return;
    setSaving(true);
    try {
      let imageUrl = undefined;
      if (imageFile) {
        const path = `catalog/${Date.now()}_${imageFile.name}`;
        imageUrl = await uploadImage(imageFile, path);
      }

      const filamentsList = form.required_filaments.map(f => ({
        material: f.material,
        weight_grams: parseFloat(f.weight) || 0,
        color: f.color
      })).filter(f => f.weight_grams > 0);

      const totalWeight = filamentsList.reduce((acc, f) => acc + f.weight_grams, 0);

      await addCatalogItem({
        name: pieceName.trim(),
        required_filaments: filamentsList,
        weight_grams: totalWeight, // legacy support 
        material: filamentsList.length === 1 ? filamentsList[0].material : "Múltiplos", // legacy support
        time_minutes: result.timeInMinutes,
        calculated_price: result.suggestedPrice,
        ...(imageUrl && { imageUrl }),
      });
      setSaveSuccess(true);
      setSaveDialogOpen(false);
      setPieceName("");
      setImageFile(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setSaving(false);
    }
  }

  const isFormValid =
    form.required_filaments.every(f => parseFloat(f.weight) > 0) &&
    form.required_filaments.length > 0 &&
    (parseInt(form.timeHours || "0") > 0 ||
      parseInt(form.timeMinutes || "0") > 0);

  const totalCalculatedWeight = form.required_filaments.reduce((acc, f) => acc + (parseFloat(f.weight) || 0), 0);

  return (
    <div className="flex-1 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Calculadora de Custos</h1>
          </div>
          <p className="text-muted-foreground ml-13">Calcule o custo real suportando múltiplas cores e materiais (ex: setup AMS).</p>
        </div>

        {saveSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" /> Peça salva no catálogo com sucesso!
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Dados da Peça</CardTitle>
              <CardDescription>Insira as especificações da impressão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* Dynamic Filaments Array */}
              <div className="space-y-3">
                 <Label>Materiais Utilizados</Label>
                 <div className="space-y-3">
                   {form.required_filaments.map((f, i) => (
                      <div key={f.id} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 items-center p-3 rounded-lg border border-border bg-muted/20">
                         <Select value={f.material} onValueChange={(v) => handleFilamentChange(f.id, "material", v || "")}>
                            <SelectTrigger>
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               {MATERIAL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                         </Select>
                         <Input 
                            placeholder="Cor/Detalhe" 
                            value={f.color} 
                            onChange={(e) => handleFilamentChange(f.id, "color", e.target.value)}
                         />
                         <Input 
                            type="number"
                            placeholder="G"
                            min={0}
                            value={f.weight}
                            onChange={(e) => handleFilamentChange(f.id, "weight", e.target.value)}
                         />
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10" 
                            disabled={form.required_filaments.length === 1}
                            onClick={() => handleRemoveFilament(f.id)}
                         >
                            <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                   ))}
                   <Button variant="outline" size="sm" onClick={handleAddFilament} className="w-full border-dashed">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Cor / Material
                   </Button>
                   <p className="text-right text-xs text-muted-foreground mr-1">Peso Total: <strong>{totalCalculatedWeight}g</strong></p>
                 </div>
              </div>

              {/* Tempo */}
              <div className="space-y-2">
                <Label>Tempo de Impressão</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Horas"
                      min={0}
                      max={99}
                      className="pl-10"
                      value={form.timeHours}
                      onChange={(e) => handleGenericChange("timeHours", e.target.value)}
                    />
                  </div>
                  <Input
                    type="number"
                    placeholder="Minutos"
                    min={0}
                    max={59}
                    value={form.timeMinutes}
                    onChange={(e) => handleGenericChange("timeMinutes", e.target.value)}
                  />
                </div>
              </div>

              {/* Margem de Lucro */}
              <div className="space-y-2">
                <Label htmlFor="margin">Margem de Lucro <span className="text-muted-foreground">(%)</span></Label>
                <div className="relative">
                  <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="margin"
                    type="number"
                    placeholder="60"
                    min={0}
                    max={99}
                    className="pl-10"
                    value={form.profitMarginPercent}
                    onChange={(e) => handleGenericChange("profitMarginPercent", e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleCalculate} disabled={!isFormValid} className="w-full" size="lg">
                <Calculator className="w-4 h-4 mr-2" />
                Calcular Custo
              </Button>
            </CardContent>
          </Card>

          {/* Results Card */}
          <div className="space-y-4">
            {result ? (
              <>
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Detalhamento de Custos</CardTitle>
                    <CardDescription>{formatTime(result.timeInMinutes)} · {totalCalculatedWeight}g Total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <CostRow label="Custo dos Filamentos" value={formatBRL(result.filamentCost)} sub={`${form.required_filaments.length} materiais utilizados`} />
                      <CostRow label="Custo de Máquina" value={formatBRL(result.machineCost)} sub={formatTime(result.timeInMinutes)} />
                      <CostRow label="Buffer de Falhas (5%)" value={formatBRL(result.failureBuffer)} sub="Segurança contra erros" />
                      <div className="border-t border-border pt-3">
                        <CostRow label="Custo Total Base" value={formatBRL(result.totalBaseCost)} bold />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">Preço de Venda Sugerido</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Margem de {result.profitMargin * 100}% aplicada</p>
                      </div>
                      <p className="text-3xl font-bold text-primary">{formatBRL(result.suggestedPrice)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 text-primary"
                  onClick={() => setSaveDialogOpen(true)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar no Catálogo
                </Button>
              </>
            ) : (
              <Card className="border-border border-dashed h-full min-h-[320px] flex items-center justify-center">
                <div className="text-center p-8">
                  <Calculator className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Preencha os dados ao lado e clique em <strong>Calcular Custo</strong> para ver o resultado.</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Save Modal */}
      <ResponsiveModal
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title="Salvar no Catálogo"
        description="Dê um nome e anexe a foto da peça."
      >
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Foto da Peça (Opcional mas Recomendado)</Label>
            <ImageUpload onImageSelected={setImageFile} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="piece-name">Nome da Peça</Label>
            <Input
              id="piece-name"
              placeholder="Ex: Dragão Articulado 3 Cores"
              value={pieceName}
              onChange={(e) => setPieceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          {result && (
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="text-muted-foreground">Preço Sugerido</span>
                <span className="font-bold text-primary">{formatBRL(result.suggestedPrice)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSaveDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button className="w-full sm:w-auto flex-1" onClick={handleSave} disabled={!pieceName.trim() || saving}>
              {saving ? "Salvando..." : "Salvar Peça"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}

interface CostRowProps {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
}

function CostRow({ label, value, sub, bold }: CostRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm ${bold ? "font-semibold text-foreground" : "text-foreground/80"}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className={`text-sm tabular-nums ${bold ? "font-bold text-foreground" : "text-foreground/90"}`}>{value}</p>
    </div>
  );
}

