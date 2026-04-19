"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { getExpenses, addExpense, deleteExpense } from "@/lib/firestore";
import { Expense } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";

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

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [formDesc, setFormDesc] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

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

  function resetForm() {
    setFormDesc("");
    setFormValue("");
    setFormDate(new Date().toISOString().slice(0, 10));
  }

  async function handleAdd() {
    if (!formDesc.trim() || !formValue || !formDate) return;
    const value = parseFloat(formValue);
    if (value <= 0) return;
    setSaving(true);
    try {
      await addExpense({ description: formDesc.trim(), value, date: formDate });
      setFormOpen(false);
      resetForm();
      loadExpenses();
    } catch (err) {
      console.error(err);
      setError("Erro ao lançar despesa.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Despesas Extras</h1>
            </div>
            <p className="text-muted-foreground">Filamentos, energia, manutenção e outros custos operacionais.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadExpenses} disabled={loading} className="hidden sm:flex">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Lançar Despesa</span>
            </Button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={prevMonth}>←</Button>
          <div className="text-center">
            <p className="font-semibold text-foreground">{MONTHS[month - 1]} {year}</p>
            <p className="text-xs text-muted-foreground">{filtered.length} despesas · {formatBRL(totalMonthly)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={nextMonth}>→</Button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Card className="border-border">
          <CardHeader className="py-4 border-b border-border/50">
            <CardTitle className="text-base">Despesas de {MONTHS[month - 1]}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-foreground mb-1">Nenhuma despesa neste mês</h3>
                <p className="text-sm text-muted-foreground">
                  Clique em <strong>Lançar Despesa</strong> para registrar.
                </p>
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
                    {filtered.map((expense) => (
                      <TableRow key={expense.id} className="border-border">
                        <TableCell className="pl-6 font-medium">{expense.description}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {new Date(expense.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-semibold text-red-400 tabular-nums">
                          {formatBRL(expense.value)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <AlertDialog>
                            <AlertDialogTrigger render={
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" />
                            }>
                              <Trash2 className="w-3.5 h-3.5" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza? Esta despesa será removida permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(expense.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Footer totals row */}
                <div className="flex justify-end items-center px-6 py-3 border-t border-border bg-muted/20">
                  <span className="text-sm font-semibold text-muted-foreground mr-4">Total do Mês:</span>
                  <span className="text-lg font-bold text-red-400 tabular-nums">{formatBRL(totalMonthly)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Expense Modal */}
      <ResponsiveModal
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}
        title="Lançar Despesa"
        description="Registre um custo operacional ou compra."
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              placeholder="ex: Filamento PLA 1kg Silver, Energia elétrica"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto flex-1"
              onClick={handleAdd}
              disabled={!formDesc.trim() || !formValue || !formDate || saving}
            >
              <Receipt className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Lançar Despesa"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
