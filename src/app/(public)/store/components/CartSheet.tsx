"use client";

import { useState } from "react";
import Image from "next/image";
import { useCartStore, useCartHydrated } from "@/lib/cart-store";
import { createStoreOrder } from "@/lib/firestore";
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
} from "lucide-react";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5561985592709";

// ─── CartSheet (Sheet lateral direito) ───────────────────────────────────────

export function CartSheet() {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    clearCart,
    cartTotal,
    totalItems,
  } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirmedShortCode, setConfirmedShortCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  const total = cartTotal();
  const itemCount = totalItems();

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      // 📊 GA4: generate_lead — funil de venda: usuário clicou em "Finalizar Pedido"
      // Disparado ANTES do Firestore para não perder o evento caso ocorra erro
      await analytics.then((a) => {
        if (!a) return;
        logEvent(a, "generate_lead", {
          currency: "BRL",
          value: total, // total já com desconto de cupom (se implementado)
        });
      });

      // Gera um short code (ex: A7F2)
      const shortCode = Math.random().toString(36).substring(2, 6).toUpperCase();

      // Monta item principal para campos legados obrigatórios
      const firstItem = items[0];
      const allNames = items
        .map((i) => `${i.quantity}x ${i.displayName}`)
        .join(", ");

      const id = await createStoreOrder({
        cliente_nome: `Pedido Web #${shortCode}`,
        cliente_telefone: "Aguardando WhatsApp",
        cart_items: items,
        valor_total: total,
        origem: "site",
        production_status: "pending_approval",
        payment_status: "Pendente",
        // Campos legados (obrigatórios pelo schema Order)
        instagram_handle: `Pedido Web #${shortCode}`,
        catalog_item_id: firstItem.catalogItemId,
        piece_name: allNames,
        material: "N/A",
        price: total,
        shortCode,
      });

      setOrderId(id);
      setConfirmedShortCode(shortCode);

      // Limpa carrinho
      clearCart();

      // Gera e abre link do WhatsApp
      const itemsList = items
        .map((i) => `• ${i.quantity}x ${i.displayName} — ${formatBRL(i.unitPrice * i.quantity)}`)
        .join("\n");

      const msg = encodeURIComponent(
        `Olá! Fiz o pedido *#${shortCode}* no site. Segue o resumo:\n\n` +
        `${itemsList}\n\n` +
        `*Total: ${formatBRL(total)}*`
      );

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    } catch (err) {
      console.error("Erro ao criar pedido:", err);
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

  // Guard de hidratação: o servidor renderiza sem acesso ao localStorage.
  // Se renderizarmos isOpen=true no cliente (vindo do persist), ocorre mismatch.
  // Retornamos null até o componente estar montado no cliente.
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
            <h2 className="font-semibold text-white text-base">
              Meu Carrinho
            </h2>
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
              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">Total</span>
                <span className="text-2xl font-bold text-white tabular-nums">
                  {formatBRL(total)}
                </span>
              </div>

              {/* Botão Finalizar imediato */}
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
  // Durante SSR e 1ª renderização do cliente, count=0 para igualar o HTML do servidor
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
