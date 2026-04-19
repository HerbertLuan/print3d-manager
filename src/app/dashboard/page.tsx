"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getOrders, getExpenses, addExpense, deleteExpense } from "@/lib/firestore";
import { Order, Expense } from "@/lib/types";
import { formatBRL, formatTime } from "@/lib/calculations";
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
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
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

  // Expense form
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Expense delete confirm
  const [deleteExpenseData, setDeleteExpenseData] = useState<Expense | null>(null);

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
    const s = {
      revenue: 0,
      filamentCost: 0,
      machineCost: 0,
      suppliesCost: 0,
      expensesCost: 0,
      orderCount: 0,
    };

    orders.forEach(o => {
      const orderDate = new Date(o.created_at.seconds * 1000);
      const mStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      const inPeriod = allPeriod || mStr === currentMonthStr;
      if (!inPeriod) return;

      s.revenue += o.price || 0;
      s.filamentCost += o.filament_cost || 0;
      s.machineCost += o.machine_cost || 0;
      s.suppliesCost += o.supplies_cost || 0;
      s.orderCount++;
    });

    expenses.forEach(e => {
      const dStr = e.date.substring(0, 7);
      const inPeriod = allPeriod || dStr === currentMonthStr;
      if (!inPeriod) return;
      s.expensesCost += e.value;
    });

    const totalOperationalCost = s.filamentCost + s.machineCost + s.suppliesCost;
    const totalCosts = totalOperationalCost + s.expensesCost;
    const profit = s.revenue - totalCosts;

    return { ...s, totalOperationalCost, totalCosts, profit };
  }, [orders, expenses, currentMonthStr, allPeriod]);

  // Expenses filtered for the table below
  const filteredExpenses = useMemo(() => {
    if (allPeriod) return expenses;
    return expenses.filter(e => e.date.substring(0, 7) === currentMonthStr);
  }, [expenses, currentMonthStr, allPeriod]);

  function resetForm() {
    setFormDesc("");
    setFormValue("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setExpenseError(null);
  }

  async function handleAddExpense() {
    if (!formDesc.trim() || !formValue || !formDate) return;
    const value = parseFloat(formValue);
    if (value <= 0) return;
    setSavingExpense(true);
    try {
      await addExpense({ description: formDesc.trim(), value, date: formDate });
      setExpenseFormOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      setExpenseError("Erro ao lançar despesa.");
    } finally {
      setSavingExpense(false);
    }
  }

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
          <Button size="sm" onClick={() => setExpenseFormOpen(true)} className="gap-2 self-start sm:self-auto">
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
              <h2 className="text-3xl font-bold text-foreground">{formatBRL(stats.expensesCost)}</h2>
              <p className="text-xs text-muted-foreground mt-1">Luz extra, Manutenção, etc</p>
            </CardContent>
          </Card>
        </div>

        {/* Distribuição de Custos Operacionais */}
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-muted-foreground" />
            Distribuição de Custos Operacionais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CostCard
              icon={<Droplet className="w-3 h-3" />}
              label="Bobinas de Filamento"
              color="blue"
              value={stats.filamentCost}
              total={stats.totalOperationalCost}
            />
            <CostCard
              icon={<Zap className="w-3 h-3" />}
              label="Depreciação de Máquina"
              color="orange"
              value={stats.machineCost}
              total={stats.totalOperationalCost}
            />
            <CostCard
              icon={<Tag className="w-3 h-3" />}
              label="Insumos / Embalagens"
              color="purple"
              value={stats.suppliesCost}
              total={stats.totalOperationalCost}
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
            <Button variant="outline" size="sm" onClick={() => setExpenseFormOpen(true)} className="gap-2">
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
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right pr-6">Valor</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((expense) => (
                        <TableRow key={expense.id} className="border-border">
                          <TableCell className="pl-6 font-medium">{expense.description}</TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {new Date(expense.date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right pr-6 font-semibold text-red-400 tabular-nums">
                            {formatBRL(expense.value)}
                          </TableCell>
                          <TableCell className="pr-4">
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
                    <span className="text-lg font-bold text-red-400 tabular-nums">{formatBRL(stats.expensesCost)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ── Modal: Lançar Despesa ── */}
      <ResponsiveModal
        open={expenseFormOpen}
        onOpenChange={(o) => { setExpenseFormOpen(o); if (!o) resetForm(); }}
        title="Lançar Despesa"
        description="Registre um custo operacional ou compra."
      >
        <div className="space-y-4 py-2">
          {expenseError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {expenseError}
            </div>
          )}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              placeholder="ex: Energia elétrica, Manutenção"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" min={0} step={0.01} placeholder="0,00" value={formValue} onChange={(e) => setFormValue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setExpenseFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto flex-1"
              onClick={handleAddExpense}
              disabled={!formDesc.trim() || !formValue || !formDate || savingExpense}
            >
              <Receipt className="w-4 h-4 mr-2" />
              {savingExpense ? "Salvando..." : "Lançar Despesa"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

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

    </div>
  );
}

function CostCard({ icon, label, color, value, total }: {
  icon: React.ReactNode;
  label: string;
  color: "blue" | "orange" | "purple";
  value: number;
  total: number;
}) {
  const colorMap = {
    blue: { bar: "bg-blue-500", text: "text-blue-500/70" },
    orange: { bar: "bg-orange-500", text: "text-orange-500/70" },
    purple: { bar: "bg-purple-500", text: "text-purple-500/70" },
  };
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription className={`flex items-center gap-2 uppercase tracking-widest text-[10px] font-semibold ${colorMap[color].text}`}>
          {icon} {label}
        </CardDescription>
        <CardTitle className="text-2xl">{formatBRL(value)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
          <div className={`${colorMap[color].bar} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{pct.toFixed(1)}% dos custos operacionais</p>
      </CardContent>
    </Card>
  );
}
