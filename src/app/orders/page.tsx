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
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  consumeFilamentsTransaction,
} from "@/lib/firestore";
import { Order, PaymentStatus, ProductionStatus } from "@/lib/types";
import { formatBRL, formatTime } from "@/lib/calculations";

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [deleteOrderData, setDeleteOrderData] = useState<Order | null>(null);
  const [infoOrder, setInfoOrder] = useState<Order | null>(null);

  // Edit State
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
        (o.cliente_nome ?? "").toLowerCase().includes(q)
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
    try {
      await updateOrderPaymentStatus(order.id, newStatus);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, payment_status: newStatus } : o
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleProductionTransition(order: Order, newStatus: ProductionStatus) {
    if (order.production_status === newStatus) return;
    try {
      let isDeducted = order.filaments_deducted;
      if (
        newStatus === "Concluído" &&
        !order.filaments_deducted &&
        order.used_filaments &&
        order.used_filaments.length > 0
      ) {
        await consumeFilamentsTransaction(order.used_filaments);
        isDeducted = true;
      }
      await updateOrder(order.id, { production_status: newStatus, filaments_deducted: isDeducted });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, production_status: newStatus, filaments_deducted: isDeducted }
            : o
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  function openEdit(order: Order) {
    setEditOrderData(order);
    setEditHandle(order.instagram_handle || order.cliente_nome || "");
    setEditPrice(order.price.toString());
    setEditProdStatus(order.production_status);
    setEditPayStatus(order.payment_status);
  }

  async function handleSaveEdit() {
    if (!editOrderData || !editHandle.trim()) return;
    setSavingEdit(true);
    try {
      const p = parseFloat(editPrice) || 0;
      let isDeducted = editOrderData.filaments_deducted;
      if (
        editProdStatus === "Concluído" &&
        editOrderData.production_status !== "Concluído" &&
        !editOrderData.filaments_deducted &&
        editOrderData.used_filaments &&
        editOrderData.used_filaments.length > 0
      ) {
        await consumeFilamentsTransaction(editOrderData.used_filaments);
        isDeducted = true;
      }
      await updateOrder(editOrderData.id, {
        instagram_handle: editHandle.trim(),
        price: p,
        production_status: editProdStatus,
        payment_status: editPayStatus,
        filaments_deducted: isDeducted,
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
              Pedidos do site entram na coluna <strong>Aprovar</strong>. Mova para <strong>Na Fila</strong> após confirmar com o cliente.
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
            placeholder="Buscar por cliente ou peça..."
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
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
            <Label>Instagram / Cliente</Label>
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
              <strong>{deleteOrderData?.instagram_handle || deleteOrderData?.cliente_nome}</strong>?
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
  order, col, onTransition, onPaymentToggle, onEdit, onInfo, onDelete,
}: {
  order: Order;
  col: KanbanColumn;
  onTransition: (o: Order, s: ProductionStatus) => void;
  onPaymentToggle: (o: Order) => void;
  onEdit: (o: Order) => void;
  onInfo: (o: Order) => void;
  onDelete: (o: Order) => void;
}) {
  const isWebOrder = order.origem === "site";
  const clientLabel = order.cliente_nome || order.instagram_handle;
  const qty = order.quantity || (order.cart_items?.reduce((s, i) => s + i.quantity, 0)) || 1;

  // Ações disponíveis por status
  const nextStatus: ProductionStatus | null =
    order.production_status === "pending_approval" ? "Na Fila"
    : order.production_status === "Na Fila" ? "Imprimindo"
    : order.production_status === "Imprimindo" ? "Concluído"
    : null;

  const nextLabel =
    order.production_status === "pending_approval" ? "Aprovar → Na Fila"
    : order.production_status === "Na Fila" ? "Iniciar Impressão"
    : order.production_status === "Imprimindo" ? "Finalizar"
    : null;

  return (
    <Card className="border-border hover:border-primary/20 transition-all flex flex-col pt-1 text-sm">
      <CardHeader className="p-3 pb-0 flex flex-row items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Tag: origem site */}
          {isWebOrder && (
            <div className="flex items-center gap-1 mb-1.5">
              <Globe className="w-3 h-3 text-sky-400" />
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                Origem: Site
              </span>
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
            {isWebOrder ? order.cliente_telefone || "—" : order.material}
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

        {/* Botão de transição rápida */}
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
      {order.origem === "site" && order.cart_items && order.cart_items.length > 0 && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Pedido via Site
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
