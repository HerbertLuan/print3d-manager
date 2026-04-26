"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useCartStore, useCartHydrated } from "@/lib/cart-store";
import { createStoreOrder } from "@/lib/firestore";
import { formatBRL } from "@/lib/calculations";
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

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const total = cartTotal();
  const itemCount = totalItems();

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim() || items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      // Monta item principal para campos legados obrigatórios
      const firstItem = items[0];
      const allNames = items
        .map((i) => `${i.quantity}x ${i.displayName}`)
        .join(", ");

      const id = await createStoreOrder({
        cliente_nome: nome.trim(),
        cliente_telefone: telefone.trim(),
        cart_items: items,
        valor_total: total,
        origem: "site",
        production_status: "pending_approval",
        payment_status: "Pendente",
        // Campos legados (obrigatórios pelo schema Order)
        instagram_handle: nome.trim(),
        catalog_item_id: firstItem.catalogItemId,
        piece_name: allNames,
        material: "N/A",
        price: total,
      });

      setOrderId(id);

      // Limpa carrinho
      clearCart();

      // Gera e abre link do WhatsApp
      const itemsList = items
        .map((i) => `• ${i.quantity}x ${i.displayName} — ${formatBRL(i.unitPrice * i.quantity)}`)
        .join("\n");

      const msg = encodeURIComponent(
        `Olá! Fiz um pedido no site.\n` +
        `Meu nome é ${nome.trim()}.\n\n` +
        `Pedido #${id.slice(-8).toUpperCase()}:\n` +
        `${itemsList}\n\n` +
        `Total: ${formatBRL(total)}\n\n` +
        `Telefone de contato: ${telefone.trim()}`
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
    setNome("");
    setTelefone("");
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
        className="fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-[#0a0a0f] border-l border-white/10 flex flex-col shadow-2xl"
        aria-label="Carrinho de compras"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-white text-base">
              Meu Carrinho
            </h2>
            {itemCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
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
                #{orderId.slice(-8).toUpperCase()}
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
              className="text-orange-400 text-sm hover:underline"
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

              {/* Formulário de checkout */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                  Seus dados
                </p>
                <input
                  required
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  disabled={loading}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 disabled:opacity-50 transition"
                />
                <input
                  required
                  type="tel"
                  placeholder="Telefone / WhatsApp (ex: 61999999999)"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  disabled={loading}
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 disabled:opacity-50 transition"
                />
              </div>

              {/* Erro */}
              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}

              {/* Botão Finalizar */}
              <button
                type="submit"
                disabled={loading || !nome.trim() || !telefone.trim()}
                className="w-full h-12 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
      className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-95 transition-all duration-200"
    >
      <ShoppingBag className="w-6 h-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-orange-600 text-[10px] font-extrabold flex items-center justify-center shadow">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
