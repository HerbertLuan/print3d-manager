"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  PlayCircle,
  RefreshCw,
  Search,
  Globe,
  MoreVertical,
  Edit2,
  Trash2,
  Info,
  InboxIcon,
  ShoppingCart,
  Hash,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResponsiveModal } from "@/components/ui/responsive-modal";

import {
  getOrders,
  updateOrderPaymentStatus,
  deleteOrder,
  updateOrder,
} from "@/lib/firestore";
import { Order, PaymentStatus, ProductionStatus, CartItem } from "@/lib/types";
import { formatBRL, formatTime, calculateBatchTimeAndCost, DEFAULT_PROFIT_MARGIN, FILAMENT_COST_PER_KG } from "@/lib/calculations";

// ─── Configuração das colunas Kanban ─────────────────────────────────────────

interface KanbanColumn {
  status: ProductionStatus;
  label: string;
  icon: React.FC<{ className?: string }>;
  headerClass: string;
  badgeClass: string;
  emptyText: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    status: "pending_approval",
    label: "Aprovar (Site)",
    icon: InboxIcon,
    headerClass: "border-amber-500/30 bg-amber-500/5",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    emptyText: "Nenhum pedido pendente do site.",
  },
  {
    status: "Na Fila",
    label: "Na Fila",
    icon: Clock,
    headerClass: "border-slate-500/30 bg-slate-500/5",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    emptyText: "Nenhum pedido na fila.",
  },
  {
    status: "Imprimindo",
    label: "Imprimindo",
    icon: PlayCircle,
    headerClass: "border-blue-500/30 bg-blue-500/5",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emptyText: "Nada sendo impresso agora.",
  },
  {
    status: "Concluído",
    label: "Concluído",
    icon: CheckCircle2,
    headerClass: "border-emerald-500/30 bg-emerald-500/5",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    emptyText: "Nenhum pedido concluído.",
  },
];

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  "Pendente": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "Pago": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula custo de filamento de um CartItem usando o preço do catálogo */
function estimateCartItemCosts(item: CartItem) {
  // Usa PLA como fallback já que CartItem não tem material
  const costPerKg = FILAMENT_COST_PER_KG["PLA"];
  // ~15g por unidade como estimativa conservadora sem dados do catálogo
  const filamentCostUnit = (15 / 1000) * costPerKg * item.quantity;
  const batch = calculateBatchTimeAndCost({
    unitTimeMinutes: 60, // 1h fallback sem dados do catálogo
    quantity: item.quantity,
    unitWeightGrams: 15,
    material: "PLA",
    profitMarginPercent: DEFAULT_PROFIT_MARGIN * 100,
  });
  return {
    filament_cost: batch.batchTotalFilamentCost,
    machine_cost: batch.batchTotalMachineCost,
    batch_time_minutes: batch.batchTimeInMinutes,
    timeSaved: batch.timeSavedInMinutes,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [deleteOrderData, setDeleteOrderData] = useState<Order | null>(null);
  const [infoOrder, setInfoOrder] = useState<Order | null>(null);

  // ── Approval modal state (pending_approval) ──
  const [approvalOrder, setApprovalOrder] = useState<Order | null>(null);
  const [approvalPrice, setApprovalPrice] = useState("");
  const [approvalClientName, setApprovalClientName] = useState("");
  const [savingApproval, setSavingApproval] = useState(false);

  // ── Edit state ──
  const [editOrderData, setEditOrderData] = useState<Order | null>(null);
  const [editHandle, setEditHandle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editProdStatus, setEditProdStatus] = useState<ProductionStatus>("Na Fila");
  const [editPayStatus, setEditPayStatus] = useState<PaymentStatus>("Pendente");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.piece_name.toLowerCase().includes(q) ||
        o.instagram_handle.toLowerCase().includes(q) ||
        (o.cliente_nome ?? "").toLowerCase().includes(q) ||
        (o.shortCode ?? "").toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  // Agrupa por coluna
  const ordersByStatus = useMemo(() => {
    const map = new Map<ProductionStatus, Order[]>();
    for (const col of KANBAN_COLUMNS) map.set(col.status, []);
    for (const order of filteredOrders) {
      const bucket = map.get(order.production_status);
      if (bucket) bucket.push(order);
      else map.set(order.production_status, [order]);
    }
    return map;
  }, [filteredOrders]);

  async function handlePaymentToggle(order: Order) {
    const newStatus: PaymentStatus = order.payment_status === "Pago" ? "Pendente" : "Pago";
    const todayStr = new Date().toLocaleDateString("en-CA");
    const newPaidAt = newStatus === "Pago" ? todayStr : undefined;

    try {
      await updateOrderPaymentStatus(order.id, newStatus, newPaidAt);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, payment_status: newStatus, paid_at: newPaidAt } : o
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  // ── BUGFIX: sem filaments_deducted (undefined → FirebaseError) ──
  async function handleProductionTransition(order: Order, newStatus: ProductionStatus) {
    if (order.production_status === newStatus) return;
    try {
      await updateOrder(order.id, { production_status: newStatus });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, production_status: newStatus } : o
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  // ── Approval: abre modal e pré-calcula custo ──
  function openApprovalModal(order: Order) {
    setApprovalOrder(order);
    setApprovalClientName(order.cliente_nome || "");
    // Usa valor_total do pedido do site como preço inicial
    const initialPrice = (order as any).valor_total ?? order.price ?? 0;
    setApprovalPrice(initialPrice.toFixed(2));
  }

  async function handleApprove() {
    if (!approvalOrder) return;
    setSavingApproval(true);
    try {
      const price = parseFloat(approvalPrice) || 0;

      // Calcula estimativa de custo total dos cart_items
      let totalFilament = 0;
      let totalMachine = 0;
      let totalBatchTime = 0;

      if (approvalOrder.cart_items && approvalOrder.cart_items.length > 0) {
        for (const ci of approvalOrder.cart_items) {
          const costs = estimateCartItemCosts(ci);
          totalFilament += costs.filament_cost;
          totalMachine += costs.machine_cost;
          totalBatchTime += costs.batch_time_minutes;
        }
      }

      const updatePayload: Partial<Order> = {
        production_status: "Na Fila",
        price,
        ...(approvalClientName.trim() ? { cliente_nome: approvalClientName.trim() } : {}),
        // Salva custos calculados — editáveis depois via modal de edição
        filament_cost: totalFilament,
        machine_cost: totalMachine,
        batch_time_minutes: totalBatchTime,
        custo_operacional_total: totalFilament + totalMachine,
        base_cost: totalFilament + totalMachine,
      };

      await updateOrder(approvalOrder.id, updatePayload);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === approvalOrder.id ? { ...o, ...updatePayload } : o
        )
      );
      setApprovalOrder(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingApproval(false);
    }
  }

  function openEdit(order: Order) {
    setEditOrderData(order);
    setEditHandle(order.cliente_nome || order.instagram_handle || "");
    setEditPrice(order.price.toString());
    setEditProdStatus(order.production_status);
    setEditPayStatus(order.payment_status);
  }

  // ── BUGFIX: sem filaments_deducted ──
  async function handleSaveEdit() {
    if (!editOrderData || !editHandle.trim()) return;
    setSavingEdit(true);
    try {
      const p = parseFloat(editPrice) || 0;
      await updateOrder(editOrderData.id, {
        instagram_handle: editHandle.trim(),
        cliente_nome: editHandle.trim(),
        price: p,
        production_status: editProdStatus,
        payment_status: editPayStatus,
      });
      setEditOrderData(null);
      loadOrders();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteOrderData) return;
    try {
      await deleteOrder(deleteOrderData);
      setOrders((prev) => prev.filter((o) => o.id !== deleteOrderData.id));
      setDeleteOrderData(null);
    } catch (err) {
      console.error(err);
    }
  }

  // Calcula stats do approvalOrder com os cart_items
  const approvalStats = useMemo(() => {
    if (!approvalOrder?.cart_items) return null;
    let totalFilament = 0;
    let totalMachine = 0;
    let totalTime = 0;
    let totalSaved = 0;
    for (const ci of approvalOrder.cart_items) {
      const costs = estimateCartItemCosts(ci);
      totalFilament += costs.filament_cost;
      totalMachine += costs.machine_cost;
      totalTime += costs.batch_time_minutes;
      totalSaved += costs.timeSaved;
    }
    const price = parseFloat(approvalPrice) || 0;
    const totalCost = totalFilament + totalMachine;
    const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;
    return { totalFilament, totalMachine, totalTime, totalSaved, totalCost, margin };
  }, [approvalOrder, approvalPrice]);

  return (
    <div className="flex-1 p-4 md:p-6 overflow-x-auto">
      <div className="min-w-[900px]">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Kanban de Pedidos</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Pedidos do site entram na coluna <strong>Aprovar</strong>. Clique em "Aprovar" para revisar e mover para <strong>Na Fila</strong>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, peça ou código..."
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.status} className="space-y-3">
                <div className="h-8 bg-muted animate-pulse rounded-lg" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 items-start">
            {KANBAN_COLUMNS.map((col) => {
              const colOrders = ordersByStatus.get(col.status) ?? [];
              const Icon = col.icon;
              return (
                <div key={col.status} className="flex flex-col gap-3">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${col.headerClass}`}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${col.badgeClass}`}>
                      {colOrders.length}
                    </span>
                  </div>

                  {/* Cards */}
                  {colOrders.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground/50 border border-dashed border-border rounded-xl">
                      {col.emptyText}
                    </div>
                  ) : (
                    colOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        col={col}
                        onTransition={handleProductionTransition}
                        onPaymentToggle={handlePaymentToggle}
                        onEdit={openEdit}
                        onInfo={setInfoOrder}
                        onDelete={setDeleteOrderData}
                        onApprove={openApprovalModal}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Aprovar Pedido do Site ── */}
      <ResponsiveModal
        open={!!approvalOrder}
        onOpenChange={(v) => !v && setApprovalOrder(null)}
        title="Aprovar Pedido do Site"
        description={approvalOrder?.shortCode ? `Código: #${approvalOrder.shortCode}` : "Revisar e aprovar pedido recebido"}
      >
        {approvalOrder && (
          <div className="space-y-5 py-2">
            {/* Short code badge */}
            {approvalOrder.shortCode && (
              <div className="flex items-center gap-2 p-3 bg-sky-500/5 border border-sky-500/20 rounded-lg">
                <Hash className="w-4 h-4 text-sky-400" />
                <span className="text-sm text-sky-300">
                  Pedido recebido via WhatsApp com código{" "}
                  <span className="font-mono font-bold text-white">#{approvalOrder.shortCode}</span>
                </span>
              </div>
            )}

            {/* Itens do carrinho */}
            {approvalOrder.cart_items && approvalOrder.cart_items.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Itens do Pedido
                </Label>
                <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border overflow-hidden text-sm">
                  {approvalOrder.cart_items.map((ci, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2">
                      <span className="text-foreground">
                        {ci.quantity}× {ci.displayName}
                      </span>
                      <span className="font-semibold tabular-nums text-primary">
                        {formatBRL(ci.unitPrice * ci.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 font-semibold">
                    <span>Total do Carrinho</span>
                    <span className="tabular-nums">
                      {formatBRL(approvalOrder.cart_items.reduce((s, c) => s + c.unitPrice * c.quantity, 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Estimativa de custo automatica */}
            {approvalStats && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Estimativa de custo (calculada automaticamente)
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Filamento (est.)</span>
                  <span className="font-medium tabular-nums">{formatBRL(approvalStats.totalFilament)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Máquina (est.)</span>
                  <span className="font-medium tabular-nums">{formatBRL(approvalStats.totalMachine)}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between items-center font-semibold">
                  <span>Custo Est. Total</span>
                  <span className="tabular-nums">{formatBRL(approvalStats.totalCost)}</span>
                </div>
                {approvalStats.totalSaved > 0 && (
                  <p className="text-[10px] text-green-400 font-medium">
                    ✓ Economia por lote: {formatTime(approvalStats.totalSaved)}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  * Estimativa conservadora (15g/1h por unid.). Edite os custos reais em "Editar" após aprovação.
                </p>
              </div>
            )}

            {/* Nome cliente (editável) */}
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                value={approvalClientName}
                onChange={(e) => setApprovalClientName(e.target.value)}
                placeholder="Nome identificado pelo WhatsApp"
              />
            </div>

            {/* Preço de venda (editável) */}
            <div className="space-y-2">
              <Label>Preço de Venda Final (R$)</Label>
              <Input
                type="number"
                step={0.01}
                value={approvalPrice}
                onChange={(e) => setApprovalPrice(e.target.value)}
              />
              {approvalStats && parseFloat(approvalPrice) > 0 && (
                <p className={`text-xs font-semibold ${
                  approvalStats.margin < 0 ? "text-red-400"
                  : approvalStats.margin < 40 ? "text-amber-400"
                  : "text-green-400"
                }`}>
                  Margem Bruta Est.: {approvalStats.margin.toFixed(1)}%
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setApprovalOrder(null)} disabled={savingApproval}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleApprove} disabled={savingApproval}>
                {savingApproval ? "Aprovando..." : "✓ Aprovar → Na Fila"}
              </Button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* ── Modal: Info do Pedido ── */}
      <ResponsiveModal
        open={!!infoOrder}
        onOpenChange={(v) => !v && setInfoOrder(null)}
        title="Detalhamento do Pedido"
        description={infoOrder ? `${infoOrder.piece_name} · ${infoOrder.quantity || 1}x` : ""}
      >
        {infoOrder && <OrderInfoContent order={infoOrder} />}
      </ResponsiveModal>

      {/* ── Modal: Editar Pedido ── */}
      <ResponsiveModal
        open={!!editOrderData}
        onOpenChange={(v) => !v && setEditOrderData(null)}
        title="Editar Pedido"
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do Cliente</Label>
            <Input value={editHandle} onChange={(e) => setEditHandle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Preço de Venda Final (R$)</Label>
            <Input type="number" step={0.01} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status Produção</Label>
              <Select value={editProdStatus} onValueChange={(v) => setEditProdStatus(v as ProductionStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_approval">Aprovar (Site)</SelectItem>
                  <SelectItem value="Na Fila">Na Fila</SelectItem>
                  <SelectItem value="Imprimindo">Imprimindo</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Pagamento</Label>
              <Select value={editPayStatus} onValueChange={(v) => setEditPayStatus(v as PaymentStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditOrderData(null)} disabled={savingEdit}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSaveEdit} disabled={!editHandle.trim() || savingEdit}>
              {savingEdit ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Dialog: Excluir Pedido ── */}
      <AlertDialog open={!!deleteOrderData} onOpenChange={(v) => !v && setDeleteOrderData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido de{" "}
              <strong>{deleteOrderData?.cliente_nome || deleteOrderData?.instagram_handle}</strong>?
              Esta ação removerá o pedido dos registros financeiros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── OrderCard (cartão do Kanban) ─────────────────────────────────────────────

function OrderCard({
  order, col, onTransition, onPaymentToggle, onEdit, onInfo, onDelete, onApprove,
}: {
  order: Order;
  col: KanbanColumn;
  onTransition: (o: Order, s: ProductionStatus) => void;
  onPaymentToggle: (o: Order) => void;
  onEdit: (o: Order) => void;
  onInfo: (o: Order) => void;
  onDelete: (o: Order) => void;
  onApprove: (o: Order) => void;
}) {
  const isWebOrder = order.origem === "site";
  const isPendingApproval = order.production_status === "pending_approval";
  const clientLabel = order.cliente_nome || order.instagram_handle;

  // Quantidade: soma cart_items ou items, senão quantity legado
  const qty =
    order.items?.reduce((s, i) => s + i.quantidade, 0) ||
    order.cart_items?.reduce((s, i) => s + i.quantity, 0) ||
    order.quantity ||
    1;

  // Próximo passo do Kanban (nunca a partir de pending_approval via botão rápido)
  const nextStatus: ProductionStatus | null =
    order.production_status === "Na Fila" ? "Imprimindo"
    : order.production_status === "Imprimindo" ? "Concluído"
    : null;

  const nextLabel =
    order.production_status === "Na Fila" ? "Iniciar Impressão"
    : order.production_status === "Imprimindo" ? "Finalizar"
    : null;

  return (
    <Card className="border-border hover:border-primary/20 transition-all flex flex-col pt-1 text-sm">
      <CardHeader className="p-3 pb-0 flex flex-row items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Tag: origem site + short code */}
          {isWebOrder && (
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-sky-400" />
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                  Origem: Site
                </span>
              </div>
              {order.shortCode && (
                <span className="flex items-center gap-0.5 font-mono text-[10px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
                  <Hash className="w-2.5 h-2.5" />
                  {order.shortCode}
                </span>
              )}
            </div>
          )}

          <p className="font-semibold text-foreground leading-tight truncate">{order.piece_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{clientLabel} · {qty}x</p>
        </div>

        {/* Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" />}>
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              {isPendingApproval && (
                <DropdownMenuItem onClick={() => onApprove(order)}>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Aprovar Pedido
                </DropdownMenuItem>
              )}
              {nextStatus && (
                <DropdownMenuItem onClick={() => onTransition(order, nextStatus)}>
                  <PlayCircle className="w-4 h-4 mr-2" /> {nextLabel}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onInfo(order)}>
                <Info className="w-4 h-4 mr-2" /> Ver Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(order)}>
                <Edit2 className="w-4 h-4 mr-2 text-blue-500" /> Editar
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onDelete(order)} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="p-3 pt-2 space-y-2 border-t border-border mt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {isWebOrder ? "Pedido Web" : order.material}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className={`h-5 px-2 text-[10px] border ${PAYMENT_COLORS[order.payment_status]} hover:opacity-80`}
            onClick={() => onPaymentToggle(order)}
          >
            {order.payment_status}
          </Button>
        </div>

        <div className="flex items-center justify-between bg-muted/40 px-2 py-1.5 rounded-lg border border-border">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Venda</span>
          <span className="font-bold text-primary">{formatBRL(order.price)}</span>
        </div>

        {/* Botão aprovar (pending_approval) */}
        {isPendingApproval && (
          <button
            onClick={() => onApprove(order)}
            className="w-full text-[11px] font-medium py-1.5 rounded-lg border border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/5 transition"
          >
            Aprovar Pedido →
          </button>
        )}

        {/* Botão de transição rápida (demais status) */}
        {nextStatus && (
          <button
            onClick={() => onTransition(order, nextStatus)}
            className="w-full text-[11px] font-medium py-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition"
          >
            {nextLabel} →
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── OrderInfoContent ─────────────────────────────────────────────────────────

function OrderInfoContent({ order }: { order: Order }) {
  const totalCost = (order.filament_cost || 0) + (order.machine_cost || 0) + (order.supplies_cost || 0);
  const grossMargin = order.price > 0 ? ((order.price - totalCost) / order.price) * 100 : 0;

  return (
    <div className="space-y-4 py-2">

      {/* ── Itens do pedido (novo formato multi-item) ── */}
      {order.items && order.items.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border overflow-hidden">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-4 py-2">
            Itens do Pedido
          </p>
          {order.items.map((it, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-foreground">{it.quantidade}× {it.nome}</span>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {formatBRL(it.preco_unitario)}/un
                </span>
              </div>
              <span className="font-semibold tabular-nums text-primary">
                {formatBRL(it.preco_unitario * it.quantidade)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Cart items legados (pedidos do site antes do multi-item) ── */}
      {order.origem === "site" && (!order.items || order.items.length === 0) && order.cart_items && order.cart_items.length > 0 && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Pedido via Site
            {order.shortCode && (
              <span className="font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full ml-1">
                #{order.shortCode}
              </span>
            )}
          </p>
          {order.cart_items.map((ci, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              • {ci.quantity}x {ci.displayName} — {formatBRL(ci.unitPrice * ci.quantity)}
            </p>
          ))}
          {order.cliente_telefone && (
            <p className="text-xs text-muted-foreground">Tel: {order.cliente_telefone}</p>
          )}
        </div>
      )}

      {/* ── Tempo de lote + Material ── */}
      <div className="grid grid-cols-2 gap-3">
        {order.batch_time_minutes != null && (
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Tempo de Lote</p>
            <p className="font-semibold">{formatTime(order.batch_time_minutes)}</p>
          </div>
        )}
        <div className="bg-muted/40 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Material</p>
          <p className="font-semibold">{order.material}</p>
        </div>
      </div>

      {/* ── Detalhamento de Custos (INTOCÁVEL) ── */}
      <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Filamento (lote)</span>
          <span className="font-medium tabular-nums">{formatBRL(order.filament_cost || 0)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Máquina (lote)</span>
          <span className="font-medium tabular-nums">{formatBRL(order.machine_cost || 0)}</span>
        </div>
        {(order.supplies_cost || 0) > 0 && (
          <div className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Insumos</span>
            <span className="font-medium tabular-nums">{formatBRL(order.supplies_cost || 0)}</span>
          </div>
        )}
        <div className="flex justify-between items-center px-4 py-2.5 text-sm font-semibold bg-muted/30">
          <span>Custo Total</span>
          <span className="tabular-nums">{formatBRL(totalCost)}</span>
        </div>
      </div>

      {/* ── Preço + Margem Bruta (INTOCÁVEL) ── */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 divide-y divide-border overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Preço de Venda</span>
          <span className="font-bold text-primary tabular-nums">{formatBRL(order.price)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Margem Bruta</span>
          <span className={`font-bold tabular-nums ${grossMargin < 0 ? "text-red-400" : grossMargin < 40 ? "text-amber-400" : "text-green-400"}`}>
            {grossMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ── Insumos (INTOCÁVEL) ── */}
      {order.supplies && order.supplies.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Insumos incluídos:</p>
          {order.supplies.map((s, i) => (
            <p key={i}>• {s.name} × {s.quantity} — {formatBRL(s.unit_cost * s.quantity)}</p>
          ))}
        </div>
      )}
    </div>
  );
}
