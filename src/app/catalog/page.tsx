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
  Edit2,
  Search,
  FolderOpen,
  FolderPlus,
  Layers,
  ToggleLeft,
  Star,
  GripVertical,
  Users,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  getCatalogItems,
  addOrder,
  deleteCatalogItem,
  getSupplies,
  updateCatalogItem,
  getCollections,
  addCollection,
  updateCollection,
  deleteCollection,
  getActivePartners,
} from "@/lib/firestore";
import { CatalogItem, Supply, SelectedSupply, Collection, Partner } from "@/lib/types";
import {
  formatBRL,
  formatTime,
  calculateBatchTimeAndCost,
  DEFAULT_PROFIT_MARGIN,
  MATERIAL_OPTIONS,
} from "@/lib/calculations";
import { uploadImage } from "@/lib/storage";

// ─── Constantes e helpers ─────────────────────────────────────────────────────

const MATERIAL_COLORS: Record<string, string> = {
  PLA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "PLA+": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  PETG: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ABS: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  ASA: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  TPU: "bg-green-500/10 text-green-400 border-green-500/20",
};

const CATALOG_TAB_KEY = "print3d-catalog-active-tab";
const PAGE_TABS = { CATALOG: "catalog", COLLECTIONS: "collections" };

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeItem(item: CatalogItem): { material: string; weight_grams: number } {
  const rf = item.required_filaments;
  if (Array.isArray(rf) && rf.length > 0) {
    return { material: rf[0].material ?? "PLA", weight_grams: rf[0].weight_grams ?? 0 };
  }
  return { material: item.material ?? "PLA", weight_grams: item.weight_grams ?? 0 };
}

// ─── Page Principal ───────────────────────────────────────────────────────────

export default function CatalogPage() {
  // ── Dados ──
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableSupplies, setAvailableSupplies] = useState<Supply[]>([]);

  // ── Tab principal e busca ──
  const [mainTab, setMainTab] = useState(PAGE_TABS.CATALOG);
  const [catalogTab, setCatalogTab] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Order state (multi-item internal cart) ──
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [selectedSupplies, setSelectedSupplies] = useState<Record<string, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderPartnerId, setOrderPartnerId] = useState("");

  // ── Parceiros ──
  const [partners, setPartners] = useState<Partner[]>([]);

  // Carrinho interno
  const [orderLineItems, setOrderLineItems] = useState<{
    item: CatalogItem;
    qty: number;
    unitPrice: number;
    batchStats: ReturnType<typeof calculateBatchTimeAndCost>;
  }[]>([]);
  // Seletor de produto no modal
  const [pickItemId, setPickItemId] = useState("");
  const [pickQty, setPickQty] = useState("1");

  // ── Edit state ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMaterial, setEditMaterial] = useState("PLA");
  const [editWeight, setEditWeight] = useState("");
  const [editTimeHours, setEditTimeHours] = useState("");
  const [editTimeMinutes, setEditTimeMinutes] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editShowInStore, setEditShowInStore] = useState(false);
  const [editDestaque, setEditDestaque] = useState(false);
  const [editHeadlineVenda, setEditHeadlineVenda] = useState("");
  const [editDescricaoVenda, setEditDescricaoVenda] = useState("");
  const [editPrecoVendaLoja, setEditPrecoVendaLoja] = useState("");
  const [editCollectionId, setEditCollectionId] = useState<string>("");

  // ── Collection management state ──
  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [colNome, setColNome] = useState("");
  const [colSlug, setColSlug] = useState("");
  const [colOrdem, setColOrdem] = useState("0");
  const [colAtivo, setColAtivo] = useState(true);
  const [colEmDestaque, setColEmDestaque] = useState(false);
  const [savingCol, setSavingCol] = useState(false);

  // ── Carregar dados ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogData, suppliesData, collectionsData] = await Promise.all([
        getCatalogItems(),
        getSupplies(),
        getCollections(),
      ]);
      setItems(catalogData);
      setAvailableSupplies(suppliesData);
      setCollections(collectionsData);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    getActivePartners().then(setPartners).catch(console.error);
  }, [loadAll]);

  // Restaura a aba ativa do catálogo do localStorage (QoL)
  useEffect(() => {
    const saved = localStorage.getItem(CATALOG_TAB_KEY);
    if (saved) setCatalogTab(saved);
  }, []);

  function persistCatalogTab(tab: string) {
    setCatalogTab(tab);
    localStorage.setItem(CATALOG_TAB_KEY, tab);
  }

  // ─── Busca e agrupamento ──────────────────────────────────────────────────

  /** Filtra itens pelo texto de busca global */
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.headline_venda ?? "").toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  /** Agrupa itens por coleção */
  const groupedItems = useMemo(() => {
    const groups: { id: string; label: string; items: CatalogItem[] }[] = [];

    // Um grupo por coleção
    collections.forEach((col) => {
      groups.push({
        id: col.id,
        label: col.nome,
        items: filteredItems.filter((i) => i.collectionId === col.id),
      });
    });

    // Grupo "Geral" para itens sem coleção
    groups.push({
      id: "__general__",
      label: "Geral",
      items: filteredItems.filter(
        (i) =>
          !i.collectionId ||
          !collections.find((c) => c.id === i.collectionId)
      ),
    });

    return groups;
  }, [filteredItems, collections]);

  // ─── Handlers: Order ─────────────────────────────────────────────────────

  function openOrderDialog(item: CatalogItem) {
    // Pré-adiciona o item clicado como primeira linha do carrinho interno
    const norm = normalizeItem(item);
    const batch = calculateBatchTimeAndCost({
      unitTimeMinutes: item.time_minutes,
      quantity: 1,
      unitFilaments: [norm],
      profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100,
    });
    const unitPrice =
      item.preco_venda_loja && item.preco_venda_loja > 0
        ? item.preco_venda_loja
        : batch.batchSuggestedPrice;

    setOrderLineItems([{ item, qty: 1, unitPrice, batchStats: batch }]);
    setPickItemId("");
    setPickQty("1");
    setSelectedSupplies({});
    setClientName("");
    setOrderPrice("");
    setOrderPartnerId("");
    setOrderDialogOpen(true);
  }

  /** Adiciona ou atualiza uma linha no carrinho interno */
  function handleAddLineItem() {
    const found = items.find((i) => i.id === pickItemId);
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

    setOrderLineItems((prev) => [
      ...prev.filter((l) => l.item.id !== found.id), // evita duplicata
      { item: found, qty, unitPrice, batchStats: batch },
    ]);
    setPickItemId("");
    setPickQty("1");
  }

  function handleRemoveLineItem(itemId: string) {
    setOrderLineItems((prev) => prev.filter((l) => l.item.id !== itemId));
  }

  /** Soma os batch stats de todas as linhas */
  const totalBatchStats = useMemo(() => {
    if (orderLineItems.length === 0) return null;

    const suppliesCostTotal = Object.entries(selectedSupplies).reduce((sum, [id, sqty]) => {
      const supply = availableSupplies.find((s) => s.id === id);
      return sum + (supply ? supply.unit_cost * sqty : 0);
    }, 0);

    let batchTotalFilamentCost = 0;
    let batchTotalMachineCost = 0;
    let batchTimeInMinutes = 0;
    let timeSavedInMinutes = 0;

    for (const line of orderLineItems) {
      batchTotalFilamentCost += line.batchStats.batchTotalFilamentCost;
      batchTotalMachineCost += line.batchStats.batchTotalMachineCost;
      batchTimeInMinutes += line.batchStats.batchTimeInMinutes;
      timeSavedInMinutes += line.batchStats.timeSavedInMinutes;
    }

    const totalBaseCost = batchTotalFilamentCost + batchTotalMachineCost;
    const totalCostWithSupplies = totalBaseCost + suppliesCostTotal;
    const salePrice = parseFloat(orderPrice) || 0;
    const grossMarginPercent =
      salePrice > 0 ? ((salePrice - totalCostWithSupplies) / salePrice) * 100 : 0;

    // Preço sugerido total (soma dos preços individuais) + insumos
    const suggestedPrice =
      orderLineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0) +
      suppliesCostTotal;

    return {
      batchTotalFilamentCost,
      batchTotalMachineCost,
      batchTimeInMinutes,
      timeSavedInMinutes,
      suppliesCostTotal,
      totalCostWithSupplies,
      grossMarginPercent,
      suggestedPrice,
      profitMargin: DEFAULT_PROFIT_MARGIN,
    };
  }, [orderLineItems, selectedSupplies, availableSupplies, orderPrice]);

  // Auto-sugere preço quando as linhas ou insumos mudam
  useEffect(() => {
    if (totalBatchStats && orderDialogOpen) {
      setOrderPrice(totalBatchStats.suggestedPrice.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderLineItems, selectedSupplies]);

  async function handleCreateOrder() {
    if (orderLineItems.length === 0 || !clientName.trim()) return;
    setOrdering(true);
    try {
      const suppliesList = Object.entries(selectedSupplies)
        .map(([id, sq]) => {
          const s = availableSupplies.find((x) => x.id === id);
          return s ? { supplyId: id, name: s.name, unit_cost: s.unit_cost, quantity: sq } : null;
        })
        .filter(Boolean) as SelectedSupply[];

      const salePrice = parseFloat(orderPrice) || totalBatchStats?.suggestedPrice || 0;

      // Primeira linha como item principal (legado)
      const firstLine = orderLineItems[0];
      const firstNorm = normalizeItem(firstLine.item);

      // Linhas para novo campo items[]
      const lineItemsPayload = orderLineItems.map((l) => {
        const norm = normalizeItem(l.item);
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

      // Piece name resumido
      const pieceName = orderLineItems
        .map((l) => `${l.qty}× ${l.item.name}`)
        .join(", ");

      // Comissão do parceiro
      const selectedPartner = partners.find((p) => p.id === orderPartnerId);
      const grossProfit = salePrice - (totalBatchStats?.totalCostWithSupplies ?? 0);
      const partnerCommission =
        selectedPartner && grossProfit > 0
          ? (grossProfit * selectedPartner.commission_percentage) / 100
          : 0;

      const orderPayload: Parameters<typeof addOrder>[0] = {
        instagram_handle: clientName.trim(),
        cliente_nome: clientName.trim(),
        catalog_item_id: firstLine.item.id,
        piece_name: pieceName,
        material: firstNorm.material,
        quantity: orderLineItems.reduce((s, l) => s + l.qty, 0),
        price: salePrice,
        payment_status: "Pendente",
        production_status: "Na Fila",
        origem: "admin",
        items: lineItemsPayload,
        base_cost: totalBatchStats?.totalCostWithSupplies ?? 0,
        machine_cost: totalBatchStats?.batchTotalMachineCost ?? 0,
        filament_cost: totalBatchStats?.batchTotalFilamentCost ?? 0,
        batch_time_minutes: totalBatchStats?.batchTimeInMinutes ?? 0,
        custo_operacional_total:
          (totalBatchStats?.batchTotalFilamentCost ?? 0) +
          (totalBatchStats?.batchTotalMachineCost ?? 0) +
          (totalBatchStats?.suppliesCostTotal ?? 0),
        ...(totalBatchStats && totalBatchStats.suppliesCostTotal > 0
          ? { supplies_cost: totalBatchStats.suppliesCostTotal }
          : {}),
        ...(suppliesList.length > 0 ? { supplies: suppliesList } : {}),
        ...(selectedPartner
          ? {
              partner_id: selectedPartner.id,
              partner_name: selectedPartner.name,
              partner_commission_value: partnerCommission,
              partner_commission_paid: false,
            }
          : {}),
      };

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

  // ─── Handlers: Edit ───────────────────────────────────────────────────────

  function openEditDialog(item: CatalogItem) {
    const norm = normalizeItem(item);
    setEditingItem(item);
    setEditName(item.name);
    setEditMaterial(norm.material);
    setEditWeight(norm.weight_grams.toString());
    setEditTimeHours(Math.floor(item.time_minutes / 60).toString());
    setEditTimeMinutes((item.time_minutes % 60).toString());
    setEditImageFile(null);
    setEditShowInStore(item.showInStore ?? false);
    setEditDestaque(item.destaque ?? false);
    setEditHeadlineVenda(item.headline_venda ?? "");
    setEditDescricaoVenda(item.descricao_venda ?? "");
    setEditPrecoVendaLoja(
      item.preco_venda_loja && item.preco_venda_loja > 0
        ? item.preco_venda_loja.toFixed(2)
        : ""
    );
    setEditCollectionId(item.collectionId ?? "");
    setEditDialogOpen(true);
  }

  async function handleSaveEdit() {
    if (!editingItem || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const min = parseInt(editTimeMinutes) || 0;
      const hr = parseInt(editTimeHours) || 0;
      const totalTime = hr * 60 + min;
      const weight = parseFloat(editWeight) || 0;

      const costCalc = calculateBatchTimeAndCost({
        unitTimeMinutes: totalTime,
        quantity: 1,
        unitFilaments: [{ material: editMaterial, weight_grams: weight }],
        profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100,
      });

      let imageUrl = editingItem.imageUrl;
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile, `catalog/${Date.now()}_${editImageFile.name}`);
      }

      const payload: Record<string, unknown> = {
        name: editName.trim(),
        material: editMaterial,
        weight_grams: weight,
        time_minutes: totalTime,
        calculated_price: costCalc.batchSuggestedPrice,
        showInStore: editShowInStore,
        destaque: editShowInStore ? editDestaque : false,
        headline_venda: editHeadlineVenda.trim() || "",
        descricao_venda: editDescricaoVenda.trim() || "",
        preco_venda_loja: parseFloat(editPrecoVendaLoja) || 0,
        // Salva o collectionId — string vazia = sem coleção
        collectionId: editCollectionId && editCollectionId !== "__none__" ? editCollectionId : "",
      };

      if (imageUrl) payload.imageUrl = imageUrl;

      await updateCatalogItem(editingItem.id, payload);

      setEditDialogOpen(false);
      // Mantém a aba ativa ao recarregar
      loadAll();
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

  // ─── Handlers: Collections ────────────────────────────────────────────────

  function openNewCollection() {
    setEditingCollection(null);
    setColNome("");
    setColSlug("");
    setColOrdem(String(collections.length));
    setColAtivo(true);
    setColEmDestaque(false);
    setColDialogOpen(true);
  }

  function openEditCollection(col: Collection) {
    setEditingCollection(col);
    setColNome(col.nome);
    setColSlug(col.slug);
    setColOrdem(String(col.ordem));
    setColAtivo(col.ativo);
    setColEmDestaque(col.em_destaque);
    setColDialogOpen(true);
  }

  async function handleSaveCollection() {
    if (!colNome.trim()) return;
    setSavingCol(true);
    try {
      const data = {
        nome: colNome.trim(),
        slug: colSlug.trim() || slugify(colNome.trim()),
        ordem: parseInt(colOrdem) || 0,
        ativo: colAtivo,
        em_destaque: colEmDestaque,
      };
      if (editingCollection) {
        await updateCollection(editingCollection.id, data);
      } else {
        await addCollection(data);
      }
      setColDialogOpen(false);
      loadAll();
    } catch (err) {
      console.error("Erro ao salvar coleção:", err);
    } finally {
      setSavingCol(false);
    }
  }

  async function handleToggleColField(col: Collection, field: "ativo" | "em_destaque") {
    try {
      await updateCollection(col.id, { [field]: !col[field] });
      setCollections((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, [field]: !c[field] } : c))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteCollection(col: Collection) {
    try {
      await deleteCollection(col.id);
      setCollections((prev) => prev.filter((c) => c.id !== col.id));
    } catch (err) {
      console.error(err);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Catálogo</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {items.length} peças · {collections.length} coleções
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Feedback global */}
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

        {/* ── Tabs Principais ── */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="mb-4">
            <TabsTrigger value={PAGE_TABS.CATALOG} className="gap-2">
              <Layers className="w-4 h-4" /> Catálogo
            </TabsTrigger>
            <TabsTrigger value={PAGE_TABS.COLLECTIONS} className="gap-2">
              <FolderOpen className="w-4 h-4" /> Coleções
              {collections.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 h-4">
                  {collections.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════
              Aba: Catálogo (listagem por grupos)
          ══════════════════════════════════════════ */}
          <TabsContent value={PAGE_TABS.CATALOG}>

            {/* Busca Global */}
            <div className="relative max-w-sm mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou headline…"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : searchQuery.trim() ? (
              /* ── Modo Busca: ignora tabs, mostra todos os resultados ── */
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  {filteredItems.length} resultado(s) para "{searchQuery}"
                </p>
                {filteredItems.length === 0 ? (
                  <EmptyState message="Nenhuma peça encontrada para esta busca." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredItems.map((item) => (
                      <CatalogCard
                        key={item.id}
                        item={item}
                        collections={collections}
                        onOrder={() => openOrderDialog(item)}
                        onEdit={() => openEditDialog(item)}
                        onDelete={() => handleDeleteItem(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Modo Normal: Tabs por Coleção ── */
              <Tabs value={catalogTab} onValueChange={persistCatalogTab}>
                <TabsList className="flex flex-wrap h-auto gap-1 mb-4 bg-muted/40 p-1">
                  <TabsTrigger value="__all__" className="text-xs h-7 px-3 rounded-md">
                    Todos ({items.length})
                  </TabsTrigger>
                  {groupedItems.map((group) => (
                    <TabsTrigger
                      key={group.id}
                      value={group.id}
                      className="text-xs h-7 px-3 rounded-md"
                    >
                      {group.label}
                      <span className="ml-1.5 opacity-60">({group.items.length})</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* Tab Todos */}
                <TabsContent value="__all__">
                  {items.length === 0 ? (
                    <EmptyState message="Use a Calculadora para criar e salvar peças no catálogo." />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {items.map((item) => (
                        <CatalogCard
                          key={item.id}
                          item={item}
                          collections={collections}
                          onOrder={() => openOrderDialog(item)}
                          onEdit={() => openEditDialog(item)}
                          onDelete={() => handleDeleteItem(item)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Tabs por Grupo */}
                {groupedItems.map((group) => (
                  <TabsContent key={group.id} value={group.id}>
                    {group.items.length === 0 ? (
                      <EmptyState message={`Nenhuma peça na coleção "${group.label}".`} />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.items.map((item) => (
                          <CatalogCard
                            key={item.id}
                            item={item}
                            collections={collections}
                            onOrder={() => openOrderDialog(item)}
                            onEdit={() => openEditDialog(item)}
                            onDelete={() => handleDeleteItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════
              Aba: Coleções (CRUD)
          ══════════════════════════════════════════ */}
          <TabsContent value={PAGE_TABS.COLLECTIONS}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Organize os produtos da vitrine em grupos temáticos.
              </p>
              <Button size="sm" onClick={openNewCollection} className="gap-2">
                <FolderPlus className="w-4 h-4" />
                Nova Coleção
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhuma coleção criada ainda.</p>
                <Button size="sm" onClick={openNewCollection} className="gap-2">
                  <FolderPlus className="w-4 h-4" /> Criar primeira coleção
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{col.nome}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          /{col.slug}
                        </code>
                        {col.em_destaque && (
                          <Badge className="text-[10px] px-1.5 h-4 bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            <Star className="w-2.5 h-2.5 mr-0.5" /> Destaque
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {items.filter((i) => i.collectionId === col.id).length} produto(s) · ordem {col.ordem}
                      </p>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleColField(col, "ativo")}
                        className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition ${
                          col.ativo
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                        title="Ativar/desativar na vitrine"
                      >
                        <ToggleLeft className="w-3 h-3" />
                        {col.ativo ? "Ativa" : "Inativa"}
                      </button>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditCollection(col)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            />
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Coleção</AlertDialogTitle>
                            <AlertDialogDescription>
                              A coleção <strong>{col.nome}</strong> será excluída. Os produtos vinculados
                              serão movidos para "Geral". Esta ação é irreversível.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteCollection(col)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modal: Gerar Pedido ─────────────────────────────────────────────── */}
      <ResponsiveModal
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        title="Gerar Pedido"
        description="Adicione produtos ao pedido e defina o preço de venda."
      >
        <div className="space-y-5">

          {/* Nome do cliente */}
          <div className="space-y-2">
            <Label>Nome do Cliente</Label>
            <Input
              placeholder="Ex: Ana Silva"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          {/* ── Seletor de produto ── */}
          <div className="space-y-2">
            <Label>Adicionar Produto ao Pedido</Label>
            <div className="flex gap-2">
              <Select value={pickItemId} onValueChange={(v) => setPickItemId(v ?? "")}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione uma peça..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
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
                onClick={handleAddLineItem}
                disabled={!pickItemId}
              >
                + Add
              </Button>
            </div>
          </div>

          {/* ── Lista de itens adicionados ── */}
          {orderLineItems.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border overflow-hidden text-sm">
              {orderLineItems.map((line) => {
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
                    <span className="font-semibold tabular-nums text-primary shrink-0">
                      {formatBRL(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(line.item.id)}
                      className="text-muted-foreground hover:text-destructive transition shrink-0 ml-1"
                      aria-label="Remover linha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Insumos Extras (INTACTOS) ── */}
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

          {/* ── Resumo de Lote (INTACTO — agora com soma de todos os itens) ── */}
          {totalBatchStats && (
            <>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tempo Estimado Total (lote)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">
                    {formatTime(totalBatchStats.batchTimeInMinutes)}
                  </span>
                  {totalBatchStats.timeSavedInMinutes > 0 && (
                    <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">
                      -{formatTime(totalBatchStats.timeSavedInMinutes)} economizados
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Filamento (lote)</span>
                  <span className="font-medium tabular-nums">
                    {formatBRL(totalBatchStats.batchTotalFilamentCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Máquina (lote)</span>
                  <span className="font-medium tabular-nums">
                    {formatBRL(totalBatchStats.batchTotalMachineCost)}
                  </span>
                </div>
                {totalBatchStats.suppliesCostTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Insumos</span>
                    <span className="font-medium tabular-nums">
                      {formatBRL(totalBatchStats.suppliesCostTotal)}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-1.5 flex justify-between items-center font-semibold">
                  <span>Custo Total</span>
                  <span className="tabular-nums">{formatBRL(totalBatchStats.totalCostWithSupplies)}</span>
                </div>
              </div>
            </>
          )}

          {/* ── Preço de Venda (INTACTO) ── */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Preço de Venda (R$)
            </Label>
            <Input
              type="number"
              step={0.01}
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
            />
            {totalBatchStats && parseFloat(orderPrice) > 0 && (
              <p
                className={`text-xs font-semibold ${
                  totalBatchStats.grossMarginPercent < 0
                    ? "text-red-400"
                    : totalBatchStats.grossMarginPercent < 40
                    ? "text-amber-400"
                    : "text-green-400"
                }`}
              >
                Margem Bruta: {totalBatchStats.grossMarginPercent.toFixed(1)}%
              </p>
            )}
          </div>

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
              {orderPartnerId && totalBatchStats && (() => {
                const p = partners.find((x) => x.id === orderPartnerId);
                const gp = (parseFloat(orderPrice) || 0) - totalBatchStats.totalCostWithSupplies;
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

          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOrderDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto flex-1"
              onClick={handleCreateOrder}
              disabled={orderLineItems.length === 0 || !clientName.trim() || ordering}
            >
              {ordering ? "Criando..." : "Criar Pedido"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Modal: Editar Peça ─────────────────────────────────────────────── */}
      <ResponsiveModal
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Editar Peça"
        description="Altere os parâmetros. O preço sugerido será recalculado."
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da Peça</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Material</Label>
              <Select
                value={editMaterial}
                onValueChange={(v) => setEditMaterial(v || "PLA")}
              >
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
            <div className="space-y-2">
              <Label>Peso (gramas)</Label>
              <Input
                type="number"
                placeholder="0"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tempo (Horas e Minutos)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={editTimeHours}
                onChange={(e) => setEditTimeHours(e.target.value)}
                placeholder="0h"
              />
              <Input
                type="number"
                value={editTimeMinutes}
                onChange={(e) => setEditTimeMinutes(e.target.value)}
                placeholder="0min"
                max={59}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Substituir Foto</Label>
            <ImageUpload onImageSelected={setEditImageFile} />
            {editingItem?.imageUrl && !editImageFile && (
              <p className="text-xs text-muted-foreground">
                Deixe em branco para manter a foto atual.
              </p>
            )}
          </div>

          {/* Coleção */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" /> Coleção
            </Label>
            <Select value={editCollectionId || "__none__"} onValueChange={(v) => setEditCollectionId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="(sem coleção)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem coleção (Geral) —</SelectItem>
                {collections.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seção de Marketing */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vitrine Pública
            </p>

            <div className="flex items-center gap-3">
              <Checkbox
                id="edit-showInStore"
                checked={editShowInStore}
                onCheckedChange={(c) => {
                  setEditShowInStore(!!c);
                  if (!c) setEditDestaque(false);
                }}
              />
              <label htmlFor="edit-showInStore" className="text-sm font-medium cursor-pointer">
                Exibir na loja pública
              </label>
            </div>

            {editShowInStore && (
              <div className="flex items-center gap-3 pl-5">
                <Checkbox
                  id="edit-destaque"
                  checked={editDestaque}
                  onCheckedChange={(c) => setEditDestaque(!!c)}
                />
                <label htmlFor="edit-destaque" className="text-sm font-medium cursor-pointer">
                  Produto em destaque
                  <span className="ml-1.5 text-xs text-muted-foreground">(aparece primeiro)</span>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Nome Comercial{" "}
                <span className="text-muted-foreground font-normal">(headline)</span>
              </Label>
              <Input
                placeholder="Ex: Chaveiro Tech Connect"
                value={editHeadlineVenda}
                onChange={(e) => setEditHeadlineVenda(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nome de venda exibido na vitrine. Se vazio, usa o nome técnico.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descrição de Venda</Label>
              <textarea
                className="w-full min-h-[80px] resize-y text-sm rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Ex: Compartilhe suas redes sociais com um toque. Chip NFC programável."
                value={editDescricaoVenda}
                onChange={(e) => setEditDescricaoVenda(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preço de Venda (Loja Pública)</Label>
                {editingItem && (
                  <span className="text-xs text-muted-foreground">
                    Sugerido:{" "}
                    <span className="font-semibold text-primary">
                      {formatBRL(editingItem.calculated_price)}
                    </span>
                  </span>
                )}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={editingItem ? editingItem.calculated_price.toFixed(2) : "0.00"}
                value={editPrecoVendaLoja}
                onChange={(e) => setEditPrecoVendaLoja(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para exibir o preço sugerido calculado automaticamente.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveEdit}
              disabled={savingEdit || editName.trim() === ""}
            >
              {savingEdit ? "Salvando..." : "Salvar Edição"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Modal: Criar / Editar Coleção ──────────────────────────────────── */}
      <ResponsiveModal
        open={colDialogOpen}
        onOpenChange={setColDialogOpen}
        title={editingCollection ? "Editar Coleção" : "Nova Coleção"}
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da Coleção *</Label>
            <Input
              placeholder="Ex: Dia das Mães"
              value={colNome}
              onChange={(e) => {
                setColNome(e.target.value);
                // Auto-gera slug apenas se não foi editado manualmente
                if (!editingCollection) setColSlug(slugify(e.target.value));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Slug <span className="text-muted-foreground font-normal">(URL)</span>
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">?categoria=</span>
              <Input
                placeholder="dia-das-maes"
                value={colSlug}
                onChange={(e) => setColSlug(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Gerado automaticamente do nome. Não use espaços ou acentos.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Ordem de Exibição</Label>
            <Input
              type="number"
              min={0}
              value={colOrdem}
              onChange={(e) => setColOrdem(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Menor número = aparece primeiro.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="col-ativo"
                checked={colAtivo}
                onCheckedChange={(c) => setColAtivo(!!c)}
              />
              <label htmlFor="col-ativo" className="text-sm font-medium cursor-pointer">
                Ativa na vitrine
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="col-destaque"
                checked={colEmDestaque}
                onCheckedChange={(c) => setColEmDestaque(!!c)}
              />
              <label htmlFor="col-destaque" className="text-sm font-medium cursor-pointer">
                Em destaque
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setColDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveCollection}
              disabled={savingCol || !colNome.trim()}
            >
              {savingCol ? "Salvando..." : editingCollection ? "Salvar" : "Criar Coleção"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <Package className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function CatalogCard({
  item,
  collections,
  onOrder,
  onEdit,
  onDelete,
}: {
  item: CatalogItem;
  collections: Collection[];
  onOrder: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const norm = normalizeItem(item);
  const matClass = MATERIAL_COLORS[norm.material] ?? "bg-muted";
  const itemCollection = collections.find((c) => c.id === item.collectionId);

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
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                />
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir do Catálogo</AlertDialogTitle>
                <AlertDialogDescription>
                  Você tem certeza? A peça será excluída permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex items-start justify-between gap-2 pr-12">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
            {item.headline_venda && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.headline_venda}</p>
            )}
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 font-semibold ${matClass}`}>
            {norm.material}
          </Badge>
        </div>

        {/* Badge de coleção */}
        {itemCollection && (
          <Badge variant="outline" className="w-fit text-[10px] mt-1 gap-1 text-muted-foreground">
            <FolderOpen className="w-2.5 h-2.5" /> {itemCollection.nome}
          </Badge>
        )}

        {/* Badges de vitrine */}
        <div className="flex gap-1 flex-wrap mt-1">
          {item.showInStore && (
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
              🛍 Loja
            </Badge>
          )}
          {item.destaque && (
            <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-500/30 bg-orange-500/5">
              ⭐ Destaque
            </Badge>
          )}
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
              <p className="text-[10px] text-muted-foreground">Peso</p>
              <p className="text-xs font-medium">{norm.weight_grams}g</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border mt-3">
          <div className="mt-2">
            {item.preco_venda_loja && item.preco_venda_loja > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">Preço Loja</p>
                <p className="text-xl font-bold text-primary">{formatBRL(item.preco_venda_loja)}</p>
                <p className="text-[10px] text-muted-foreground/60 line-through">
                  {formatBRL(item.calculated_price)}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Preço Sugerido</p>
                <p className="text-xl font-bold text-primary">{formatBRL(item.calculated_price)}</p>
              </>
            )}
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
