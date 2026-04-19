"use client";

import { useEffect, useState, useMemo } from "react";
import { getOrders, getExpenses } from "@/lib/firestore";
import { Order, Expense } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { LayoutDashboard, TrendingUp, TrendingDown, DollarSign, PieChart, Activity, Droplet, Zap, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonthStr, setCurrentMonthStr] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [ordersData, expensesData] = await Promise.all([
          getOrders(),
          getExpenses()
        ]);
        setOrders(ordersData);
        setExpenses(expensesData);
        
        const now = new Date();
        const mStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setCurrentMonthStr(mStr);
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const { allTimeStats, monthlyStats } = useMemo(() => {
    const defaultStats = {
      revenue: 0,
      totalCosts: 0,
      machineCost: 0,
      filamentCost: 0,
      suppliesCost: 0,
      expensesCost: 0,
      profit: 0,
      orderCount: 0
    };

    const all = { ...defaultStats };
    const monthly = { ...defaultStats };

    orders.forEach(o => {
      const isPaid = o.payment_status === "Pago";
      const isDone = o.production_status === "Concluído";
      // Assumimos que a receita entra se pago, ou lucro se concluído. 
      // Por consistência, vamos contar a receita de tudo o que for "Pago" ou "Concluído"
      // ou apenas focado na receita projetada total? 
      // Vamos contabilizar apenas pedidos "Pg" + "Concluído" como real, e o resto como projetado?
      // O requisito original considerava todos os pedidos no dashboard básico.
      
      const orderDate = new Date(o.created_at.seconds * 1000);
      const mStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      const isCurrentMonth = mStr === currentMonthStr;

      const rev = o.price || 0;
      const baseC = o.base_cost || 0;
      const supC = o.supplies_cost || 0;
      const machC = o.machine_cost || 0;
      const filC = o.filament_cost || 0;

      // All Time
      all.revenue += rev;
      all.totalCosts += (baseC + supC);
      all.machineCost += machC;
      all.filamentCost += filC;
      all.suppliesCost += supC;
      all.orderCount++;

      // Monthly
      if (isCurrentMonth) {
        monthly.revenue += rev;
        monthly.totalCosts += (baseC + supC);
        monthly.machineCost += machC;
        monthly.filamentCost += filC;
        monthly.suppliesCost += supC;
        monthly.orderCount++;
      }
    });

    expenses.forEach(e => {
       const dStr = e.date.substring(0, 7); // YYYY-MM
       all.expensesCost += e.value;
       all.totalCosts += e.value;
       
       if (dStr === currentMonthStr) {
         monthly.expensesCost += e.value;
         monthly.totalCosts += e.value;
       }
    });

    all.profit = all.revenue - all.totalCosts;
    monthly.profit = monthly.revenue - monthly.totalCosts;

    return { allTimeStats: all, monthlyStats: monthly };
  }, [orders, expenses, currentMonthStr]);

  if (loading) {
    return (
       <div className="flex-1 p-8">
           <div className="max-w-6xl mx-auto space-y-6">
              <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 {Array.from({length: 4}).map((_,i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {Array.from({length: 3}).map((_,i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-xl" />)}
              </div>
           </div>
       </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
         
         <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
               <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <div>
               <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
               <p className="text-muted-foreground">Acompanhe a saúde financeira e estude seus custos reais.</p>
            </div>
         </div>

         <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="mb-6 border border-border bg-background">
               <TabsTrigger value="monthly" className="data-[state=active]:bg-muted">Mês Atual ({currentMonthStr})</TabsTrigger>
               <TabsTrigger value="all" className="data-[state=active]:bg-muted">Todo o Período</TabsTrigger>
            </TabsList>
            
            <TabsContent value="monthly" className="space-y-6">
               <DashboardMetrics stats={monthlyStats} />
            </TabsContent>
            
            <TabsContent value="all" className="space-y-6">
               <DashboardMetrics stats={allTimeStats} />
            </TabsContent>
         </Tabs>

      </div>
    </div>
  );
}

function DashboardMetrics({ stats }: { stats: any }) {
   const margin = stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0;
   
   return (
      <>
         {/* Main KPIs */}
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
                  <p className="text-xs text-muted-foreground mt-1">De {stats.orderCount} pedidos computados</p>
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
                  <p className="text-xs text-muted-foreground mt-1">
                     {margin.toFixed(1)}% de margem real
                  </p>
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
                  <h2 className="text-3xl font-bold text-foreground">{formatBRL(stats.totalCosts - stats.expensesCost)}</h2>
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

         {/* Cost Breakdown */}
         <div>
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
               <PieChart className="w-5 h-5 text-muted-foreground"/> 
               Distribuição de Custos Operacionais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card className="border-border shadow-sm">
                 <CardHeader className="pb-2">
                   <CardDescription className="flex items-center gap-2 uppercase tracking-widest text-[10px] font-semibold text-blue-500/70">
                      <Droplet className="w-3 h-3" /> Bobinas de Filamento
                   </CardDescription>
                   <CardTitle className="text-2xl">{formatBRL(stats.filamentCost)}</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (stats.filamentCost / (stats.totalCosts || 1)) * 100)}%` }}></div>
                   </div>
                 </CardContent>
               </Card>

               <Card className="border-border shadow-sm">
                 <CardHeader className="pb-2">
                   <CardDescription className="flex items-center gap-2 uppercase tracking-widest text-[10px] font-semibold text-orange-500/70">
                      <Zap className="w-3 h-3" /> Depreciação de Máquina
                   </CardDescription>
                   <CardTitle className="text-2xl">{formatBRL(stats.machineCost)}</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (stats.machineCost / (stats.totalCosts || 1)) * 100)}%` }}></div>
                   </div>
                 </CardContent>
               </Card>

               <Card className="border-border shadow-sm">
                 <CardHeader className="pb-2">
                   <CardDescription className="flex items-center gap-2 uppercase tracking-widest text-[10px] font-semibold text-purple-500/70">
                      <Tag className="w-3 h-3" /> Insumos / Embalagens
                   </CardDescription>
                   <CardTitle className="text-2xl">{formatBRL(stats.suppliesCost)}</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (stats.suppliesCost / (stats.totalCosts || 1)) * 100)}%` }}></div>
                   </div>
                 </CardContent>
               </Card>
            </div>
         </div>
      </>
   );
}
