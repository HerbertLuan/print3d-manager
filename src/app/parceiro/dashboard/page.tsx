"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  TrendingUp,
  Clock,
  DollarSign,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePartnerAuth } from "@/lib/partner-auth-context";
import { getOrdersByPartner } from "@/lib/firestore";
import { Order } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function filterByMonth(orders: Order[], year: number, month: number) {
  return orders.filter((o) => {
    const d = o.created_at?.toDate?.();
    if (!d) return false;
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Aguardando",
  "Na Fila": "Na Fila",
  Imprimindo: "Imprimindo",
  Concluído: "Concluído",
};

const STATUS_CLASS: Record<string, string> = {
  pending_approval: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "Na Fila": "bg-slate-500/10 text-slate-400 border-slate-500/20",
  Imprimindo: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Concluído: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnerDashboardPage() {
  const { partner, loading: authLoading, signOut } = usePartnerAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  // Guard: redirect se não autenticado
  useEffect(() => {
    if (!authLoading && !partner) {
      router.replace("/parceiro/login");
    }
  }, [authLoading, partner, router]);

  useEffect(() => {
    if (!partner) return;
    setLoadingOrders(true);
    getOrdersByPartner(partner.id)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoadingOrders(false));
  }, [partner]);

  // ── Métricas ─────────────────────────────────────────────────────────────

  const monthOrders = useMemo(() => filterByMonth(orders, filterYear, filterMonth), [orders, filterYear, filterMonth]);

  const monthEarnings = useMemo(
    () => monthOrders.reduce((s, o) => s + (o.partner_commission_value ?? 0), 0),
    [monthOrders]
  );
  const pendingEarnings = useMemo(
    () =>
      monthOrders
        .filter((o) => !o.partner_commission_paid)
        .reduce((s, o) => s + (o.partner_commission_value ?? 0), 0),
    [monthOrders]
  );
  const paidEarnings = monthEarnings - pendingEarnings;

  const totalAllTime = useMemo(
    () => orders.reduce((s, o) => s + (o.partner_commission_value ?? 0), 0),
    [orders]
  );

  function prevMonth() {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear((y) => y - 1);
    } else {
      setFilterMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (filterMonth === 12) {
      setFilterMonth(1);
      setFilterYear((y) => y + 1);
    } else {
      setFilterMonth((m) => m + 1);
    }
  }

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
            {partner.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{partner.name}</p>
            <p className="text-xs text-muted-foreground">Parceiro EVINS · {partner.commission_percentage}% comissão</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </header>

      {/* Main */}
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Month filter */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[140px] text-center">
            {MONTH_NAMES[filterMonth - 1]} {filterYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <BadgePercent className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Ganhos em {MONTH_NAMES[filterMonth - 1]}</p>
              <p className="text-2xl font-bold text-primary tabular-nums">{formatBRL(monthEarnings)}</p>
              <p className="text-xs text-muted-foreground">{monthOrders.length} pedido(s) indicado(s)</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> A Receber
            </p>
            <p className="text-lg font-bold text-amber-400 tabular-nums">{formatBRL(pendingEarnings)}</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Já Recebido
            </p>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatBRL(paidEarnings)}</p>
          </div>

          <div className="col-span-2 rounded-xl border border-border bg-muted/20 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              Total acumulado (todo o período)
            </div>
            <span className="font-bold tabular-nums">{formatBRL(totalAllTime)}</span>
          </div>
        </div>

        {/* Orders list */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Pedidos em {MONTH_NAMES[filterMonth - 1]} ({monthOrders.length})
          </h2>

          {loadingOrders ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : monthOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              <BadgePercent className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum pedido indicado neste mês.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {monthOrders.map((o) => (
                  <div key={o.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight truncate">
                        {o.piece_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {o.created_at?.toDate?.().toLocaleDateString("pt-BR") ?? "—"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        STATUS_CLASS[o.production_status] ?? "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {STATUS_LABEL[o.production_status] ?? o.production_status}
                    </span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary tabular-nums">
                        {formatBRL(o.partner_commission_value ?? 0)}
                      </p>
                      <p className={`text-[10px] font-medium ${
                        o.partner_commission_paid ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {o.partner_commission_paid ? "Pago ✓" : "Pendente"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
