"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  PlayCircle,
  RefreshCw,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  AlertCircle
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  consumeFilamentsTransaction
} from "@/lib/firestore";
import { Order, PaymentStatus, ProductionStatus } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";

const STATUS_COLORS: Record<ProductionStatus, string> = {
  "Na Fila": "bg-slate-500/10 text-slate-500 border-slate-500/20",
  "Imprimindo": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Concluído": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  "Pendente": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "Pago": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | ProductionStatus>("Todos");
  
  const [deleteOrderData, setDeleteOrderData] = useState<Order | null>(null);
  
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
    return orders.filter(o => {
      const matchesSearch = 
        o.piece_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.instagram_handle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "Todos" || o.production_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  async function handlePaymentToggle(order: Order) {
    const newStatus: PaymentStatus = order.payment_status === "Pago" ? "Pendente" : "Pago";
    try {
      await updateOrderPaymentStatus(order.id, newStatus);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_status: newStatus } : o));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleProductionTransition(order: Order, newStatus: ProductionStatus) {
    if (order.production_status === newStatus) return;
    try {
      let isDeducted = order.filaments_deducted;
      
      // Gatilho de Consumo
      if (newStatus === "Concluído" && !order.filaments_deducted && order.used_filaments && order.used_filaments.length > 0) {
        await consumeFilamentsTransaction(order.used_filaments);
        isDeducted = true;
      }

      await updateOrder(order.id, { 
        production_status: newStatus,
        filaments_deducted: isDeducted
      });

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, production_status: newStatus, filaments_deducted: isDeducted } : o));
    } catch (err) {
      console.error(err);
    }
  }

  function openEdit(order: Order) {
    setEditOrderData(order);
    setEditHandle(order.instagram_handle);
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

      // Se mudou para Concluído manualmente na edição
      if (editProdStatus === "Concluído" && editOrderData.production_status !== "Concluído" && !editOrderData.filaments_deducted && editOrderData.used_filaments && editOrderData.used_filaments.length > 0) {
        await consumeFilamentsTransaction(editOrderData.used_filaments);
        isDeducted = true;
      }

      await updateOrder(editOrderData.id, {
        instagram_handle: editHandle.trim(),
        price: p,
        production_status: editProdStatus,
        payment_status: editPayStatus,
        filaments_deducted: isDeducted
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
      setOrders(prev => prev.filter(o => o.id !== deleteOrderData.id));
      setDeleteOrderData(null);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Acompanhamento</h1>
            </div>
            <p className="text-muted-foreground">Gerencie o fluxo de confecção dos pedidos em andamento.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente ou peça..." 
              className="pl-9 w-full bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
             <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[180px] pl-9 bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos os Status</SelectItem>
                    <SelectItem value="Na Fila">Na Fila</SelectItem>
                    <SelectItem value="Imprimindo">Imprimindo</SelectItem>
                    <SelectItem value="Concluído">Concluído</SelectItem>
                  </SelectContent>
                </Select>
             </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground max-w-sm">Não há pedidos ativos que correspondam aos filtros atuais.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {filteredOrders.map(order => {
               const qty = order.quantity || 1;
               const isAssigned = order.assigned_from_inventory;
               return (
                 <Card key={order.id} className="border-border hover:border-primary/20 transition-all flex flex-col pt-1">
                    <CardHeader className="p-4 pb-0 flex flex-row items-start justify-between">
                       <div>
                         <Badge variant="outline" className={`mb-3 ${STATUS_COLORS[order.production_status]}`}>
                           {order.production_status === "Na Fila" && <Clock className="w-3 h-3 mr-1" />}
                           {order.production_status === "Imprimindo" && <PlayCircle className="w-4 h-4 mr-2" />}
                           {order.production_status === "Concluído" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                           {order.production_status}
                         </Badge>
                         <h3 className="font-semibold text-sm leading-tight text-foreground line-clamp-2 pr-4">{order.piece_name}</h3>
                         <p className="text-xs text-muted-foreground mt-1">
                           {qty}x • {order.material} {isAssigned && "(Estoque)"}
                         </p>
                       </div>
                       <DropdownMenu>
                         <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground" />}>
                           <MoreVertical className="h-4 w-4" />
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="w-48">
                           <DropdownMenuGroup>
                             <DropdownMenuLabel>Ações</DropdownMenuLabel>
                             {order.production_status !== "Concluído" && (
                               <>
                                 {order.production_status === "Na Fila" ? (
                                   <DropdownMenuItem onClick={() => handleProductionTransition(order, "Imprimindo")}>
                                     <PlayCircle className="w-4 h-4 mr-2" /> Iniciar Impressão
                                   </DropdownMenuItem>
                                 ) : (
                                   <DropdownMenuItem onClick={() => handleProductionTransition(order, "Concluído")}>
                                     <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar Impressão
                                   </DropdownMenuItem>
                                 )}
                               </>
                             )}
                           </DropdownMenuGroup>
                           <DropdownMenuSeparator />
                           <DropdownMenuGroup>
                             <DropdownMenuItem onClick={() => openEdit(order)}>
                               <Edit2 className="w-4 h-4 mr-2 text-blue-500" /> Editar Cadastro
                             </DropdownMenuItem>
                           </DropdownMenuGroup>
                           <DropdownMenuSeparator />
                           <DropdownMenuGroup>
                             <DropdownMenuItem onClick={() => setDeleteOrderData(order)} className="text-destructive focus:text-destructive">
                               <Trash2 className="w-4 h-4 mr-2" /> Excluir Pedido
                             </DropdownMenuItem>
                           </DropdownMenuGroup>
                         </DropdownMenuContent>
                       </DropdownMenu>
                    </CardHeader>
                    <CardContent className="p-4 pt-3 mt-auto border-t border-border mt-3 space-y-3">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5 text-sm text-foreground">
                           <span className="font-medium">{order.instagram_handle}</span>
                         </div>
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className={`h-6 px-2 text-xs border ${PAYMENT_COLORS[order.payment_status]} hover:opacity-80`}
                           onClick={() => handlePaymentToggle(order)}
                         >
                           {order.payment_status}
                         </Button>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Custo</span>
                         <span className="text-sm font-semibold">{formatBRL(order.base_cost || 0)}</span>
                       </div>
                       <div className="flex items-center justify-between bg-muted/40 p-2 rounded-lg border border-border">
                         <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Venda</span>
                         <span className="text-lg font-bold text-primary">{formatBRL(order.price)}</span>
                       </div>
                       {order.filaments_deducted && (
                           <div className="flex -mt-1 w-full justify-end">
                               <span className="text-[10px] text-muted-foreground">✓ Bobinas deduzidas</span>
                           </div>
                       )}
                    </CardContent>
                 </Card>
               );
             })}
          </div>
        )}

      </div>

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
                <Select value={editProdStatus} onValueChange={(v) => setEditProdStatus(v as any)}>
                   <SelectTrigger><SelectValue/></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="Na Fila">Na Fila</SelectItem>
                     <SelectItem value="Imprimindo">Imprimindo</SelectItem>
                     <SelectItem value="Concluído">Concluído</SelectItem>
                   </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status Pagamento</Label>
                <Select value={editPayStatus} onValueChange={(v) => setEditPayStatus(v as any)}>
                   <SelectTrigger><SelectValue/></SelectTrigger>
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

      <AlertDialog open={!!deleteOrderData} onOpenChange={(v) => !v && setDeleteOrderData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pedido de <strong>{deleteOrderData?.instagram_handle}</strong>? Esta ação removerá o pedido dos registros financeiros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Limpar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
