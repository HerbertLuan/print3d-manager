"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Flame, Package, Search, ShoppingBag, Star, X, Zap } from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── Gerador de avaliações pseudo-aleatórias determinísticas ─────────────────
function getSeededRating(id: string): { stars: number; count: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);
  const stars = 4.0 + (absHash % 10) / 10;
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
  if (item.destaque) return "mais-vendido";
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const createdAt = item.created_at?.seconds ? item.created_at.seconds * 1000 : 0;
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

// ─── Image Lightbox Modal ─────────────────────────────────────────────────────

function ImageLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  // Fecha com Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizar: ${alt}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Brilhos de marca no fundo do modal */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#2563EB]/10 blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-[#7C3AED]/10 blur-[80px]" />
      </div>

      {/* Botão fechar */}
      <button
        onClick={onClose}
        aria-label="Fechar visualização"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 hover:scale-105 active:scale-95 sm:right-6 sm:top-6"
      >
        <X className="size-5" />
      </button>

      {/* Container da imagem */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl items-center justify-center">
        {/* Linha de brilho no topo */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

        <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0f] shadow-[0_0_60px_rgba(0,0,0,0.8)]">
          {/* Nome do produto no topo */}
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-medium text-white/70 truncate">{alt}</p>
          </div>

          {/* Imagem com object-contain */}
          <div className="relative flex items-center justify-center bg-[#0a0a0d] max-h-[calc(85vh-8rem)]">
            <img
              src={src}
              alt={alt}
              className="block w-full max-h-[calc(85vh-8rem)] object-contain"
              style={{ maxHeight: "calc(85vh - 8rem)" }}
            />
          </div>

          {/* Rodapé sutil */}
          <div className="px-5 py-2.5 border-t border-white/[0.06] flex items-center justify-center">
            <p className="text-[11px] text-white/20 uppercase tracking-widest">
              EVINS Personalizados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

export function ProductCard({ item }: { item: CatalogItem }) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayName = item.headline_venda || item.name;
  const description = item.descricao_venda;
  const badgeType = getBadgeType(item);
  const { stars, count } = getSeededRating(item.id);

  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

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
    <>
      {/* Lightbox — renderizado fora do card para evitar problemas de z-index / overflow */}
      {item.imageUrl && (
        <ImageLightbox
          src={item.imageUrl}
          alt={displayName}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118] transition-all duration-300 hover:border-[#2563EB]/30 hover:shadow-[0_0_30px_rgba(37,99,235,0.12)]">
        {/* Linha de brilho no topo */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* ── Imagem (clicável para lightbox) ── */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#10131d] via-[#0f0f14] to-[#181028]">
          {/* Badge de conversão */}
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
            <>
              <Image
                src={item.imageUrl}
                alt={displayName}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                unoptimized
              />

              {/* Overlay de Quick View — aparece no hover */}
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label={`Ver foto de ${displayName} em tamanho completo`}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/0 transition-all duration-300 group-hover:bg-black/45 cursor-zoom-in"
              >
                {/* Ícone + texto — visíveis apenas no hover */}
                <span className="flex flex-col items-center gap-1.5 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm shadow-lg">
                    <Search className="size-4 text-white" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                    Ver Foto
                  </span>
                </span>
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Package className="size-10 text-white/20" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/25">
                Sem foto
              </span>
            </div>
          )}

          {/* Gradiente inferior sobre a imagem */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-black/10 to-transparent pointer-events-none" />
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

            {/* Botão "Eu Quero" */}
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
    </>
  );
}
