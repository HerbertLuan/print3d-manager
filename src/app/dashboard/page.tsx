"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getOrders, getExpenses, deleteExpense } from "@/lib/firestore";
import { Order, Expense } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Activity,
  Droplet,
  Zap,
  Tag,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Plus,
  Receipt,
  Trash2,
  FileText,
  ListOrdered,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { OrderDetailsModal } from "@/components/dashboard/OrderDetailsModal";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function DashboardPage() {
  const now = new Date();

  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Month navigation
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-based
  const [allPeriod, setAllPeriod] = useState(false);
  const [accountingMode, setAccountingMode] = useState<"Caixa" | "Competência">("Caixa");

  // Expense form
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Expense delete confirm
  const [deleteExpenseData, setDeleteExpenseData] = useState<Expense | null>(null);

  // Order Details modal
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, expensesData] = await Promise.all([
        getOrders(),
        getExpenses(),
      ]);
      setOrders(ordersData);
      setExpenses(expensesData);
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const currentMonthStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;

  const stats = useMemo(() => {
    let revenue = 0;
    let provFilamento = 0;
    let provMaquina = 0;
    let provInsumo = 0;
    let orderCount = 0;

    orders.forEach(o => {
      let mStr;
      if (accountingMode === "Caixa") {
        if (o.payment_status !== "Pago") return; // Regime de Caixa ignora pendentes
        const dateStr = o.paid_at || new Date(o.created_at.seconds * 1000).toLocaleDateString("en-CA");
        mStr = dateStr.substring(0, 7);
      } else {
        const orderDate = new Date(o.created_at.seconds * 1000);
        mStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      }

      const inPeriod = allPeriod || mStr === currentMonthStr;
      if (!inPeriod) return;

      revenue += Number(o.price) || 0;
      provFilamento += Number(o.filament_cost) || 0;
      provMaquina += Number(o.machine_cost) || 0;
      provInsumo += Number(o.supplies_cost) || 0;
      orderCount++;
    });

    let realFilamento = 0;
    let realMaquina = 0;
    let realInsumo = 0;
    let despesasAvulsas = 0;

    expenses.forEach(e => {
      let dStr;
      if (accountingMode === "Caixa") {
        if (e.status === "Pendente") return; // Regime de Caixa ignora despesas pendentes
        dStr = (e.paid_at || e.date).substring(0, 7);
      } else {
        dStr = e.date.substring(0, 7);
      }

      const inPeriod = allPeriod || dStr === currentMonthStr;
      if (!inPeriod) return;

      const cat = (e.categoria || "").toLowerCase();
      
      if (cat.includes("filamento")) {
        realFilamento += e.value;
      } else if (cat.includes("manutenção") || cat.includes("manutencao") || cat.includes("máquina") || cat.includes("maquina")) {
        realMaquina += e.value;
      } else if (cat.includes("insumo") || cat.includes("embalagem")) {
        realInsumo += e.value;
      } else {
        despesasAvulsas += e.value;
      }
    });

    const deficitFilamento = Math.max(0, realFilamento - provFilamento);
    const deficitMaquina = Math.max(0, realMaquina - provMaquina);
    const deficitInsumo = Math.max(0, realInsumo - provInsumo);

    const totalOperationalCost = provFilamento + provMaquina + provInsumo;
    const profit = revenue - totalOperationalCost - despesasAvulsas - (deficitFilamento + deficitMaquina + deficitInsumo);

    return { 
      revenue, 
      orderCount,
      provFilamento,
      provMaquina,
      provInsumo,
      realFilamento,
      realMaquina,
      realInsumo,
      despesasAvulsas,
      totalOperationalCost, 
      profit 
    };
  }, [orders, expenses, currentMonthStr, allPeriod, accountingMode]);

  // Orders filtered for the details modal
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      let mStr;
      if (accountingMode === "Caixa") {
        if (o.payment_status !== "Pago") return false;
        const dateStr = o.paid_at || new Date(o.created_at.seconds * 1000).toLocaleDateString("en-CA");
        mStr = dateStr.substring(0, 7);
      } else {
        const orderDate = new Date(o.created_at.seconds * 1000);
        mStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      }
      return allPeriod || mStr === currentMonthStr;
    });
  }, [orders, currentMonthStr, allPeriod, accountingMode]);

  // Expenses filtered for the table below
  const filteredExpenses = useMemo(() => {
    if (allPeriod) return expenses;
    return expenses.filter(e => {
      if (accountingMode === "Caixa") {
        if (e.status === "Pendente") return false;
        return (e.paid_at || e.date).substring(0, 7) === currentMonthStr;
      }
      return e.date.substring(0, 7) === currentMonthStr;
    });
  }, [expenses, currentMonthStr, allPeriod, accountingMode]);

  async function handleDeleteExpense() {
    if (!deleteExpenseData) return;
    try {
      await deleteExpense(deleteExpenseData.id);
      setExpenses(prev => prev.filter(e => e.id !== deleteExpenseData.id));
      setDeleteExpenseData(null);
    } catch (err) {
      console.error(err);
    }
  }

  const margin = stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0;

  function handleAddExpenseClick() {
    setExpenseToEdit(null);
    setExpenseFormOpen(true);
  }

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
              <p className="text-muted-foreground text-sm">Acompanhe a saúde financeira e estude seus custos reais.</p>
            </div>
          </div>
          <Button size="sm" onClick={handleAddExpenseClick} className="gap-2 self-start sm:self-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
            <Plus className="w-4 h-4" />
            Lançar Despesa
          </Button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} disabled={allPeriod}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold w-36 text-center select-none">
              {allPeriod ? "Todo o Período" : `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} disabled={allPeriod}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant={allPeriod ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setAllPeriod(v => !v)}
          >
            <CalendarRange className="w-4 h-4" />
            Todo o Período
          </Button>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrderDetailsOpen(true)}
            className="gap-2 bg-black/40 border-white/10 hover:bg-black/60 text-white backdrop-blur-sm shadow-sm"
          >
            <ListOrdered className="w-4 h-4" />
            Ver Pedidos do Período
          </Button>

          {/* Toggle Accounting Mode */}
          <div className="flex items-center bg-muted/30 border border-border rounded-lg p-1">
            <Button
              variant={accountingMode === "Competência" ? "secondary" : "ghost"}
              size="sm"
              className={`h-7 px-3 text-xs ${accountingMode === "Competência" ? "shadow-sm" : "opacity-70 hover:opacity-100"}`}
              onClick={() => setAccountingMode("Competência")}
            >
              Competência
            </Button>
            <Button
              variant={accountingMode === "Caixa" ? "secondary" : "ghost"}
              size="sm"
              className={`h-7 px-3 text-xs ${accountingMode === "Caixa" ? "shadow-sm" : "opacity-70 hover:opacity-100"}`}
              onClick={() => setAccountingMode("Caixa")}
            >
              Caixa
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                <div className="p-2 bg-primary/10 rounded-md">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-foreground">{formatBRL(stats.revenue)}</h2>
              <p className="text-xs text-muted-foreground mt-1">De {stats.orderCount} pedidos</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Lucro Líquido</p>
                <div className={`p-2 rounded-md ${stats.profit >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <h2 className={`text-3xl font-bold ${stats.profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatBRL(stats.profit)}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{margin.toFixed(1)}% de margem real</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Custo de Operação</p>
                <div className="p-2 bg-orange-500/10 rounded-md">
                  <Activity className="w-4 h-4 text-orange-500" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-foreground">{formatBRL(stats.totalOperationalCost)}</h2>
              <p className="text-xs text-muted-foreground mt-1">Filamento + Máquina + Insumos</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Despesas Avulsas</p>
                <div className="p-2 bg-red-500/10 rounded-md">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-foreground">{formatBRL(stats.despesasAvulsas)}</h2>
              <p className="text-xs text-muted-foreground mt-1">Custos não atrelados à operação</p>
            </CardContent>
          </Card>
        </div>

        {/* Distribuição de Custos Operacionais */}
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-muted-foreground" />
            Fundos de Provisão vs Realizado
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CostCard
              icon={<Droplet className="w-3 h-3" />}
              label="Bobinas de Filamento"
              color="blue"
              provValue={stats.provFilamento}
              realValue={stats.realFilamento}
            />
            <CostCard
              icon={<Zap className="w-3 h-3" />}
              label="Depreciação de Máquina"
              color="orange"
              provValue={stats.provMaquina}
              realValue={stats.realMaquina}
            />
            <CostCard
              icon={<Tag className="w-3 h-3" />}
              label="Insumos / Embalagens"
              color="purple"
              provValue={stats.provInsumo}
              realValue={stats.realInsumo}
            />
          </div>
        </div>

        {/* Tabela de Despesas Avulsas */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              Despesas do Período
            </h3>
            <Button variant="outline" size="sm" onClick={handleAddExpenseClick} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Despesa</span>
            </Button>
          </div>
          <Card className="border-border">
            <CardContent className="p-0">
              {filteredExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                  <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <h4 className="font-semibold text-foreground mb-1">Nenhuma despesa neste período</h4>
                  <p className="text-sm text-muted-foreground">Clique em <strong>Lançar Despesa</strong> para registrar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="pl-6">Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right pr-6">Valor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => (
                        <TableRow key={expense.id} className="border-border cursor-pointer hover:bg-muted/50" onClick={() => { setExpenseToEdit(expense); setExpenseFormOpen(true); }}>
                          <TableCell className="pl-6 font-medium">
                            {expense.description}
                            {expense.tipo_cobranca === "Parcelada" && expense.parcelas && (
                              <span className="ml-2 text-xs text-muted-foreground">({expense.parcelas})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {expense.categoria || "Outros"}
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums text-sm">
                            {new Date(expense.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-semibold text-red-400 tabular-nums">
                            {formatBRL(expense.value)}
                          </TableCell>
                          <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteExpenseData(expense)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end items-center px-6 py-3 border-t border-border bg-muted/20">
                    <span className="text-sm font-semibold text-muted-foreground mr-4">Total do Período:</span>
                    <span className="text-lg font-bold text-red-400 tabular-nums">{formatBRL(filteredExpenses.reduce((acc, curr) => acc + curr.value, 0))}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      <ExpenseForm
        open={expenseFormOpen}
        onOpenChange={setExpenseFormOpen}
        expenseToEdit={expenseToEdit}
        onSaved={fetchData}
      />

      {/* ── Dialog: Excluir Despesa ── */}
      <AlertDialog open={!!deleteExpenseData} onOpenChange={(v) => !v && setDeleteExpenseData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? A despesa <strong>"{deleteExpenseData?.description}"</strong> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderDetailsModal
        open={orderDetailsOpen}
        onOpenChange={setOrderDetailsOpen}
        orders={filteredOrders}
        periodLabel={allPeriod ? "Todo o Período" : `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
      />

    </div>
  );
}

function CostCard({ icon, label, color, provValue, realValue }: {
  icon: React.ReactNode;
  label: string;
  color: "blue" | "orange" | "purple";
  provValue: number;
  realValue: number;
}) {
  const colorMap = {
    blue: { bar: "bg-blue-500", text: "text-blue-500/70" },
    orange: { bar: "bg-orange-500", text: "text-orange-500/70" },
    purple: { bar: "bg-purple-500", text: "text-purple-500/70" },
  };
  
  const rawPct = provValue > 0 ? (realValue / provValue) * 100 : (realValue > 0 ? 100 : 0);
  const isOver = rawPct > 100;
  const widthPct = Math.min(100, rawPct);
  
  const barClass = isOver ? "bg-red-500" : colorMap[color].bar;

  return (
    <Card className="border-border shadow-sm bg-white/5 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardDescription className={`flex items-center gap-2 uppercase tracking-widest text-[10px] font-semibold ${colorMap[color].text}`}>
          {icon} {label}
        </CardDescription>
        <CardTitle className="text-2xl">{formatBRL(provValue)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full bg-muted/50 rounded-full h-1.5 mt-2 overflow-hidden">
          <div className={`${barClass} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${widthPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 flex justify-between items-center">
          <span>Gasto Real: <strong>{formatBRL(realValue)}</strong></span>
          <span className={isOver ? "text-red-500 font-bold" : ""}>
            {rawPct.toFixed(0)}%
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
