"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Flame, Package, ShoppingBag, Star, Zap } from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── Gerador de avaliações pseudo-aleatórias determinísticas ─────────────────
// Usa o ID do item como seed para que seja sempre o mesmo valor
function getSeededRating(id: string): { stars: number; count: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);
  // Estrelas entre 4.0 e 5.0
  const stars = 4.0 + (absHash % 10) / 10;
  // Avaliações entre 12 e 147
  const count = 12 + (absHash % 136);
  return { stars, count };
}

// ─── Componente de estrelas ────────────────────────────────────────────────────
function StarRating({ stars, count }: { stars: number; count: number }) {
  const fullStars = Math.floor(stars);
  const hasHalf = stars - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3",
              i < fullStars
                ? "fill-[#FACC15] text-[#FACC15]"
                : i === fullStars && hasHalf
                ? "fill-[#FACC15]/50 text-[#FACC15]"
                : "fill-white/10 text-white/20"
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-white/40 tabular-nums">({count})</span>
    </div>
  );
}

// ─── Badge de urgência/escassez ───────────────────────────────────────────────
type BadgeType = "mais-vendido" | "novidade" | "exclusivo" | null;

function getBadgeType(item: CatalogItem): BadgeType {
  // Itens marcados como destaque recebem badge "Mais Vendido"
  if (item.destaque) return "mais-vendido";
  // Itens criados nos últimos 30 dias recebem badge "Novidade"
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const createdAt = item.created_at?.seconds
    ? item.created_at.seconds * 1000
    : 0;
  if (createdAt > thirtyDaysAgo) return "novidade";
  return null;
}

function ConversionBadge({ type }: { type: BadgeType }) {
  if (!type) return null;

  const config = {
    "mais-vendido": {
      icon: <Flame className="size-3" />,
      label: "Mais Vendido",
      className:
        "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white shadow-[0_0_14px_rgba(37,99,235,0.4)]",
    },
    novidade: {
      icon: <Zap className="size-3" />,
      label: "Novidade",
      className:
        "bg-gradient-to-r from-[#FACC15]/90 to-[#f59e0b]/90 text-black shadow-[0_0_14px_rgba(250,204,21,0.3)]",
    },
    exclusivo: {
      icon: <Star className="size-3 fill-current" />,
      label: "Exclusivo",
      className:
        "bg-gradient-to-r from-[#7C3AED] to-[#9333ea] text-white shadow-[0_0_14px_rgba(124,58,237,0.4)]",
    },
  }[type];

  return (
    <div
      className={cn(
        "absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

export function ProductCard({ item }: { item: CatalogItem }) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const displayName = item.headline_venda || item.name;
  const description = item.descricao_venda;
  const badgeType = getBadgeType(item);
  const { stars, count } = getSeededRating(item.id);

  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

  // Preço riscado: 25% a 40% acima para itens comuns, 35% para destaques
  const MARKUP = item.destaque ? 1.35 : 1.28;
  const fakeOriginalPrice = effectivePrice * MARKUP;

  useEffect(() => {
    if (!added) return;
    const timeout = window.setTimeout(() => setAdded(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [added]);

  function handleAddToCart() {
    addItem({
      catalogItemId: item.id,
      name: item.name,
      displayName,
      imageUrl: item.imageUrl,
      unitPrice: effectivePrice,
    });

    setAdded(true);
    toast.success(`${displayName} adicionado à sacola!`, {
      duration: 2500,
      position: "bottom-right",
    });

    analytics.then((a) => {
      if (!a) return;
      logEvent(a, "add_to_cart", {
        currency: "BRL",
        value: effectivePrice,
        items: [{ item_id: item.id, item_name: displayName }],
      });
    });
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118] transition-all duration-300 hover:border-[#2563EB]/30 hover:shadow-[0_0_30px_rgba(37,99,235,0.12)]">
      {/* Linha de brilho no topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* ── Imagem ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#10131d] via-[#0f0f14] to-[#181028]">
        {/* Badge de conversão — canto superior ESQUERDO */}
        <ConversionBadge type={badgeType} />

        {/* Padrão de grade sutil */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Glows de cor da marca */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.2),transparent_40%)]" />

        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Package className="size-10 text-white/20" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/25">
              Sem foto
            </span>
          </div>
        )}

        {/* Gradiente inferior sobre a imagem */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-black/10 to-transparent" />
      </div>

      {/* ── Corpo do Card ── */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Título */}
        <h3 className="mb-2 text-base font-semibold leading-snug text-white/92 line-clamp-2 transition-colors group-hover:text-white">
          {displayName}
        </h3>

        {/* Avaliações */}
        <StarRating stars={stars} count={count} />

        {/* Descrição */}
        {description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/40">
            {description}
          </p>
        )}

        {/* ── Área de Preço + CTA ── */}
        <div className="mt-auto pt-4 border-t border-white/[0.07]">
          {/* Preço riscado → Preço real (todos os cards) */}
          <div className="mb-3">
            <p className="text-xs text-white/30 line-through tabular-nums leading-none mb-1">
              {formatBRL(fakeOriginalPrice)}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold tabular-nums text-white">
                {formatBRL(effectivePrice)}
              </span>
              {item.destaque && (
                <span className="mb-0.5 rounded-full border border-[#FACC15]/25 bg-[#FACC15]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#FACC15]">
                  Oferta
                </span>
              )}
            </div>
          </div>

          {/* Botão "Eu Quero" com gradiente da marca */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={added}
            className={cn(
              "w-full inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-all duration-300 active:scale-[0.97]",
              added
                ? "bg-[#FACC15] text-black border border-[#FACC15]/40 shadow-[0_0_20px_rgba(250,204,21,0.25)]"
                : "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-[#1d4ed8] hover:to-[#6d28d9] shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_28px_rgba(37,99,235,0.4)]"
            )}
          >
            {added ? (
              <>
                <Check className="size-4" />
                Adicionado!
              </>
            ) : (
              <>
                <ShoppingBag className="size-4" />
                Eu Quero
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
