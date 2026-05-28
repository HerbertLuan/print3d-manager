"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCartStore, useCartHydrated } from "@/lib/cart-store";
import { createStoreOrder, getStoreSettings } from "@/lib/firestore";
import { formatBRL } from "@/lib/calculations";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  Loader2,
  MessageCircle,
  ShoppingCart,
  CheckCircle2,
  Package,
  Gift,
  Tag,
  XCircle,
  Ticket,
} from "lucide-react";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5561985592709";
const DEFAULT_GIFT_THRESHOLD = 150;

// ─── GiftProgressBar ──────────────────────────────────────────────────────────

function GiftProgressBar({
  subtotal,
  threshold,
}: {
  subtotal: number;
  threshold: number;
}) {
  const pct = Math.min(100, (subtotal / threshold) * 100);
  const remaining = Math.max(0, threshold - subtotal);
  const earned = pct >= 100;

  return (
    <div className="rounded-xl border border-[#7C3AED]/20 bg-[#7C3AED]/5 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gift className="size-3.5 text-[#7C3AED]" />
          <p className="text-xs font-semibold text-white/80">
            {earned ? (
              <span className="text-[#FACC15]">🎁 Brinde exclusivo desbloqueado!</span>
            ) : (
              <>
                Faltam{" "}
                <span className="text-white font-bold">
                  {formatBRL(remaining)}
                </span>{" "}
                para um brinde exclusivo
              </>
            )}
          </p>
        </div>
        <span className="text-[10px] text-white/30 tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── CouponInput ──────────────────────────────────────────────────────────────

function CouponInput() {
  const {
    appliedCoupon,
    discountValue,
    couponError,
    couponLoading,
    applyCoupon,
    removeCoupon,
  } = useCartStore();

  const [code, setCode] = useState("");

  async function handleApply(e: React.FormEvent | React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault();
    await applyCoupon(code);
    if (!couponError) setCode("");
  }

  // Cupom aplicado com sucesso — exibe badge
  if (appliedCoupon) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-emerald-400 tracking-widest">
                {appliedCoupon.code}
              </p>
              <p className="text-[10px] text-white/40 mt-0.5">
                {appliedCoupon.type === "gift"
                  ? "Brinde incluído no pedido 🎁"
                  : appliedCoupon.type === "percentage"
                  ? `${appliedCoupon.value}% de desconto`
                  : `${formatBRL(appliedCoupon.value)} de desconto`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={removeCoupon}
            className="text-white/30 hover:text-red-400 transition"
            aria-label="Remover cupom"
          >
            <XCircle className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApply(e);
              }
            }}
            placeholder="Cupom de desconto"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#2563EB]/50 focus:ring-1 focus:ring-[#2563EB]/30 transition"
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={couponLoading || !code.trim()}
          className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition hover:opacity-90 active:scale-95 shrink-0"
        >
          {couponLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Aplicar"
          )}
        </button>
      </div>
      {couponError && (
        <p className="text-[11px] text-red-400 flex items-center gap-1">
          <XCircle className="size-3 shrink-0" />
          {couponError}
        </p>
      )}
    </div>
  );
}

// ─── CartSheet (Sheet lateral direito) ───────────────────────────────────────

export function CartSheet() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getTotal,
    totalItems,
    appliedCoupon,
    discountValue,
  } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirmedShortCode, setConfirmedShortCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [giftThreshold, setGiftThreshold] = useState(DEFAULT_GIFT_THRESHOLD);

  // Busca o gift_threshold dinâmico do Firestore
  useEffect(() => {
    getStoreSettings()
      .then((s) => setGiftThreshold(s.gift_threshold))
      .catch(() => {}); // silencia erro, usa valor padrão
  }, []);

  const subtotal = getSubtotal();
  const total = getTotal();
  const itemCount = totalItems();

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      await analytics.then((a) => {
        if (!a) return;
        logEvent(a, "generate_lead", { currency: "BRL", value: total });
      });

      const shortCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const firstItem = items[0];
      const allNames = items
        .map((i) => `${i.quantity}x ${i.displayName}`)
        .join(", ");

      const id = await createStoreOrder({
        cliente_nome: `Pedido Web #${shortCode}`,
        cliente_telefone: "Aguardando WhatsApp",
        cart_items: items,
        valor_total: total,
        ...(appliedCoupon?.code ? { coupon_code: appliedCoupon.code } : {}),
        ...(discountValue > 0 ? { discount_amount: discountValue } : {}),
        origem: "site",
        production_status: "pending_approval",
        payment_status: "Pendente",
        instagram_handle: `Pedido Web #${shortCode}`,
        catalog_item_id: firstItem.catalogItemId,
        piece_name: allNames,
        material: "N/A",
        price: total,
        shortCode,
      });

      setOrderId(id);
      setConfirmedShortCode(shortCode);
      clearCart();

      // Monta mensagem para WhatsApp incluindo desconto se houver
      const itemsList = items
        .map((i) => `• ${i.quantity}x ${i.displayName} — ${formatBRL(i.unitPrice * i.quantity)}`)
        .join("\n");

      const discountLine =
        discountValue > 0
          ? `\n🏷️ Cupom *${appliedCoupon?.code}*: -${formatBRL(discountValue)}`
          : "";

      const msg = encodeURIComponent(
        `Olá! Fiz o pedido *#${shortCode}* no site. Segue o resumo:\n\n` +
          `${itemsList}${discountLine}\n\n` +
          `*Total: ${formatBRL(total)}*`
      );

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    } catch (err: any) {
      console.error("Erro ao criar pedido — código:", err?.code, "| mensagem:", err?.message, "| full:", err);
      setError("Não foi possível registrar o pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setOrderId(null);
    setConfirmedShortCode(null);
    setError("");
    closeCart();
  }

  const hydrated = useCartHydrated();
  if (!hydrated || !isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Sheet */}
      <aside
        className="fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-white/10 bg-[#0a0a0f] shadow-2xl sm:w-[420px]"
        aria-label="Carrinho de compras"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-white text-base">Meu Carrinho</h2>
            {itemCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-[10px] font-bold text-white shadow-[0_0_12px_rgba(37,99,235,0.3)]">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Sucesso após checkout ── */}
        {orderId && (
          <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Pedido Enviado!</h3>
            <p className="text-white/50 text-sm max-w-xs">
              Seu pedido{" "}
              <span className="font-mono font-bold text-white/80">
                #{confirmedShortCode}
              </span>{" "}
              foi registrado. O WhatsApp já foi aberto para você confirmar os
              detalhes com a gente.
            </p>
            <button
              onClick={handleReset}
              className="mt-4 h-11 px-6 rounded-full border border-white/15 text-white/70 text-sm hover:bg-white/5 hover:text-white transition"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ── Carrinho vazio ── */}
        {!orderId && items.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-white/40 text-sm">Seu carrinho está vazio.</p>
            <button
              onClick={closeCart}
              className="text-primary text-sm hover:underline"
            >
              Continuar comprando
            </button>
          </div>
        )}

        {/* ── Itens + Checkout ── */}
        {!orderId && items.length > 0 && (
          <form
            onSubmit={handleCheckout}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Lista de itens (scroll) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {items.map((item) => (
                <div
                  key={item.catalogItemId}
                  className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3"
                >
                  {/* Imagem */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-black/30 shrink-0">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.displayName}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    ) : (
                      <Package className="w-6 h-6 text-white/20 m-auto mt-4" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">
                      {item.displayName}
                    </p>
                    <p className="text-xs text-white/40 tabular-nums">
                      {formatBRL(item.unitPrice)}/un
                    </p>
                  </div>

                  {/* Controles de quantidade */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.catalogItemId, item.quantity - 1)
                      }
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-white tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.catalogItemId, item.quantity + 1)
                      }
                      className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Preço linha */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-white tabular-nums">
                      {formatBRL(item.unitPrice * item.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.catalogItemId)}
                      className="text-white/20 hover:text-red-400 transition mt-1"
                      aria-label="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé — Total + Formulário + Botão */}
            <div className="border-t border-white/[0.07] px-5 py-5 space-y-4 bg-[#0a0a0f]">

              {/* Banner de Retirada em Mãos */}
              <div className="flex items-center gap-3 rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-sm">
                  📍
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/90">
                    Retirada em Mãos
                  </p>
                  <p className="text-[11px] text-white/40 leading-tight">
                    Combinamos a entrega pelo WhatsApp — Brasília / DF
                  </p>
                </div>
              </div>

              {/* Barra de Brinde (gift_threshold dinâmico) */}
              <GiftProgressBar subtotal={subtotal} threshold={giftThreshold} />

              {/* Campo de cupom */}
              <CouponInput />

              {/* Resumo de valores */}
              <div className="space-y-1.5">
                {/* Subtotal */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Subtotal</span>
                  <span className="text-white/70 tabular-nums">{formatBRL(subtotal)}</span>
                </div>

                {/* Linha de desconto (visível apenas com cupom ativo) */}
                {appliedCoupon && discountValue > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Ticket className="size-3.5" />
                      Desconto ({appliedCoupon.code})
                    </span>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      − {formatBRL(discountValue)}
                    </span>
                  </div>
                )}

                {/* Brinde gift sem valor numérico */}
                {appliedCoupon?.type === "gift" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#FACC15] flex items-center gap-1">
                      <Gift className="size-3.5" />
                      Brinde ({appliedCoupon.code})
                    </span>
                    <span className="text-[#FACC15] font-bold">Incluso</span>
                  </div>
                )}

                {/* Separador */}
                <div className="h-px bg-white/[0.06]" />

                {/* Total */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Total</span>
                  <span className="text-2xl font-bold text-white tabular-nums">
                    {formatBRL(total)}
                  </span>
                </div>
              </div>

              {/* Botão Finalizar */}
              <button
                type="submit"
                disabled={loading || items.length === 0}
                className="evins-gradient-button flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    Finalizar Pedido pelo WhatsApp
                  </>
                )}
              </button>
              <p className="text-[10px] text-white/25 text-center">
                Seu pedido será registrado e você será redirecionado para o
                WhatsApp para confirmar.
              </p>
              {error && (
                <p className="text-center text-xs text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>
          </form>
        )}
      </aside>
    </>
  );
}

// ─── CartFab — Botão Flutuante ────────────────────────────────────────────────

export function CartFab() {
  const { openCart, totalItems } = useCartStore();
  const hydrated = useCartHydrated();
  const count = hydrated ? totalItems() : 0;

  return (
    <button
      onClick={openCart}
      aria-label="Abrir carrinho"
      className="evins-gradient-button fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-105 active:scale-95"
    >
      <ShoppingBag className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary text-[10px] font-extrabold shadow">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
