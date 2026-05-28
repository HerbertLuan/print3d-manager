"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  BadgePercent,
  CheckCircle2,
  XCircle,
  Copy,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  getPartners,
  addPartner,
  updatePartner,
  deletePartner,
  getOrdersByPartner,
  updatePartnerCommissionStatus,
} from "@/lib/firestore";
import { Partner, Order } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

function filterOrdersByMonth(orders: Order[], year: number, month: number) {
  const { start, end } = getMonthRange(year, month);
  return orders.filter((o) => {
    const d = o.created_at?.toDate?.();
    if (!d) return false;
    return d >= start && d <= end;
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCommission, setFormCommission] = useState("");
  const [formPix, setFormPix] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  // Commissions panel
  const [commissionsPartner, setCommissionsPartner] = useState<Partner | null>(null);
  const [partnerOrders, setPartnerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPartners();
      setPartners(data);
    } catch {
      toast.error("Erro ao carregar parceiros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPartners(); }, [loadPartners]);

  // ── Open/close modal ──────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormEmail("");
    setFormCommission("");
    setFormPix("");
    setFormActive(true);
    setModalOpen(true);
  }

  function openEdit(p: Partner) {
    setEditing(p);
    setFormName(p.name);
    setFormEmail(p.email);
    setFormCommission(String(p.commission_percentage));
    setFormPix(p.pix_key ?? "");
    setFormActive(p.active);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formEmail.trim() || !formCommission) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const commission = parseFloat(formCommission);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      toast.error("Percentual de comissão deve ser entre 0 e 100.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        email: formEmail.trim(),
        commission_percentage: commission,
        ...(formPix.trim() ? { pix_key: formPix.trim() } : {}),
        active: formActive,
      };
      if (editing) {
        await updatePartner(editing.id, payload);
        toast.success("Parceiro atualizado!");
      } else {
        await addPartner(payload);
        toast.success("Parceiro cadastrado!");
      }
      setModalOpen(false);
      loadPartners();
    } catch {
      toast.error("Erro ao salvar parceiro.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deletePartner(deleteTarget.id);
      toast.success("Parceiro removido.");
      setDeleteTarget(null);
      loadPartners();
    } catch {
      toast.error("Erro ao remover parceiro.");
    }
  }

  // ── Commissions panel ─────────────────────────────────────────────────────

  async function openCommissions(p: Partner) {
    setCommissionsPartner(p);
    setLoadingOrders(true);
    try {
      const orders = await getOrdersByPartner(p.id);
      setPartnerOrders(orders);
    } catch {
      toast.error("Erro ao carregar pedidos.");
    } finally {
      setLoadingOrders(false);
    }
  }

  async function toggleCommissionPaid(order: Order) {
    const newPaid = !order.partner_commission_paid;
    try {
      await updatePartnerCommissionStatus(order.id, newPaid);
      setPartnerOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, partner_commission_paid: newPaid } : o
        )
      );
      toast.success(newPaid ? "Comissão marcada como paga!" : "Comissão revertida para pendente.");
    } catch {
      toast.error("Erro ao atualizar status da comissão.");
    }
  }

  const filteredOrders = filterOrdersByMonth(partnerOrders, filterYear, filterMonth);
  const monthTotal = filteredOrders.reduce((s, o) => s + (o.partner_commission_value ?? 0), 0);
  const monthPending = filteredOrders.filter((o) => !o.partner_commission_paid)
    .reduce((s, o) => s + (o.partner_commission_value ?? 0), 0);
  const allTimeTotal = partnerOrders.reduce((s, o) => s + (o.partner_commission_value ?? 0), 0);

  const MONTH_NAMES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];

  return (
    <div className="flex-1 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Parceiros</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Gerencie seus vendedores e acompanhe as comissões de cada pedido indicado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={(e) => { e.currentTarget.blur(); loadPartners(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={(e) => { e.currentTarget.blur(); openCreate(); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Parceiro
          </Button>
        </div>
      </div>

      {/* Partners grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <Users className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-semibold text-lg mb-1">Nenhum parceiro cadastrado</p>
          <p className="text-sm mb-4">Cadastre seu primeiro vendedor para começar a rastrear comissões.</p>
          <Button onClick={(e) => { e.currentTarget.blur(); openCreate(); }}>
            <Plus className="w-4 h-4 mr-2" /> Cadastrar Parceiro
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map((p) => (
            <PartnerCard
              key={p.id}
              partner={p}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onViewCommissions={openCommissions}
            />
          ))}
        </div>
      )}

      {/* ── Modal: Criar / Editar Parceiro ── */}
      <ResponsiveModal
        open={modalOpen}
        onOpenChange={(v) => !v && setModalOpen(false)}
        title={editing ? "Editar Parceiro" : "Novo Parceiro"}
        description={editing ? `Editando dados de ${editing.name}` : "Preencha os dados do novo vendedor parceiro"}
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="partner-name">Nome Completo *</Label>
            <Input
              id="partner-name"
              placeholder="Ex: João Silva"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-email">E-mail (para login no portal) *</Label>
            <Input
              id="partner-email"
              type="email"
              placeholder="joao@email.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-commission">% de Comissão sobre o Lucro *</Label>
            <div className="relative">
              <BadgePercent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="partner-commission"
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="Ex: 10"
                className="pl-9"
                value={formCommission}
                onChange={(e) => setFormCommission(e.target.value)}
              />
            </div>
            {formCommission && (
              <p className="text-xs text-muted-foreground">
                Para uma venda com R$ 100,00 de lucro → comissão de{" "}
                <strong className="text-primary">
                  {formatBRL((parseFloat(formCommission) / 100) * 100)}
                </strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-pix">Chave PIX (opcional)</Label>
            <Input
              id="partner-pix"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={formPix}
              onChange={(e) => setFormPix(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Parceiro Ativo</p>
              <p className="text-xs text-muted-foreground">Aparece na lista de seleção dos pedidos</p>
            </div>
            <Switch
              id="partner-active"
              checked={formActive}
              onCheckedChange={setFormActive}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar Alterações" : "Cadastrar Parceiro"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* ── Modal: Ver Comissões do Parceiro ── */}
      <ResponsiveModal
        open={!!commissionsPartner}
        onOpenChange={(v) => !v && setCommissionsPartner(null)}
        title={`Comissões — ${commissionsPartner?.name ?? ""}`}
        description={`${commissionsPartner?.commission_percentage ?? 0}% sobre o lucro bruto de cada pedido`}
      >
        {commissionsPartner && (
          <div className="space-y-4 py-2">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <select
                className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <Input
                type="number"
                className="w-24"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
              />
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Este Mês</p>
                <p className="font-bold text-primary tabular-nums">{formatBRL(monthTotal)}</p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-1">A Pagar</p>
                <p className="font-bold text-amber-400 tabular-nums">{formatBRL(monthPending)}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Geral</p>
                <p className="font-bold tabular-nums">{formatBRL(allTimeTotal)}</p>
              </div>
            </div>

            {/* PIX info */}
            {commissionsPartner.pix_key && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border text-xs">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">PIX:</span>
                <span className="font-mono flex-1 truncate">{commissionsPartner.pix_key}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(commissionsPartner.pix_key!);
                    toast.success("Chave PIX copiada!");
                  }}
                  className="shrink-0 hover:text-primary transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Orders table */}
            {loadingOrders ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum pedido com comissão neste mês.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden text-sm">
                <div className="grid grid-cols-[1fr_auto_auto] gap-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted/30 px-3 py-2">
                  <span>Pedido</span>
                  <span className="text-right pr-3">Comissão</span>
                  <span className="text-right">Pago?</span>
                </div>
                <div className="divide-y divide-border">
                  {filteredOrders.map((o) => (
                    <div key={o.id} className="grid grid-cols-[1fr_auto_auto] gap-0 items-center px-3 py-2.5">
                      <div>
                        <p className="font-medium text-foreground leading-tight">{o.piece_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {o.created_at?.toDate?.().toLocaleDateString("pt-BR") ?? "—"} · {o.cliente_nome || o.instagram_handle}
                        </p>
                      </div>
                      <span className="font-bold tabular-nums text-primary pr-3">
                        {formatBRL(o.partner_commission_value ?? 0)}
                      </span>
                      <button
                        onClick={() => toggleCommissionPaid(o)}
                        className={`rounded-full p-1 transition-colors ${
                          o.partner_commission_paid
                            ? "text-emerald-400 hover:text-emerald-300"
                            : "text-muted-foreground hover:text-amber-400"
                        }`}
                        title={o.partner_commission_paid ? "Marcar como pendente" : "Marcar como pago"}
                      >
                        {o.partner_commission_paid ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ResponsiveModal>

      {/* ── Dialog: Excluir Parceiro ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Parceiro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>? Os pedidos já vinculados a ele não serão afetados, mas ele não aparecerá mais para novos pedidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── PartnerCard ──────────────────────────────────────────────────────────────

function PartnerCard({
  partner,
  onEdit,
  onDelete,
  onViewCommissions,
}: {
  partner: Partner;
  onEdit: (p: Partner) => void;
  onDelete: (p: Partner) => void;
  onViewCommissions: (p: Partner) => void;
}) {
  const initials = partner.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-all">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center font-bold text-primary text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground leading-tight truncate">{partner.name}</p>
          <p className="text-xs text-muted-foreground truncate">{partner.email}</p>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            partner.active
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {partner.active ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* Commission info */}
      <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
        <BadgePercent className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm text-foreground">
          <strong className="text-primary">{partner.commission_percentage}%</strong>{" "}
          de comissão sobre o lucro
        </span>
      </div>

      {/* PIX */}
      {partner.pix_key && (
        <p className="text-xs text-muted-foreground truncate">
          PIX: <span className="font-mono">{partner.pix_key}</span>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={(e) => { e.currentTarget.blur(); onViewCommissions(partner); }}
        >
          <DollarSign className="w-3.5 h-3.5 mr-1" />
          Comissões
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-blue-400"
          onClick={(e) => { e.currentTarget.blur(); onEdit(partner); }}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.currentTarget.blur(); onDelete(partner); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
