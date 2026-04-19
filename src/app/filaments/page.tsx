"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Palette,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
  Database,
  TrendingDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { getFilaments, addFilament, deleteFilament, updateFilament } from "@/lib/firestore";
import { Filament } from "@/lib/types";
import { formatBRL, MATERIAL_OPTIONS } from "@/lib/calculations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);

  const [formName, setFormName] = useState("");
  const [formColorName, setFormColorName] = useState("");
  const [formColorHex, setFormColorHex] = useState("#000000");
  const [formMaterial, setFormMaterial] = useState("PLA");
  const [formInitialWeight, setFormInitialWeight] = useState("1000");
  const [formCost, setFormCost] = useState("110");
  const [saving, setSaving] = useState(false);

  const loadFilaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFilaments();
      setFilaments(data);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar bobinas de filamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilaments();
  }, [loadFilaments]);

  function resetForm() {
    setFormName("");
    setFormColorName("");
    setFormColorHex("#000000");
    setFormMaterial("PLA");
    setFormInitialWeight("1000");
    setFormCost("110");
    setSelectedFilament(null);
  }

  function openEdit(filament: Filament) {
    setSelectedFilament(filament);
    setFormName(filament.name);
    setFormColorName(filament.color_name);
    setFormColorHex(filament.color_hex || "#000000");
    setFormMaterial(filament.material);
    setFormInitialWeight(filament.initial_weight_grams.toString());
    setFormCost(filament.cost_brl.toString());
    setUpdateDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formColorName.trim() || !formInitialWeight || !formCost) return;
    const initialWeight = parseInt(formInitialWeight);
    const cost = parseFloat(formCost);
    if (initialWeight <= 0 || cost <= 0) return;

    setSaving(true);
    try {
      if (selectedFilament) {
         // Edição
         await updateFilament(selectedFilament.id, {
            name: formName.trim(),
            color_name: formColorName.trim(),
            color_hex: formColorHex,
            material: formMaterial,
            initial_weight_grams: initialWeight,
            cost_brl: cost,
         });
         setUpdateDialogOpen(false);
      } else {
         // Criação
         await addFilament({
            name: formName.trim(),
            color_name: formColorName.trim(),
            color_hex: formColorHex,
            material: formMaterial,
            initial_weight_grams: initialWeight,
            consumed_weight_grams: 0,
            cost_brl: cost,
          });
          setAddDialogOpen(false);
      }
      resetForm();
      loadFilaments();
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar bobina.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFilament(id);
      setFilaments((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      setError("Falha ao excluir bobina.");
    }
  }

  const totalStockGrams = filaments.reduce(
    (sum, f) => sum + Math.max(0, f.initial_weight_grams - (f.consumed_weight_grams || 0)),
    0
  );

  const totalStockValue = filaments.reduce(
    (sum, f) => {
        const remainingPercentage = Math.max(0, f.initial_weight_grams - (f.consumed_weight_grams || 0)) / f.initial_weight_grams;
        return sum + (f.cost_brl * remainingPercentage);
    },
    0
  );

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Gestão de Filamentos</h1>
            </div>
            <p className="text-muted-foreground">
              Acompanhe seu consumo e controle do estoque físico de bobinas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadFilaments} disabled={loading} className="hidden sm:flex">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setAddDialogOpen(true); }}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova Bobina</span>
            </Button>
          </div>
        </div>

        {/* Summary card */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-xs text-muted-foreground font-medium mb-1">Filamento em Estoque (Total)</p>
              <p className="text-2xl font-bold tabular-nums">{(totalStockGrams / 1000).toFixed(2)} kg</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-xs text-muted-foreground font-medium mb-1">Valor do Físico Atual</p>
              <p className="text-2xl font-bold tabular-nums text-orange-400">{formatBRL(totalStockValue)}</p>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <Card className="border-border">
          <CardHeader className="py-4 border-b border-border/50">
            <CardTitle className="text-base">Bobinas Registradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filaments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <Database className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground mb-1">Seu estoque está vazio</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Cadastre rolos de filamento para rastrear seu consumo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="pl-6">Bobina</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead className="text-right">Progresso</TableHead>
                      <TableHead className="text-right">Restante</TableHead>
                      <TableHead className="text-right pr-6">Custo Original</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaments.map((filament) => {
                      const consumed = filament.consumed_weight_grams || 0;
                      const initial = filament.initial_weight_grams;
                      const remaining = Math.max(0, initial - consumed);
                      const percentage = Math.min(100, Math.round((remaining / initial) * 100));
                      const isLow = percentage <= 15;
                      const isZero = percentage === 0;

                      return (
                      <TableRow key={filament.id} className="border-border cursor-pointer hover:bg-muted/50" onClick={() => openEdit(filament)}>
                        <TableCell className="pl-6 font-medium">
                          {filament.name}
                          {isZero && <Badge variant="outline" className="ml-2 text-[10px] text-red-500 border-red-500/20">Vazio</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {filament.material}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: filament.color_hex || 'transparent' }}></div>
                             <span className="text-sm text-muted-foreground">{filament.color_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex flex-col items-end gap-1.5 w-32 ml-auto">
                              <span className={`text-xs font-semibold tabular-nums ${isLow ? 'text-red-400' : 'text-primary'}`}>{percentage}%</span>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${percentage}%` }}></div>
                              </div>
                           </div>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums ${isLow ? 'text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                          {remaining}g
                        </TableCell>
                        <TableCell className="text-right pr-6 tabular-nums text-muted-foreground">
                          {formatBRL(filament.cost_brl)}
                        </TableCell>
                        <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" />}>
                                <Trash2 className="w-3.5 h-3.5" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Bobina</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza? A bobina <strong>{filament.name}</strong> será removida permanentemente do histórico contábil do seu estoque.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(filament.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Filament Modal */}
      <ResponsiveModal
        open={addDialogOpen || updateDialogOpen}
        onOpenChange={(o) => { 
            if (addDialogOpen) setAddDialogOpen(o); 
            if (updateDialogOpen) setUpdateDialogOpen(o); 
            if (!o) resetForm(); 
        }}
        title={selectedFilament ? "Editar Bobina" : "Cadastrar Nova Bobina"}
        description="Acompanhe o consumo informando as características desta bobina física."
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome Identificador (Apelido)</Label>
            <Input
              placeholder="ex: Preto Esun Lote B"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Nome da Cor</Label>
               <Input
                 placeholder="ex: Preto Galáxia"
                 value={formColorName}
                 onChange={(e) => setFormColorName(e.target.value)}
               />
             </div>
             <div className="space-y-2 flex flex-col">
               <Label>Cor (Opcional - Visual)</Label>
               <div className="flex gap-2 h-9 items-center">
                   <Input 
                      type="color" 
                      value={formColorHex} 
                      onChange={(e) => setFormColorHex(e.target.value)} 
                      className="w-12 p-1 border border-border h-full cursor-pointer"
                   />
                   <span className="text-xs text-muted-foreground uppercase">{formColorHex}</span>
               </div>
             </div>
          </div>

          <div className="space-y-2">
             <Label>Material</Label>
             <Select value={formMaterial} onValueChange={(v) => setFormMaterial(v || "")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
             </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso Inicial (gramas)</Label>
              <Input
                type="number"
                min={1}
                placeholder="ex: 1000"
                value={formInitialWeight}
                onChange={(e) => setFormInitialWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Custo Pago do Rolo (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="ex: 110.00"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setAddDialogOpen(false); setUpdateDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto flex-1"
              onClick={handleSave}
              disabled={!formName.trim() || !formColorName.trim() || !formInitialWeight || !formCost || saving}
            >
              {saving ? "Salvando..." : (selectedFilament ? "Atualizar" : "Cadastrar")}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
