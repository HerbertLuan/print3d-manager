"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  ShoppingCart,
  RefreshCw,
  Package,
  Clock,
  Weight,
  AlertCircle,
  ImageIcon,
  Trash2,
  Sparkles,
  Tag,
  Layers,
  Edit2,
  Plus
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getCatalogItems, addOrder, deleteCatalogItem, getSupplies, getFilaments, updateCatalogItem } from "@/lib/firestore";
import { CatalogItem, Supply, SelectedSupply, Filament, CatalogFilamentRequirement } from "@/lib/types";
import {
  formatBRL,
  formatTime,
  calculateBatchTimeAndCost,
  DEFAULT_PROFIT_MARGIN,
  MATERIAL_OPTIONS
} from "@/lib/calculations";
import { uploadImage } from "@/lib/storage";

const MATERIAL_COLORS: Record<string, string> = {
  PLA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "PLA+": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  PETG: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ABS: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  ASA: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  TPU: "bg-green-500/10 text-green-400 border-green-500/20",
  "Múltiplos": "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableSupplies, setAvailableSupplies] = useState<Supply[]>([]);
  const [availableFilaments, setAvailableFilaments] = useState<Filament[]>([]);

  // Order state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [orderPrice, setOrderPrice] = useState("");
  const [selectedSupplies, setSelectedSupplies] = useState<Record<string, number>>({});
  const [mappedFilaments, setMappedFilaments] = useState<Record<number, string>>({}); // index -> filament_id

  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTimeHours, setEditTimeHours] = useState("");
  const [editTimeMinutes, setEditTimeMinutes] = useState("");
  const [editFilaments, setEditFilaments] = useState<(CatalogFilamentRequirement & { id: string })[]>([]);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogData, suppliesData, filamentsData] = await Promise.all([
        getCatalogItems(),
        getSupplies(),
        getFilaments(),
      ]);
      setItems(catalogData);
      setAvailableSupplies(suppliesData);
      setAvailableFilaments(filamentsData);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  function normalizeItem(item: CatalogItem) {
    const filaments = item.required_filaments || [{ material: item.material || "PLA", weight_grams: item.weight_grams || 0 }];
    const totalWeight = filaments.reduce((acc, f) => acc + f.weight_grams, 0);
    return { filaments, totalWeight };
  }

  function openOrderDialog(item: CatalogItem) {
    setSelectedItem(item);
    setOrderQuantity("1");
    setSelectedSupplies({});
    setMappedFilaments({});
    setInstagramHandle("");
    setOrderDialogOpen(true);
  }

  function openEditDialog(item: CatalogItem) {
    setSelectedItem(item);
    const norm = normalizeItem(item);
    setEditName(item.name);
    setEditTimeHours(Math.floor(item.time_minutes / 60).toString());
    setEditTimeMinutes((item.time_minutes % 60).toString());
    setEditFilaments(norm.filaments.map(f => ({ ...f, id: Math.random().toString() })));
    setEditImageFile(null);
    setEditDialogOpen(true);
  }

  const batchStats = useMemo(() => {
    if (!selectedItem) return null;
    const qty = Math.max(1, parseInt(orderQuantity) || 1);
    const norm = normalizeItem(selectedItem);

    const batch = calculateBatchTimeAndCost({
      unitTimeMinutes: selectedItem.time_minutes,
      quantity: qty,
      unitFilaments: norm.filaments,
      profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100,
    });

    const suppliesCostTotal = Object.entries(selectedSupplies).reduce((sum, [id, sqty]) => {
      const supply = availableSupplies.find((s) => s.id === id);
      return sum + (supply ? supply.unit_cost * sqty : 0);
    }, 0);

    const totalCostWithSupplies = batch.batchTotalBaseCost + suppliesCostTotal;
    const finalSuggestedPrice = totalCostWithSupplies / (1 - batch.profitMargin);
    const grossMarginOnCurrentPrice = parseFloat(orderPrice)
      ? ((parseFloat(orderPrice) - totalCostWithSupplies) / parseFloat(orderPrice)) * 100
      : 0;

    return {
      ...batch,
      suppliesCostTotal,
      totalCostWithSupplies,
      finalSuggestedPrice,
      grossMarginOnCurrentPrice,
      totalWeightGrams: norm.totalWeight * qty,
    };
  }, [selectedItem, orderQuantity, selectedSupplies, availableSupplies, orderPrice]);

  useEffect(() => {
    if (batchStats && !orderPrice) {
      setOrderPrice(batchStats.finalSuggestedPrice.toFixed(2));
    }
  }, [batchStats]);

  async function handleCreateOrder() {
    if (!selectedItem || !instagramHandle.trim()) return;
    setOrdering(true);
    try {
      const handle = instagramHandle.trim().replace(/^@/, "");
      const qty = parseInt(orderQuantity) || 1;
      const norm = normalizeItem(selectedItem);

      const suppliesList = Object.entries(selectedSupplies)
        .map(([id, sq]) => {
          const s = availableSupplies.find((x) => x.id === id);
          return s ? { supplyId: id, name: s.name, unit_cost: s.unit_cost, quantity: sq } : null;
        }).filter(Boolean) as SelectedSupply[];

      const usedFilaments = Object.entries(mappedFilaments).map(([indexStr, filamentId]) => {
        const req = norm.filaments[parseInt(indexStr)];
        return { filament_id: filamentId, weight_grams: req.weight_grams * qty };
      });

      const orderPayload: Parameters<typeof addOrder>[0] = {
        instagram_handle: `@${handle}`,
        catalog_item_id: selectedItem.id,
        piece_name: selectedItem.name,
        material: norm.filaments.length > 1 ? "Múltiplos" : norm.filaments[0].material,
        quantity: qty,
        price: parseFloat(orderPrice) || batchStats?.finalSuggestedPrice || selectedItem.calculated_price,
        payment_status: "Pendente",
        production_status: "Na Fila",
        used_filaments: usedFilaments,
        filaments_deducted: false,
      };

      if (batchStats) {
        orderPayload.base_cost = batchStats.batchTotalBaseCost;
        orderPayload.machine_cost = batchStats.batchTotalMachineCost;
        orderPayload.filament_cost = batchStats.batchTotalFilamentCost;
        orderPayload.supplies_cost = batchStats.suppliesCostTotal;
        orderPayload.batch_time_minutes = batchStats.batchTimeInMinutes;
      }
      if (suppliesList.length > 0) orderPayload.supplies = suppliesList;

      await addOrder(orderPayload);
      setOrderSuccess(true);
      setOrderDialogOpen(false);
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err) {
      console.error("Erro ao criar pedido:", err);
    } finally {
      setOrdering(false);
    }
  }

  async function handleSaveEdit() {
    if (!selectedItem || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const min = parseInt(editTimeMinutes) || 0;
      const hr = parseInt(editTimeHours) || 0;
      const totalTime = hr * 60 + min;

      const newFilaments = editFilaments.map(f => ({ material: f.material, weight_grams: f.weight_grams, color: f.color }));
      const totalWeight = newFilaments.reduce((a, b) => a + b.weight_grams, 0);

      const costCalc = calculateBatchTimeAndCost({
        unitTimeMinutes: totalTime,
        quantity: 1,
        unitFilaments: newFilaments,
        profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100
      });

      let imageUrl = selectedItem.imageUrl;
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile, `catalog/${Date.now()}_${editImageFile.name}`);
      }

      await updateCatalogItem(selectedItem.id, {
        name: editName.trim(),
        required_filaments: newFilaments,
        weight_grams: totalWeight,
        material: newFilaments.length > 1 ? "Múltiplos" : newFilaments[0].material,
        time_minutes: totalTime,
        calculated_price: costCalc.batchSuggestedPrice,
        ...(imageUrl && { imageUrl }),
      });

      setEditDialogOpen(false);
      loadItems();
    } catch (err) {
      console.error("Erro na edição:", err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteItem(item: CatalogItem) {
    try {
      await deleteCatalogItem(item.id, item.imageUrl);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error("Erro ao deletar item:", err);
      setError("Falha ao excluir a peça.");
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Catálogo de Peças</h1>
            </div>
            <p className="text-muted-foreground">{items.length} peças cadastradas</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadItems} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {orderSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg px-4 py-3 text-sm font-medium">
            ✓ Pedido criado com sucesso! Acesse o <strong>Gerenciador de Pedidos</strong>.
          </div>
        )}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
             {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />)}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((item) => (
              <CatalogCard
                key={item.id}
                item={item}
                onOrder={() => openOrderDialog(item)}
                onEdit={() => openEditDialog(item)}
                onDelete={() => handleDeleteItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      <ResponsiveModal
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        title="Gerar Pedido"
        description={selectedItem ? `Peça: ${selectedItem.name}` : ""}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>@ do Instagram do Cliente</Label>
            <Input placeholder="usuario_instagram" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Quantidade de Peças</Label>
            <Input type="number" min={1} value={orderQuantity} onChange={(e) => setOrderQuantity(e.target.value)} />
          </div>

          {selectedItem && normalizeItem(selectedItem).filaments.length > 0 && (
             <div className="space-y-3">
               <Label className="flex items-center gap-2">
                 <Layers className="w-4 h-4" /> Selecione os Rolos do Estoque (Rateio de Consumo)
               </Label>
               {normalizeItem(selectedItem).filaments.map((req, idx) => (
                  <div key={idx} className="bg-muted/30 border border-border p-3 rounded-lg space-y-2">
                     <p className="text-sm font-medium">{req.color || "Cor Principal"} - {req.material} <span className="text-muted-foreground">({req.weight_grams * parseInt(orderQuantity || "1")}g total)</span></p>
                     <Select value={mappedFilaments[idx]} onValueChange={(v) => setMappedFilaments(p => ({...p, [idx]: v || ""}))}>
                        <SelectTrigger>
                           <SelectValue placeholder="Selecione um rolo físico..." />
                        </SelectTrigger>
                        <SelectContent>
                           {availableFilaments.filter(f => f.material === req.material).map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                 {f.name} ({f.color_name}) - Restam {Math.max(0, f.initial_weight_grams - f.consumed_weight_grams)}g
                              </SelectItem>
                           ))}
                           {availableFilaments.filter(f => f.material === req.material).length === 0 && (
                             <SelectItem value="none" disabled>Nenhum rolo de {req.material} cadastrado.</SelectItem>
                           )}
                        </SelectContent>
                     </Select>
                  </div>
               ))}
             </div>
          )}

          {availableSupplies.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2"><Tag className="w-4 h-4" /> Insumos Extras</Label>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 max-h-32 overflow-y-auto">
                {availableSupplies.map((supply) => (
                  <div key={supply.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`supply-${supply.id}`}
                      checked={selectedSupplies[supply.id] !== undefined}
                      onCheckedChange={(c) => setSelectedSupplies(p => c ? {...p, [supply.id]: 1} : Object.fromEntries(Object.entries(p).filter(([k]) => k !== supply.id)))}
                    />
                    <label htmlFor={`supply-${supply.id}`} className="flex-1 cursor-pointer text-sm font-medium">{supply.name}</label>
                    {selectedSupplies[supply.id] !== undefined && (
                      <Input type="number" min={1} value={selectedSupplies[supply.id]} onChange={(e) => setSelectedSupplies(p => ({...p, [supply.id]: parseInt(e.target.value)||1}))} className="w-16 h-7 px-1 text-center" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Preço Final a Cobrar (R$)</Label>
            <Input type="number" step={0.01} value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} />
            {batchStats && parseFloat(orderPrice) > 0 && (
               <p className={`text-xs font-medium ${batchStats.grossMarginOnCurrentPrice < 40 ? "text-red-400" : "text-green-400"}`}>
                 Margem Bruta (Cálculo): {batchStats.grossMarginOnCurrentPrice.toFixed(1)}%
               </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2">
             <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOrderDialogOpen(false)}>Cancelar</Button>
             <Button className="w-full sm:w-auto flex-1" onClick={handleCreateOrder} disabled={!instagramHandle.trim() || ordering}>
               {ordering ? "Criando..." : "Criar Pedido"}
             </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={editDialogOpen} onOpenChange={setEditDialogOpen} title="Editar Peça" description="Altere os parâmetros físicos e foto. O preço será recalculado com a margem atual.">
        <div className="space-y-4 py-2">
           <div className="space-y-2">
              <Label>Nome da Peça</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
           </div>
           
           <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materiais Exigidos / Partes</Label>
                <Button variant="ghost" size="sm" onClick={() => setEditFilaments(p => [...p, {id: Math.random().toString(), material: "PLA", weight_grams: 0}])} className="h-6">
                  <Plus className="w-3 h-3 mr-1"/> Adicionar Parâmetro
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                 {editFilaments.map((f, i) => (
                    <div key={f.id} className="flex gap-2">
                       <Select value={f.material} onValueChange={(v) => setEditFilaments(p => p.map(x => x.id === f.id ? {...x, material: v || ""} : x))}>
                          <SelectTrigger className="w-24"><SelectValue/></SelectTrigger>
                          <SelectContent>{MATERIAL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                       </Select>
                       <Input placeholder="Cor" className="w-24" value={f.color||""} onChange={(e) => setEditFilaments(p => p.map(x => x.id === f.id ? {...x, color: e.target.value} : x))} />
                       <Input type="number" placeholder="0g" className="flex-1" value={f.weight_grams} onChange={(e) => setEditFilaments(p => p.map(x => x.id === f.id ? {...x, weight_grams: parseFloat(e.target.value)||0} : x))} />
                       <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => setEditFilaments(p => p.filter(x => x.id !== f.id))}><Trash2 className="w-4 h-4"/></Button>
                    </div>
                 ))}
                 <p className="text-xs text-right text-muted-foreground mt-1">Peso Total Peça: {editFilaments.reduce((a, b) => a + b.weight_grams, 0)}g</p>
              </div>
           </div>

           <div className="space-y-2">
              <Label>Tempo (Horas e Minutos)</Label>
              <div className="flex gap-2">
                 <Input type="number" value={editTimeHours} onChange={e => setEditTimeHours(e.target.value)} placeholder="0" />
                 <Input type="number" value={editTimeMinutes} onChange={e => setEditTimeMinutes(e.target.value)} placeholder="0" max={59} />
              </div>
           </div>

           <div className="space-y-2">
              <Label>Substituir Foto</Label>
              <ImageUpload onImageSelected={setEditImageFile} />
              {selectedItem?.imageUrl && !editImageFile && <p className="text-xs text-muted-foreground">Deixe em branco para manter a foto atual.</p>}
           </div>

           <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveEdit} disabled={savingEdit || editName.trim() === ""}>{savingEdit ? "Salvando..." : "Salvar Edição"}</Button>
           </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}

function CatalogCard({ item, onOrder, onEdit, onDelete }: any) {
  const filaments = item.required_filaments || [{ material: item.material || "PLA", weight_grams: item.weight_grams || 0 }];
  const mainMaterial = filaments.length > 1 ? "Múltiplos" : filaments[0].material;
  const matClass = MATERIAL_COLORS[mainMaterial] ?? "bg-muted";
  const weight = filaments.reduce((acc: number, f: any) => acc + f.weight_grams, 0);

  return (
    <Card className="border-border hover:border-primary/30 transition-all duration-200 hover:shadow-md group overflow-hidden flex flex-col">
      {item.imageUrl ? (
        <div className="relative w-full h-48 bg-black/10 border-b border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-40 bg-muted/40 border-b border-border flex flex-col items-center justify-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground/30 mb-2" />
          <span className="text-xs text-muted-foreground/60">Sem foto</span>
        </div>
      )}
      <CardHeader className="pb-3 flex-1 relative">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-md border border-border">
           <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5" />
           </Button>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" />}>
                <Trash2 className="w-3.5 h-3.5" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir do Catálogo</AlertDialogTitle>
                <AlertDialogDescription>Você tem certeza? A peça será excluída permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex items-start justify-between gap-2 pr-12">
          <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
          <Badge variant="outline" className={`text-[10px] shrink-0 font-semibold ${matClass}`}>{mainMaterial}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted rounded-lg p-2.5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Tempo</p>
              <p className="text-xs font-medium">{formatTime(item.time_minutes)}</p>
            </div>
          </div>
          <div className="bg-muted rounded-lg p-2.5 flex items-center gap-2">
            <Weight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Peso Total</p>
              <p className="text-xs font-medium">{weight}g</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border mt-3">
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">Preço Sugerido</p>
            <p className="text-xl font-bold text-primary">{formatBRL(item.calculated_price)}</p>
          </div>
          <Button size="sm" onClick={onOrder} className="gap-1.5 mt-2">
            <ShoppingCart className="w-3.5 h-3.5" />
            Gerar Pedido
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
