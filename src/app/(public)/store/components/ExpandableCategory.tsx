"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingBag,
  Check,
  Star,
  Layers,
  Flame,
  Zap,
} from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { Collection } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { ProductCard } from "./ProductCard";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Tipo auxiliar ────────────────────────────────────────────────────────────

interface CategoryGroup {
  collection: Collection | null;
  items: CatalogItem[];
}

// ─── Badge helper (consistente com ProductCard) ───────────────────────────────

type BadgeType = "mais-vendido" | "novidade" | null;

function getBadgeType(item: CatalogItem): BadgeType {
  if (item.destaque) return "mais-vendido";
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const createdAt = item.created_at?.seconds ? item.created_at.seconds * 1000 : 0;
  if (createdAt > thirtyDaysAgo) return "novidade";
  return null;
}

// ─── ExpandableCategory ───────────────────────────────────────────────────────

export function ExpandableCategory({ group }: { group: CategoryGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const autoplay = useRef(
    Autoplay({ delay: 3200, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: false, align: "start", skipSnaps: false, dragFree: true },
    [autoplay.current]
  );

  // Atualiza estado de navegação quando o carrosel move
  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", update);
    emblaApi.on("init", update);
    return () => { emblaApi.off("select", update); };
  }, [emblaApi]);

  const { items, collection } = group;
  const title = collection?.nome ?? "Outros Produtos";
  const isDestacada = collection?.em_destaque ?? false;

  return (
    <div className="relative">
      {/* ── Header: título clicável ────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="group w-full flex items-center justify-between gap-4 py-5 px-1 text-left transition-all"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestacada
                ? "border border-primary/25 bg-gradient-to-br from-primary/20 to-secondary/20"
                : "bg-white/[0.04] border border-white/10"
            }`}
          >
            <Layers
              className={`w-4.5 h-4.5 ${
                isDestacada ? "text-primary" : "text-white/40"
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white transition-colors group-hover:text-primary-foreground sm:text-2xl">
                {title}
              </h2>
              {isDestacada && (
                <span className="hidden rounded-full bg-gradient-to-r from-primary to-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white sm:inline-flex sm:items-center sm:gap-1">
                  <Star className="w-2.5 h-2.5 fill-white" />
                  Sazonal
                </span>
              )}
            </div>
            <p className="text-xs text-white/35 mt-0.5">
              {items.length} {items.length === 1 ? "produto" : "produtos"} ·{" "}
              {isExpanded ? "Clique para fechar" : "Clique para ver tudo"}
            </p>
          </div>
        </div>

        {/* Seta animada */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="shrink-0 w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/40 group-hover:border-white/20 group-hover:text-white/60 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* ── Carrosel Redesenhado (estado fechado) ───────────────────── */}
      <AnimatePresence initial={false}>
        {!isExpanded && (
          <motion.div
            key="carousel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="relative">
              {/* Botões de navegação — desktop */}
              {canPrev && (
                <button
                  onClick={() => emblaApi?.scrollPrev()}
                  className="absolute left-0 top-[40%] z-10 -translate-y-1/2 -translate-x-2 hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0D0D0D]/90 text-white/70 hover:text-white hover:border-white/30 transition backdrop-blur-sm shadow-lg"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {canNext && (
                <button
                  onClick={() => emblaApi?.scrollNext()}
                  className="absolute right-0 top-[40%] z-10 -translate-y-1/2 translate-x-2 hidden sm:flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0D0D0D]/90 text-white/70 hover:text-white hover:border-white/30 transition backdrop-blur-sm shadow-lg"
                  aria-label="Próximo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {/* Fade de overflow na direita */}
              {canNext && (
                <div className="pointer-events-none absolute right-0 inset-y-0 w-12 bg-gradient-to-l from-[#0D0D0D] to-transparent z-[5]" />
              )}

              {/* Embla viewport */}
              <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
                <div className="flex gap-3 pb-4">
                  {items.map((item) => (
                    <CarouselCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            </div>

            {/* Indicador de scroll — linha de progresso */}
            <div className="flex items-center gap-2 px-1 pb-4">
              <div className="flex-1 h-px bg-white/[0.06] rounded-full relative overflow-hidden">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  animate={{
                    width: `${((selectedIndex + 1) / Math.max(items.length, 1)) * 100}%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-[10px] text-white/20 tabular-nums shrink-0">
                {selectedIndex + 1} / {items.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid expandido (estado aberto) ────────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="grid grid-cols-2 gap-4 pb-6 sm:grid-cols-3 lg:grid-cols-4"
            >
              {items.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Linha divisória */}
      <div className="h-px bg-white/[0.05] mt-2" />
    </div>
  );
}

// ─── CarouselCard — novo design ───────────────────────────────────────────────
// Layout: imagem quadrada no topo + info abaixo (nome, preço riscado, preço, CTA)

function CarouselCard({ item }: { item: CatalogItem }) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  const displayName = item.headline_venda || item.name;
  const badgeType = getBadgeType(item);

  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

  const MARKUP = item.destaque ? 1.35 : 1.28;
  const fakeOriginalPrice = effectivePrice * MARKUP;

  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(false), 1500);
    return () => window.clearTimeout(t);
  }, [added]);

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    addItem({
      catalogItemId: item.id,
      name: item.name,
      displayName,
      imageUrl: item.imageUrl,
      unitPrice: effectivePrice,
    });
    setAdded(true);
    toast.success(`${displayName} adicionado!`, {
      duration: 2000,
      position: "bottom-right",
    });
  }

  return (
    // Largura: 58% mobile → 36% tablet → 24% desktop (mostra 1.7 / 2.7 / 4)
    <div className="flex-[0_0_58%] sm:flex-[0_0_36%] lg:flex-[0_0_24%] min-w-0">
      <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111118] transition-all duration-300 hover:border-[#2563EB]/30 hover:shadow-[0_0_20px_rgba(37,99,235,0.1)]">

        {/* ── Imagem 1:1 ── */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#10131d] via-[#0f0f14] to-[#181028]">
          {/* Badge canto superior esquerdo */}
          {badgeType && (
            <div
              className={cn(
                "absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em]",
                badgeType === "mais-vendido"
                  ? "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white"
                  : "bg-[#FACC15]/90 text-black"
              )}
            >
              {badgeType === "mais-vendido" ? (
                <Flame className="size-2.5" />
              ) : (
                <Zap className="size-2.5" />
              )}
              {badgeType === "mais-vendido" ? "Top" : "Novo"}
            </div>
          )}

          {/* Glow da marca */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.16),transparent_40%)]" />

          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={displayName}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
              sizes="(max-width: 640px) 58vw, (max-width: 1024px) 36vw, 24vw"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Package className="size-8 text-white/15" />
            </div>
          )}
        </div>

        {/* ── Info abaixo da imagem ── */}
        <div className="flex flex-col gap-2 p-3">
          {/* Nome */}
          <p className="text-xs font-medium leading-snug text-white/85 line-clamp-2 min-h-[2.5em]">
            {displayName}
          </p>

          {/* Preços */}
          <div>
            <p className="text-[10px] text-white/30 line-through tabular-nums leading-none">
              {formatBRL(fakeOriginalPrice)}
            </p>
            <p className="text-sm font-bold tabular-nums text-white mt-0.5">
              {formatBRL(effectivePrice)}
            </p>
          </div>

          {/* Botão Eu Quero */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={added}
            className={cn(
              "mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold transition-all duration-300 active:scale-95",
              added
                ? "bg-[#FACC15] text-black"
                : "bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white hover:opacity-90"
            )}
          >
            {added ? (
              <>
                <Check className="size-3" />
                Adicionado!
              </>
            ) : (
              <>
                <ShoppingBag className="size-3" />
                Eu Quero
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Export auxiliar ─────────────────────────────────────────────────────────

export type { CategoryGroup };
