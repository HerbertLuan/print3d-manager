import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Order } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";

interface OrderDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  periodLabel: string;
}

export function OrderDetailsModal({ open, onOpenChange, orders, periodLabel }: OrderDetailsModalProps) {
  // Aggregations
  const totalCobrado = orders.reduce((acc, o) => acc + (Number(o.price) || 0), 0);
  const totalFilamento = orders.reduce((acc, o) => acc + (Number(o.filament_cost) || 0), 0);
  const totalMaquina = orders.reduce((acc, o) => acc + (Number(o.machine_cost) || 0), 0);
  const totalInsumo = orders.reduce((acc, o) => acc + (Number(o.supplies_cost) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-6xl max-w-none bg-[#0D0D0D] border-white/10 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-[#F2F2F2] text-xl">Relatório de Pedidos - {periodLabel}</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto mt-4 max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-muted-foreground font-semibold">Cliente</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Peças Impressas</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold">Valor Cobrado</TableHead>
                <TableHead className="text-center text-muted-foreground font-semibold">Pagamento</TableHead>
                <TableHead className="text-center text-muted-foreground font-semibold">Data Pag.</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold">Gasto Filamento</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold">Gasto Manutenção</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold">Gasto Insumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={8} className="text-center text-[#F2F2F2] py-8">
                    Nenhum pedido encontrado para este período.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map(order => {
                  const itemsStr = order.items && order.items.length > 0
                    ? order.items.map(i => `${i.quantidade}x ${i.nome}`).join(", ")
                    : (order.piece_name || "Peça Avulsa");

                  return (
                    <TableRow key={order.id} className="border-white/10 even:bg-white/5 hover:bg-white/10 transition-colors">
                      <TableCell className="text-[#F2F2F2] font-medium whitespace-nowrap">
                        {order.cliente_nome || order.instagram_handle || "N/A"}
                      </TableCell>
                      <TableCell className="text-[#F2F2F2]">
                        <span className="line-clamp-2 text-sm" title={itemsStr}>{itemsStr}</span>
                      </TableCell>
                      <TableCell className="text-right text-[#F2F2F2] font-medium tabular-nums whitespace-nowrap">
                        {formatBRL(order.price || 0)}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${order.payment_status === "Pago" ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"}`}>
                          {order.payment_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground whitespace-nowrap text-xs tabular-nums">
                        {order.payment_status === "Pago" && order.paid_at 
                          ? new Date(order.paid_at + "T00:00:00").toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatBRL(order.filament_cost || 0)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatBRL(order.machine_cost || 0)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatBRL(order.supplies_cost || 0)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {orders.length > 0 && (
              <tfoot className="bg-white/5 border-t border-white/10">
                <TableRow className="hover:bg-transparent font-bold">
                  <TableCell colSpan={2} className="text-right text-[#F2F2F2]">Total Geral:</TableCell>
                  <TableCell className="text-right text-[#F2F2F2] whitespace-nowrap tabular-nums">{formatBRL(totalCobrado)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="text-right text-[#F2F2F2] whitespace-nowrap tabular-nums">{formatBRL(totalFilamento)}</TableCell>
                  <TableCell className="text-right text-[#F2F2F2] whitespace-nowrap tabular-nums">{formatBRL(totalMaquina)}</TableCell>
                  <TableCell className="text-right text-[#F2F2F2] whitespace-nowrap tabular-nums">{formatBRL(totalInsumo)}</TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
