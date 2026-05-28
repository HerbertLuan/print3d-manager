"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { Calculator, Save, TrendingUp, Zap, Clock, Plus, Trash2, ShoppingCart, CheckCircle2, Tag, Sparkles, Users } from "lucide-react";
import { GcodeParser, GcodeData } from "./components/GcodeParser";
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
  calculateBatchTimeAndCost,
  formatBRL,
  formatTime,
  MATERIAL_OPTIONS,
  DEFAULT_PROFIT_MARGIN,
  CostCalculationResult,
} from "@/lib/calculations";
import { addCatalogItem, addOrder, getSupplies, getCatalogItems, getActivePartners } from "@/lib/firestore";
import { uploadImage } from "@/lib/storage";
import { CalculatorFormData, Supply, SelectedSupply, CatalogItem, Partner } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";

function normalizeItem(item: CatalogItem): { material: string; weight_grams: number } {
  const rf = item.required_filaments;
  if (Array.isArray(rf) && rf.length > 0) {
    return { material: rf[0].material ?? "PLA", weight_grams: rf[0].weight_grams ?? 0 };
  }
  return { material: item.material ?? "PLA", weight_grams: item.weight_grams ?? 0 };
}

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

  // ── Gerar Pedido state ──
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderPieceName, setOrderPieceName] = useState("");
  const [orderClientName, setOrderClientName] = useState("");
  const [orderSalePrice, setOrderSalePrice] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderPartnerId, setOrderPartnerId] = useState("");

  // ── Insumos state ──
  const [availableSupplies, setAvailableSupplies] = useState<Supply[]>([]);
  const [selectedSupplies, setSelectedSupplies] = useState<Record<string, number>>({});

  // ── Produtos Catalogados state ──
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [pickItemId, setPickItemId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [extraLineItems, setExtraLineItems] = useState<{
    item: CatalogItem;
    qty: number;
    unitPrice: number;
    batchStats: ReturnType<typeof calculateBatchTimeAndCost>;
  }[]>([]);

  // ── Parceiros ──
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    getSupplies().then(setAvailableSupplies).catch(console.error);
    getCatalogItems().then(setCatalogItems).catch(console.error);
    getActivePartners().then(setPartners).catch(console.error);
  }, []);

  const handleGcodeData = useCallback((data: GcodeData) => {
    const totalHours = Math.floor(data.timeInHours);
    const totalMinutes = Math.round((data.timeInHours - totalHours) * 60);
    setForm((prev) => ({
      ...prev,
      timeHours: String(totalHours),
      timeMinutes: String(totalMinutes),
      required_filaments: prev.required_filaments.map((f, i) =>
        i === 0 ? { ...f, weight: String(data.weightInGrams) } : f
      ),
    }));
    setResult(null);
  }, []);

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

  const suppliesCostTotal = useMemo(() => {
    return Object.entries(selectedSupplies).reduce((sum, [id, qty]) => {
      const supply = availableSupplies.find(s => s.id === id);
      return sum + (supply ? supply.unit_cost * qty : 0);
    }, 0);
  }, [selectedSupplies, availableSupplies]);

  const extraItemsCostTotal = useMemo(() => {
    let batchTotalFilamentCost = 0;
    let batchTotalMachineCost = 0;
    let batchTimeInMinutes = 0;
    let suggestedPrice = 0;

    for (const line of extraLineItems) {
      batchTotalFilamentCost += line.batchStats.batchTotalFilamentCost;
      batchTotalMachineCost += line.batchStats.batchTotalMachineCost;
      batchTimeInMinutes += line.batchStats.batchTimeInMinutes;
      suggestedPrice += line.unitPrice * line.qty;
    }

    return {
      batchTotalFilamentCost,
      batchTotalMachineCost,
      batchTimeInMinutes,
      suggestedPrice,
    };
  }, [extraLineItems]);

  const totalCostWithSupplies = (result?.totalBaseCost || 0) + extraItemsCostTotal.batchTotalFilamentCost + extraItemsCostTotal.batchTotalMachineCost + suppliesCostTotal;
  const currentSalePrice = parseFloat(orderSalePrice) || 0;
  const grossMarginPercent = currentSalePrice > 0 ? ((currentSalePrice - totalCostWithSupplies) / currentSalePrice) * 100 : 0;

  // Atualiza o preço sugerido quando os insumos ou peças extras mudam
  useEffect(() => {
    if (result && orderDialogOpen) {
      setOrderSalePrice((result.suggestedPrice + suppliesCostTotal + extraItemsCostTotal.suggestedPrice).toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupplies, extraLineItems]);

  function handleAddExtraLineItem() {
    const found = catalogItems.find((i) => i.id === pickItemId);
    if (!found) return;
    const qty = Math.max(1, parseInt(pickQty) || 1);
    const norm = normalizeItem(found);
    const batch = calculateBatchTimeAndCost({
      unitTimeMinutes: found.time_minutes,
      quantity: qty,
      unitFilaments: [norm],
      profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100,
    });
    const unitPrice =
      found.preco_venda_loja && found.preco_venda_loja > 0
        ? found.preco_venda_loja
        : batch.batchSuggestedPrice / qty;

    setExtraLineItems((prev) => [
      ...prev.filter((l) => l.item.id !== found.id),
      { item: found, qty, unitPrice, batchStats: batch },
    ]);
    setPickItemId("");
    setPickQty("1");
  }

  function handleRemoveExtraLineItem(itemId: string) {
    setExtraLineItems((prev) => prev.filter((l) => l.item.id !== itemId));
  }

  function openOrderDialog() {
    if (!result) return;
    setOrderPieceName("");
    setOrderClientName("");
    setSelectedSupplies({});
    setExtraLineItems([]);
    setOrderPartnerId("");
    setOrderSalePrice(result.suggestedPrice.toFixed(2));
    setOrderDialogOpen(true);
  }

  async function handleCreateOrder() {
    if (!result || !orderPieceName.trim() || !orderClientName.trim()) return;
    setOrdering(true);
    try {
      const salePrice = parseFloat(orderSalePrice) || (result.suggestedPrice + suppliesCostTotal + extraItemsCostTotal.suggestedPrice);

      const filamentsList = form.required_filaments
        .map(f => ({ material: f.material, weight_grams: parseFloat(f.weight) || 0, color: f.color }))
        .filter(f => f.weight_grams > 0);

      const primaryMaterial =
        filamentsList.length === 1
          ? filamentsList[0].material
          : filamentsList.length > 1
          ? "Múltiplos"
          : "PLA";

      const lineItem = {
        productId: "avulso",
        nome: orderPieceName.trim(),
        quantidade: 1,
        preco_unitario: salePrice,
        custo_material_unitario: result.filamentCost,
        custo_maquina_unitario: result.machineCost,
        batch_time_minutes: result.timeInMinutes,
      };

      const suppliesList = Object.entries(selectedSupplies)
        .map(([id, sq]) => {
          const s = availableSupplies.find((x) => x.id === id);
          return s ? { supplyId: id, name: s.name, unit_cost: s.unit_cost, quantity: sq } : null;
        })
        .filter(Boolean) as SelectedSupply[];

      const extraLinesPayload = extraLineItems.map((l) => {
        return {
          productId: l.item.id,
          nome: l.item.name,
          quantidade: l.qty,
          preco_unitario: l.unitPrice,
          custo_material_unitario: l.batchStats.batchTotalFilamentCost / l.qty,
          custo_maquina_unitario: l.batchStats.batchTotalMachineCost / l.qty,
          batch_time_minutes: l.batchStats.batchTimeInMinutes,
        };
      });

      const allItems = [lineItem, ...extraLinesPayload];
      const pieceNameDisplay = orderPieceName.trim() + (extraLineItems.length > 0 ? ` (+${extraLineItems.length} unid)` : "");

      // Comissão do parceiro
      const selectedPartner = partners.find((p) => p.id === orderPartnerId);
      const grossProfit = salePrice - totalCostWithSupplies;
      const partnerCommission =
        selectedPartner && grossProfit > 0
          ? (grossProfit * selectedPartner.commission_percentage) / 100
          : 0;

      await addOrder({
        instagram_handle: orderClientName.trim(),
        cliente_nome: orderClientName.trim(),
        catalog_item_id: "avulso",
        piece_name: pieceNameDisplay,
        material: primaryMaterial,
        quantity: 1 + extraLineItems.reduce((acc, l) => acc + l.qty, 0),
        price: salePrice,
        payment_status: "Pendente",
        production_status: "Na Fila",
        origem: "admin",
        items: allItems,
        base_cost: totalCostWithSupplies,
        machine_cost: result.machineCost + extraItemsCostTotal.batchTotalMachineCost,
        filament_cost: result.filamentCost + extraItemsCostTotal.batchTotalFilamentCost,
        batch_time_minutes: result.timeInMinutes + extraItemsCostTotal.batchTimeInMinutes,
        custo_operacional_total: totalCostWithSupplies,
        ...(suppliesCostTotal > 0 ? { supplies_cost: suppliesCostTotal } : {}),
        ...(suppliesList.length > 0 ? { supplies: suppliesList } : {}),
        ...(selectedPartner
          ? {
              partner_id: selectedPartner.id,
              partner_name: selectedPartner.name,
              partner_commission_value: partnerCommission,
              partner_commission_paid: false,
            }
          : {}),
      });

      setOrderSuccess(true);
      setOrderDialogOpen(false);
      setOrderPieceName("");
      setOrderClientName("");
      setOrderSalePrice("");
      setSelectedSupplies({});
      setExtraLineItems([]);
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch (error) {
      console.error("Erro ao gerar pedido:", error);
    } finally {
      setOrdering(false);
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

        {orderSuccess && (
          <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Pedido gerado com sucesso! Acesse o <strong className="ml-1">Gerenciador de Pedidos</strong>.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">Dados da Peça</CardTitle>
              <CardDescription>Insira as especificações da impressão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* G-code Parser */}
              <div className="space-y-2">
                <GcodeParser onDataExtracted={handleGcodeData} />
              </div>

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

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-dashed border-border hover:border-border/80 hover:bg-accent text-muted-foreground"
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar no Catálogo
                  </Button>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={openOrderDialog}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Gerar Pedido
                  </Button>
                </div>
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

      {/* Order Modal */}
      <ResponsiveModal
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        title="Gerar Pedido Avulso"
        description="Cria um pedido direto na fila, sem salvar no catálogo."
      >
        <div className="space-y-5 py-2">

          <div className="space-y-2">
            <Label htmlFor="order-client-name">Cliente / Instagram <span className="text-destructive">*</span></Label>
            <Input
              id="order-client-name"
              placeholder="Ex: @fulano ou João Silva"
              value={orderClientName}
              onChange={(e) => setOrderClientName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="order-piece-name">Nome da Peça (Principal) <span className="text-destructive">*</span></Label>
            <Input
              id="order-piece-name"
              placeholder="Ex: Dragão Articulado 3 Cores"
              value={orderPieceName}
              onChange={(e) => setOrderPieceName(e.target.value)}
            />
          </div>

          {/* Peça Calculada */}
          {result && orderPieceName && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex justify-between items-center text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-primary truncate">{orderPieceName}</p>
                <p className="text-xs text-muted-foreground">1× {formatBRL(result.suggestedPrice)}/un</p>
              </div>
              <span className="font-bold tabular-nums text-primary shrink-0">{formatBRL(result.suggestedPrice)}</span>
            </div>
          )}

          {/* Adicionar Produto ao Pedido */}
          <div className="space-y-2">
            <Label>Adicionar Peças do Catálogo (Opcional)</Label>
            <div className="flex gap-2">
              <Select value={pickItemId} onValueChange={(v) => setPickItemId(v ?? "")}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione uma peça..." />
                </SelectTrigger>
                <SelectContent>
                  {catalogItems.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={pickQty}
                onChange={(e) => setPickQty(e.target.value)}
                className="w-20"
                placeholder="Qtd"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddExtraLineItem}
                disabled={!pickItemId}
              >
                + Add
              </Button>
            </div>
          </div>

          {/* Lista de Itens Extras */}
          {extraLineItems.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border overflow-hidden text-sm">
              {extraLineItems.map((line) => {
                const lineTotal = line.unitPrice * line.qty;
                return (
                  <div key={line.item.id} className="flex items-center justify-between px-3 py-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.qty}× {formatBRL(line.unitPrice)}/un
                        {line.batchStats.timeSavedInMinutes > 0 && (
                          <span className="ml-1.5 text-green-400 font-medium">
                            (−{formatTime(line.batchStats.timeSavedInMinutes)} em lote)
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-foreground shrink-0">
                      {formatBRL(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraLineItem(line.item.id)}
                      className="text-muted-foreground hover:text-destructive transition shrink-0 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {availableSupplies.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Tag className="w-4 h-4" /> Insumos Extras
              </Label>
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                {availableSupplies.map((supply) => (
                  <div key={supply.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`supply-${supply.id}`}
                      checked={selectedSupplies[supply.id] !== undefined}
                      onCheckedChange={(c) =>
                        setSelectedSupplies((p) =>
                          c
                            ? { ...p, [supply.id]: 1 }
                            : Object.fromEntries(
                                Object.entries(p).filter(([k]) => k !== supply.id)
                              )
                        )
                      }
                    />
                    <label
                      htmlFor={`supply-${supply.id}`}
                      className="flex-1 cursor-pointer text-sm font-medium"
                    >
                      {supply.name}
                    </label>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {formatBRL(supply.unit_cost)}/un
                    </span>
                    {selectedSupplies[supply.id] !== undefined && (
                      <Input
                        type="number"
                        min={1}
                        value={selectedSupplies[supply.id]}
                        onChange={(e) =>
                          setSelectedSupplies((p) => ({
                            ...p,
                            [supply.id]: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-16 h-7 px-1 text-center"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parceiro indicador */}
          {partners.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" /> Indicado por (Parceiro)
              </Label>
              <Select
                value={orderPartnerId}
                onValueChange={(v) => setOrderPartnerId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum parceiro (venda direta)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum parceiro</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.commission_percentage}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orderPartnerId && (() => {
                const p = partners.find((x) => x.id === orderPartnerId);
                const gp = (parseFloat(orderSalePrice) || 0) - totalCostWithSupplies;
                const comm = p && gp > 0 ? (gp * p.commission_percentage) / 100 : 0;
                return p ? (
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Comissão de {p.name}</span>
                    <span className="font-bold text-primary tabular-nums">{formatBRL(comm)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {result && (
            <>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tempo Estimado Total (lote)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">
                    {formatTime(result.timeInMinutes + extraItemsCostTotal.batchTimeInMinutes)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Filamento (lote)</span>
                  <span className="font-medium tabular-nums">
                    {formatBRL(result.filamentCost + extraItemsCostTotal.batchTotalFilamentCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Máquina (lote)</span>
                  <span className="font-medium tabular-nums">
                    {formatBRL(result.machineCost + extraItemsCostTotal.batchTotalMachineCost)}
                  </span>
                </div>
                {suppliesCostTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Insumos</span>
                    <span className="font-medium tabular-nums">
                      {formatBRL(suppliesCostTotal)}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-1.5 flex justify-between items-center font-semibold">
                  <span>Custo Total</span>
                  <span className="tabular-nums">{formatBRL(totalCostWithSupplies)}</span>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="order-sale-price">
              <Sparkles className="w-4 h-4 text-primary" />
              Preço de Venda (R$)
            </Label>
            <Input
              id="order-sale-price"
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={orderSalePrice}
              onChange={(e) => setOrderSalePrice(e.target.value)}
            />
            {result && parseFloat(orderSalePrice) > 0 && (
              <p
                className={`text-xs font-semibold ${
                  grossMarginPercent < 0
                    ? "text-red-400"
                    : grossMarginPercent < 40
                    ? "text-amber-400"
                    : "text-green-400"
                }`}
              >
                Margem Bruta: {grossMarginPercent.toFixed(1)}%
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOrderDialogOpen(false)}
              disabled={ordering}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto flex-1"
              onClick={handleCreateOrder}
              disabled={!orderPieceName.trim() || !orderClientName.trim() || ordering}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {ordering ? "Gerando..." : "Gerar Pedido"}
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

