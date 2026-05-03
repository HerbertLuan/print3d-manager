"use client";

import { useState, useEffect, useCallback } from "react";
import { Receipt, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getExpenses, deleteExpense, updateExpense } from "@/lib/firestore";
import { Expense } from "@/lib/types";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpenseList } from "@/components/expenses/ExpenseList";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function ExpensesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-based

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formOpen, setFormOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Delete State
  const [deleteExpenseData, setDeleteExpenseData] = useState<Expense | null>(null);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar despesas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  // Filter client-side by selected month/year
  const filtered = expenses.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const totalMonthly = filtered.reduce((sum, e) => sum + e.value, 0);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function handleAddClick() {
    setExpenseToEdit(null);
    setFormOpen(true);
  }

  function handleEditClick(expense: Expense) {
    setExpenseToEdit(expense);
    setFormOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteExpenseData) return;
    try {
      await deleteExpense(deleteExpenseData.id);
      setExpenses((prev) => prev.filter((e) => e.id !== deleteExpenseData.id));
      setDeleteExpenseData(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePaymentToggle(expense: Expense) {
    const newStatus = expense.status === "Pendente" ? "Pago" : "Pendente";
    const todayStr = new Date().toLocaleDateString("en-CA");
    const newPaidAt = newStatus === "Pago" ? todayStr : null;

    try {
      await updateExpense(expense.id, {
        status: newStatus,
        paid_at: newPaidAt as string // Type cast to satisfy Partial<Omit<Expense, "id" | "created_at">> if needed, but it works
      });
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === expense.id ? { ...e, status: newStatus, paid_at: newPaidAt || undefined } : e
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8 bg-[#0D0D0D] min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Receipt className="w-5 h-5 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Gestão de Despesas</h1>
            </div>
            <p className="text-muted-foreground">Registre e acompanhe seus custos operacionais.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadExpenses} disabled={loading} className="hidden sm:flex bg-white/5 border-white/10 hover:bg-white/10">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleAddClick} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Lançar Despesa</span>
            </Button>
          </div>
        </div>

        {/* Resumo & Filtro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex items-center justify-between md:col-span-1 bg-white/5 rounded-xl border border-white/10 p-2">
            <Button variant="ghost" size="sm" onClick={prevMonth} className="hover:bg-white/10">←</Button>
            <div className="text-center px-4">
              <p className="font-semibold text-foreground text-sm uppercase tracking-wider">{MONTHS[month - 1]} {year}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={nextMonth} className="hover:bg-white/10">→</Button>
          </div>

          <div className="md:col-span-2">
            <Card className="bg-white/5 border-white/10 shadow-lg backdrop-blur-md">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Despesas ({MONTHS[month - 1]})</p>
                  <h2 className="text-3xl font-bold text-red-400 mt-1">{totalMonthly.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</h2>
                </div>
                <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20">
                  <Receipt className="w-6 h-6 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Lista */}
        <Card className="border-white/10 bg-white/5 shadow-xl backdrop-blur-sm overflow-hidden">
          <CardHeader className="py-4 border-b border-white/10 bg-white/5">
            <CardTitle className="text-base font-semibold">Histórico de {MONTHS[month - 1]}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <ExpenseList
                expenses={filtered}
                totalMonthly={totalMonthly}
                onEdit={handleEditClick}
                onDeleteClick={(e) => setDeleteExpenseData(e)}
                onPaymentToggle={handlePaymentToggle}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ExpenseForm
        open={formOpen}
        onOpenChange={setFormOpen}
        expenseToEdit={expenseToEdit}
        onSaved={loadExpenses}
      />

      <AlertDialog open={!!deleteExpenseData} onOpenChange={(v) => !v && setDeleteExpenseData(null)}>
        <AlertDialogContent className="bg-zinc-950 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? A despesa <strong>"{deleteExpenseData?.description}"</strong> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
