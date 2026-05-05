"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCoupons,
  addCoupon,
  updateCoupon,
  deleteCoupon,
  getStoreSettings,
  updateStoreSettings,
} from "@/lib/firestore";
import { Coupon, CouponType } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import {
  Gift,
  Ticket,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Save,
  Tag,
  Percent,
  DollarSign,
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
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CouponType, string> = {
  percentage: "Porcentagem (%)",
  fixed: "Valor Fixo (R$)",
  gift: "Brinde 🎁",
};

const TYPE_ICONS: Record<CouponType, React.ReactNode> = {
  percentage: <Percent className="size-3.5" />,
  fixed: <DollarSign className="size-3.5" />,
  gift: <Gift className="size-3.5" />,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromocoesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [giftThreshold, setGiftThreshold] = useState(150);
  const [giftThresholdInput, setGiftThresholdInput] = useState("150");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  // Formulário de novo cupom
  const [form, setForm] = useState({
    code: "",
    type: "percentage" as CouponType,
    value: "",
    min_purchase_value: "",
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingCoupons(true);
    try {
      const [c, s] = await Promise.all([getCoupons(), getStoreSettings()]);
      setCoupons(c);
      setGiftThreshold(s.gift_threshold);
      setGiftThresholdInput(String(s.gift_threshold));
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoadingCoupons(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Salvar Meta de Brinde ────────────────────────────────────────────────

  async function handleSaveThreshold() {
    const val = parseFloat(giftThresholdInput.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      toast.error("Insira um valor válido.");
      return;
    }
    setSavingThreshold(true);
    try {
      await updateStoreSettings({ gift_threshold: val });
      setGiftThreshold(val);
      toast.success("Meta de brinde atualizada!");
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSavingThreshold(false);
    }
  }

  // ─── Criar Cupom ──────────────────────────────────────────────────────────

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!code) { toast.error("Informe o código do cupom."); return; }

    const value = form.type === "gift" ? 0 : parseFloat(form.value.replace(",", "."));
    if (form.type !== "gift" && (isNaN(value) || value <= 0)) {
      toast.error("Informe o valor do desconto.");
      return;
    }

    const min = parseFloat((form.min_purchase_value || "0").replace(",", ".")) || 0;

    setFormLoading(true);
    try {
      await addCoupon({ code, type: form.type, value, min_purchase_value: min, active: true });
      toast.success(`Cupom ${code} criado!`);
      setForm({ code: "", type: "percentage", value: "", min_purchase_value: "" });
      fetchAll();
    } catch {
      toast.error("Erro ao criar cupom.");
    } finally {
      setFormLoading(false);
    }
  }

  // ─── Toggle Ativo/Inativo ─────────────────────────────────────────────────

  async function handleToggle(coupon: Coupon) {
    try {
      await updateCoupon(coupon.id, { active: !coupon.active });
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c))
      );
      toast.success(`Cupom ${coupon.active ? "desativado" : "ativado"}.`);
    } catch {
      toast.error("Erro ao alterar status.");
    }
  }

  // ─── Deletar ─────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCoupon(deleteTarget.id);
      setCoupons((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Cupom removido.");
    } catch {
      toast.error("Erro ao remover cupom.");
    } finally {
      setDeleteTarget(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Tag className="size-6 text-primary" />
          Promoções &amp; Cupons
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Gerencie cupons de desconto e a meta de brinde da loja.
        </p>
      </div>

      {/* ── Card: Meta de Brinde ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-4 text-[#7C3AED]" />
            Meta de Brinde
          </CardTitle>
          <CardDescription>
            Valor mínimo de compra para o cliente desbloquear um brinde exclusivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-xs">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">R$</span>
              <input
                type="text"
                value={giftThresholdInput}
                onChange={(e) => setGiftThresholdInput(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
                placeholder="150,00"
              />
            </div>
            <Button
              onClick={handleSaveThreshold}
              disabled={savingThreshold}
              size="sm"
              className="gap-1.5"
            >
              {savingThreshold ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Salvar
            </Button>
          </div>
          <p className="text-xs text-white/30 mt-2">
            Atual: <span className="text-white/50 font-medium">{formatBRL(giftThreshold)}</span>
          </p>
        </CardContent>
      </Card>

      {/* ── Card: Novo Cupom ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            Novo Cupom
          </CardTitle>
          <CardDescription>Crie um cupom de desconto para campanhas de marketing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Código
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="EVINS10"
                maxLength={20}
                className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm tracking-widest placeholder:tracking-normal placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
              />
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Tipo
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CouponType }))}
                className="w-full h-10 px-3 rounded-lg border border-white/10 bg-[#111] text-white text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
              >
                <option value="percentage">Porcentagem (%)</option>
                <option value="fixed">Valor Fixo (R$)</option>
                <option value="gift">Brinde 🎁</option>
              </select>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Valor do Desconto{form.type === "gift" ? " (ignorado para brindes)" : form.type === "percentage" ? " (%)" : " (R$)"}
              </label>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "percentage" ? "10" : form.type === "fixed" ? "20,00" : "—"}
                disabled={form.type === "gift"}
                className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition disabled:opacity-40"
              />
            </div>

            {/* Mínimo */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Compra Mínima (R$)
              </label>
              <input
                type="text"
                value={form.min_purchase_value}
                onChange={(e) => setForm((f) => ({ ...f, min_purchase_value: e.target.value }))}
                placeholder="0,00 (sem mínimo)"
                className="w-full h-10 px-3 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={formLoading} className="gap-2">
                {formLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Ticket className="size-4" />
                )}
                Criar Cupom
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Card: Lista de Cupons ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-4 text-primary" />
            Cupons Cadastrados
          </CardTitle>
          <CardDescription>
            {coupons.length} cupom{coupons.length !== 1 ? "s" : ""} no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCoupons ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-white/30" />
            </div>
          ) : coupons.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">
              Nenhum cupom cadastrado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <span className="font-mono font-bold tracking-widest text-white/90">
                        {coupon.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-white/60 text-xs">
                        {TYPE_ICONS[coupon.type]}
                        {TYPE_LABELS[coupon.type]}
                      </span>
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">
                      {coupon.type === "gift"
                        ? "Brinde"
                        : coupon.type === "percentage"
                        ? `${coupon.value}%`
                        : formatBRL(coupon.value)}
                    </TableCell>
                    <TableCell className="text-white/50 text-sm">
                      {coupon.min_purchase_value > 0
                        ? formatBRL(coupon.min_purchase_value)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggle(coupon)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition ${
                          coupon.active
                            ? "text-emerald-400 hover:text-emerald-300"
                            : "text-white/30 hover:text-white/50"
                        }`}
                      >
                        {coupon.active ? (
                          <>
                            <ToggleRight className="size-4" /> Ativo
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="size-4" /> Inativo
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => setDeleteTarget(coupon)}
                        className="text-white/20 hover:text-red-400 transition"
                        aria-label="Excluir cupom"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog de confirmação de exclusão ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom {deleteTarget?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cupom será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
