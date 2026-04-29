"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Package,
  ShoppingBag,
  Star,
  Layers,
} from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { Collection } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";

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
                ? "bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/25"
                : "bg-white/[0.04] border border-white/10"
            }`}
          >
            <Layers
              className={`w-4.5 h-4.5 ${
                isDestactada ? "text-orange-400" : "text-white/40"
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-orange-100 transition-colors">
                {title}
              </h2>
              {isDestactada && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-orange-500 to-rose-500 text-white px-2.5 py-1 rounded-full">
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
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-6"
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
          <p className="text-orange-300 font-bold text-base tabular-nums mt-1">
            {formatBRL(effectivePrice)}
          </p>
        </div>
        {item.destaque && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-white" />
            Destaque
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProductCard (full card) ──────────────────────────────────────────────────

function ProductCard({ item }: { item: CatalogItem }) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const displayName = item.headline_venda || item.name;
  const description = item.descricao_venda;

  const requiredFilaments = item.required_filaments || [
    { material: item.material || "PLA", weight_grams: item.weight_grams || 0 },
  ];
  const isMultiColor = requiredFilaments.length > 1;
  const primaryMaterial = requiredFilaments[0]?.material ?? "PLA";

  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

  const FAKE_PRICE_MULTIPLIER = 1.35;
  const fakeOriginalPrice = effectivePrice * FAKE_PRICE_MULTIPLIER;
  const isDestaque = item.destaque === true;

  function handleAddToCart() {
    addItem({
      catalogItemId: item.id,
      name: item.name,
      displayName,
      imageUrl: item.imageUrl,
      unitPrice: effectivePrice,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
    toast.success(`${displayName} adicionado à sacola!`, {
      duration: 2500,
      position: "bottom-right",
    });

    // 📊 GA4: add_to_cart (parâmetros de e-commerce recomendados pelo Google)
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
    <article className="group relative flex flex-col bg-white/[0.025] border border-white/[0.07] hover:border-white/20 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(249,115,22,0.07)]">
      {isDestaque && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
          <Star className="w-3 h-3 fill-white" />
          Destaque
        </div>
      )}

      {/* Imagem */}
      <div className="relative w-full aspect-[4/3] bg-black/20 overflow-hidden">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Package className="w-16 h-16 text-white/10" />
            <span className="text-xs text-white/20">Sem foto</span>
          </div>
        )}
        {isMultiColor && (
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500" />
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
              Multi-Color
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-6">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2">
          {primaryMaterial}
        </span>
        <h3 className="text-lg font-semibold text-white/90 group-hover:text-white transition-colors leading-snug mb-2">
          {displayName}
        </h3>
        {description && (
          <p className="text-sm text-white/45 leading-relaxed mb-4 line-clamp-2">
            {description}
          </p>
        )}

        <div className="mt-auto pt-5 border-t border-white/[0.07] flex items-center justify-between gap-4">
          {isDestaque ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-white/30 line-through tabular-nums leading-none">
                De: {formatBRL(fakeOriginalPrice)}
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                  Por apenas
                </span>
                <span className="text-2xl font-bold text-emerald-400 tabular-nums drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]">
                  {formatBRL(effectivePrice)}
                </span>
              </div>
              <span className="inline-flex w-fit items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5">
                Economia de {formatBRL(fakeOriginalPrice - effectivePrice)}
              </span>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-0.5">
                a partir de
              </p>
              <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tabular-nums">
                {formatBRL(effectivePrice)}
              </p>
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={added}
            className={`group/btn shrink-0 h-12 px-5 rounded-full font-semibold text-sm active:scale-[0.97] transition-all duration-300 flex items-center gap-2 ${
              added
                ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-default"
                : "bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:opacity-90 shadow-[0_0_20px_rgba(249,115,22,0.2)]"
            }`}
          >
            {added ? (
              <>
                <span className="text-base leading-none">✓</span>
                Adicionado!
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5" />
                Eu Quero
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Export auxiliar ─────────────────────────────────────────────────────────

export type { CategoryGroup };
