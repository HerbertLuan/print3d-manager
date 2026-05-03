"use client";

import { useState, useEffect } from "react";
import { Receipt, AlertCircle, CalendarIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addExpense, updateExpense, getExpenseCategories } from "@/lib/firestore";
import { Expense, ExpenseCategory } from "@/lib/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ManageCategoriesModal } from "./ManageCategoriesModal";

const DEFAULT_CATEGORIES = [
  "Insumos/Filamentos",
  "Manutenção de Máquina",
  "Marketing/Anúncios",
  "Embalagens",
  "Taxas/Impostos",
  "Outros",
];

const BILLING_TYPES = ["Única", "Fixa Mensal", "Parcelada"] as const;

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  expenseToEdit?: Expense | null;
}

export function ExpenseForm({ open, onOpenChange, onSaved, expenseToEdit }: ExpenseFormProps) {
  const [desc, setDesc] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [category, setCategory] = useState<string>("Outros");
  const [billingType, setBillingType] = useState<"Única" | "Fixa Mensal" | "Parcelada">("Única");
  const [installments, setInstallments] = useState("");
  const [status, setStatus] = useState<"Pendente" | "Pago">("Pago");
  const [paidAt, setPaidAt] = useState<Date | undefined>(new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dbCategories, setDbCategories] = useState<ExpenseCategory[]>([]);
  const [manageCatOpen, setManageCatOpen] = useState(false);

  const loadCategories = async () => {
    try {
      const cats = await getExpenseCategories();
      setDbCategories(cats);
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  };

  useEffect(() => {
    if (open) {
      loadCategories();
      if (expenseToEdit) {
        setDesc(expenseToEdit.description);
        setValueStr(expenseToEdit.value.toString());
        setDate(new Date(expenseToEdit.date + "T00:00:00"));
        setCategory(expenseToEdit.categoria || "Outros");
        setBillingType(expenseToEdit.tipo_cobranca || "Única");
        setInstallments(expenseToEdit.parcelas || "");
        setStatus(expenseToEdit.status || "Pago");
        setPaidAt(expenseToEdit.paid_at ? new Date(expenseToEdit.paid_at + "T00:00:00") : undefined);
      } else {
        setDesc("");
        setValueStr("");
        setDate(new Date());
        setCategory("Outros");
        setBillingType("Única");
        setInstallments("");
        setStatus("Pago");
        setPaidAt(new Date());
      }
      setError(null);
    }
  }, [open, expenseToEdit]);

  async function handleSave() {
    if (!desc.trim()) return setError("A descrição é obrigatória.");
    if (!valueStr) return setError("O valor é obrigatório.");
    const val = parseFloat(valueStr.replace(",", "."));
    if (isNaN(val) || val <= 0) return setError("O valor deve ser maior que zero.");

    setSaving(true);
    setError(null);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const formattedPaidAt = status === "Pago" && paidAt ? format(paidAt, "yyyy-MM-dd") : null;

      if (expenseToEdit) {
        const dataToSave: any = {
          description: desc.trim(),
          value: val,
          date: formattedDate,
          categoria: category,
          tipo_cobranca: billingType,
          parcelas: billingType === "Parcelada" ? installments : "",
          status,
          paid_at: formattedPaidAt,
        };
        await updateExpense(expenseToEdit.id, dataToSave);
        toast.success("Despesa atualizada com sucesso!");
      } else {
        if (billingType === "Parcelada") {
          const numInstallments = parseInt(installments, 10);
          if (isNaN(numInstallments) || numInstallments < 1) {
             setError("Quantidade de parcelas inválida.");
             setSaving(false);
             return;
          }
          const promises = [];
          for (let i = 0; i < numInstallments; i++) {
            const nextDate = new Date(date);
            nextDate.setMonth(nextDate.getMonth() + i);
            const formattedNextDate = format(nextDate, "yyyy-MM-dd");
            const dataToSave: any = {
              description: desc.trim(),
              value: val,
              date: formattedNextDate,
              categoria: category,
              tipo_cobranca: billingType,
              parcelas: `${i + 1}/${numInstallments}`,
              status,
              paid_at: formattedPaidAt,
            };
            promises.push(addExpense(dataToSave));
          }
          await Promise.all(promises);
          toast.success(`${numInstallments} parcelas lançadas com sucesso!`);
        } else {
          const dataToSave: any = {
            description: desc.trim(),
            value: val,
            date: formattedDate,
            categoria: category,
            tipo_cobranca: billingType,
            parcelas: "",
            status,
            paid_at: formattedPaidAt,
          };
          await addExpense(dataToSave);
          toast.success("Despesa lançada com sucesso!");
        }
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar despesa.");
      toast.error("Ocorreu um erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const displayCategories = dbCategories.length > 0 ? dbCategories.map(c => c.name) : DEFAULT_CATEGORIES;

  // Add the current category to the list if it's not there (legacy data)
  const allCategories = Array.from(new Set([...displayCategories, category]));

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={expenseToEdit ? "Editar Despesa" : "Lançar Despesa"}
        description="Registre ou edite um custo operacional."
      >
        <div className="space-y-4 py-2">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              placeholder="ex: Filamento PLA, Energia elétrica"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
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
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !date && "text-muted-foreground"
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Categoria</span>
                <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground" onClick={() => setManageCatOpen(true)} title="Gerenciar Categorias">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Cobrança</Label>
              <Select value={billingType} onValueChange={(v: any) => setBillingType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status de Pagamento</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === "Pago" && (
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-10",
                          !paidAt && "text-muted-foreground"
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paidAt ? format(paidAt, "PPP", { locale: ptBR }) : <span>Selecione</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paidAt}
                      onSelect={(d) => d && setPaidAt(d)}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {billingType === "Parcelada" && !expenseToEdit && (
            <div className="space-y-2">
              <Label>Quantidade de Parcelas</Label>
              <Input
                type="number"
                min={2}
                placeholder="Ex: 3"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </div>
          )}

          {billingType === "Parcelada" && !!expenseToEdit && (
            <div className="space-y-2">
              <Label>Parcela Atual (ex: 1/3)</Label>
              <Input
                placeholder="Ex: 1/3"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              <Receipt className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : expenseToEdit ? "Salvar Alterações" : "Lançar Despesa"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ManageCategoriesModal
        open={manageCatOpen}
        onOpenChange={setManageCatOpen}
        onCategoriesChange={loadCategories}
      />
    </>
  );
}
