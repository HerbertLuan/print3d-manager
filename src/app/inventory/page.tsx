"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PackageOpen,
  Plus,
  RefreshCw,
  AlertCircle,
  PackageCheck,
  Search
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInventoryItems, getCatalogItems, addInventoryItem } from "@/lib/firestore";
import { InventoryItem, CatalogItem } from "@/lib/types";
import { formatBRL, calculatePrintCost, DEFAULT_PROFIT_MARGIN } from "@/lib/calculations";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invData, catData] = await Promise.all([
        getInventoryItems(),
        getCatalogItems()
      ]);
      setItems(invData);
      setCatalogItems(catData);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados do estoque.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Deriva o item do catálogo selecionado no modal
  const selectedCatalogItem = useMemo(() => {
    return catalogItems.find(c => c.id === selectedCatalogId) || null;
  }, [catalogItems, selectedCatalogId]);

  // Custos Projetados para Entrada de Estoque
  const entryCosts = useMemo(() => {
    if (!selectedCatalogItem) return null;
    const qty = parseInt(addQuantity) || 1;
    
    const unitCosts = calculatePrintCost({
      weightGrams: selectedCatalogItem.weight_grams,
      timeHours: Math.floor(selectedCatalogItem.time_minutes / 60),
      timeMinutes: selectedCatalogItem.time_minutes % 60,
      material: selectedCatalogItem.material,
      profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100,
    });

    return {
      totalCost: unitCosts.totalBaseCost * qty,
      totalPrice: selectedCatalogItem.calculated_price * qty
    };
  }, [selectedCatalogItem, addQuantity]);

  async function handleAddInventory() {
    if (!selectedCatalogItem || !entryCosts) return;
    const qty = parseInt(addQuantity);
    if (isNaN(qty) || qty <= 0) return;

    setAdding(true);
    try {
      // Verifica se já existe um item com esse catálogo no estoque para podermos dar um "update" em vez de recriar.
      // Ops, nosso Firestore model: podemos simplesmente adicionar na lista ou agrupar, mas a estrutura foi de IDs únicos.
      // O ideal seria procurar pelo catalog_item_id e atualizar o documento se existir, mas criar novo é OK também (lote).
      // Vamos assumir que criaremos um novo lote document por simplicidade, como no order.
      
      await addInventoryItem({
        catalog_item_id: selectedCatalogItem.id,
        catalog_item_name: selectedCatalogItem.name,
        material: selectedCatalogItem.material || selectedCatalogItem.required_filaments?.[0]?.material || "PLA",
        quantity_available: qty,
        total_cost: entryCosts.totalCost,
        total_price: entryCosts.totalPrice
      });
      
      setAddDialogOpen(false);
      setSelectedCatalogId("");
      setAddQuantity("1");
      loadData(); // Reload para atualizar
    } catch (err) {
      console.error("Erro ao dar entrada no estoque:", err);
    } finally {
      setAdding(false);
    }
  }

  // Agrupa os items de estoque por catalog_item_id para exibir total consolidado
  const consolidatedInventory = useMemo(() => {
    const map = new Map<string, InventoryItem & { lot_count: number }>();
    for (const item of items) {
      if (item.quantity_available <= 0) continue; // Pula vazios

      if (map.has(item.catalog_item_id)) {
        const existing = map.get(item.catalog_item_id)!;
        existing.quantity_available += item.quantity_available;
        existing.total_cost += item.total_cost;
        existing.total_price += item.total_price;
        existing.lot_count += 1;
      } else {
        map.set(item.catalog_item_id, { ...item, lot_count: 1 });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const totalValue = consolidatedInventory.reduce((acc, curr) => acc + curr.total_price, 0);

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <PackageOpen className="w-5 h-5 text-orange-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
            </div>
            <p className="text-muted-foreground">Valor Estimado: {formatBRL(totalValue)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="hidden sm:flex">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Entrada de Estoque</span>
            </Button>
          </div>
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
            <CardTitle className="text-base text-foreground/90">Inventário Disponível</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : consolidatedInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <PackageCheck className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground mb-1">
                  Estoque Vazio
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Você não tem peças feitas em pronta entrega. Clique em Entrada de Estoque para fabricar peças antecipadas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="pl-6">Peça</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right pr-6">Potencial de Venda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consolidatedInventory.map((item) => (
                      <TableRow key={item.catalog_item_id} className="border-border">
                        <TableCell className="pl-6 font-medium text-foreground">{item.catalog_item_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{item.material}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-accent/50 min-w-8">
                            {item.quantity_available}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatBRL(item.total_cost)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold pr-6 text-emerald-400/90">
                          {formatBRL(item.total_price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsiveModal
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        title="Entrada de Estoque"
        description="Fabrique itens do catálogo antecipadamente."
      >
        <div className="space-y-5 py-2">
          <div className="space-y-2">
             <Label>Peça do Catálogo</Label>
             <Select value={selectedCatalogId} onValueChange={(v) => setSelectedCatalogId(v as string)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a peça" />
              </SelectTrigger>
              <SelectContent>
                {catalogItems.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.material})
                  </SelectItem>
                ))}
              </SelectContent>
             </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade Produzida</Label>
            <Input
              type="number"
              min={1}
              value={addQuantity}
              onChange={(e) => setAddQuantity(e.target.value)}
            />
          </div>

          {selectedCatalogItem && entryCosts && (
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Alocado Estimado</span>
                <span className="font-medium">{formatBRL(entryCosts.totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receita Potencial Adicionada</span>
                <span className="font-medium text-emerald-400">{formatBRL(entryCosts.totalPrice)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setAddDialogOpen(false)}
              disabled={adding}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleAddInventory}
              disabled={!selectedCatalogId || adding}
            >
              <Plus className="w-4 h-4 mr-2" />
              {adding ? "Adicionando..." : "Confirmar Estoque"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
