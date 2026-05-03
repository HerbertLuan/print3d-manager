"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Package,
  Star,
  Layers,
} from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { Collection } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { ProductCard } from "./ProductCard";

// ─── Tipo auxiliar ────────────────────────────────────────────────────────────

interface CategoryGroup {
  collection: Collection | null; // null = "Geral / Sem Coleção"
  items: CatalogItem[];
}

// ─── ExpandableCategory ───────────────────────────────────────────────────────

export function ExpandableCategory({ group }: { group: CategoryGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const autoplay = useRef(
    Autoplay({ delay: 2800, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: "center", skipSnaps: false },
    [autoplay.current]
  );

  const { items, collection } = group;
  const title = collection?.nome ?? "Outros Produtos";
  const isDestactada = collection?.em_destaque ?? false;

  return (
    <div className="relative">
      {/* ── Header: título clicável ────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="group w-full flex items-center justify-between gap-4 py-5 px-1 text-left transition-all"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {/* Ícone de coleção */}
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isDestactada
                ? "border border-primary/25 bg-gradient-to-br from-primary/20 to-secondary/20"
                : "bg-white/[0.04] border border-white/10"
            }`}
          >
            <Layers
              className={`w-4.5 h-4.5 ${
                isDestactada ? "text-primary" : "text-white/40"
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white transition-colors group-hover:text-primary-foreground sm:text-2xl">
                {title}
              </h2>
              {isDestactada && (
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

      {/* ── Carrossel (estado fechado) ─────────────────────────────── */}
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
            {/* Carrossel Embla */}
            <div
              className="overflow-hidden rounded-2xl cursor-pointer"
              ref={emblaRef}
              onClick={() => setIsExpanded(true)}
            >
              <div className="flex -ml-3">
                {items.map((item) => (
                  <CarouselSlide key={item.id} item={item} />
                ))}
              </div>
            </div>
            {/* CTA sutil abaixo do carrossel */}
            <p className="text-center text-xs text-white/25 mt-3 mb-1">
              ↑ Clique nas imagens para ver os cards completos
            </p>
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
              className="grid grid-cols-1 gap-6 pb-6 sm:grid-cols-2 lg:grid-cols-3"
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

// ─── Slide do Carrossel ───────────────────────────────────────────────────────

function CarouselSlide({ item }: { item: CatalogItem }) {
  const displayName = item.headline_venda || item.name;
  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

  return (
    <div className="relative pl-3 flex-[0_0_72%] sm:flex-[0_0_40%] lg:flex-[0_0_28%] min-w-0">
      <div className="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] aspect-[3/4]">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 72vw, (max-width: 1024px) 40vw, 28vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-white/10" />
          </div>
        )}
        {/* Gradiente + nome sobrepostos */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-4">
          <p className="text-white font-semibold text-sm leading-snug line-clamp-2">
            {displayName}
          </p>
          <p className="mt-1 text-base font-bold tabular-nums text-primary">
            {formatBRL(effectivePrice)}
          </p>
        </div>
        {item.destaque && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-secondary px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
            <Star className="w-2.5 h-2.5 fill-white" />
            Destaque
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Export auxiliar ─────────────────────────────────────────────────────────

export type { CategoryGroup };
