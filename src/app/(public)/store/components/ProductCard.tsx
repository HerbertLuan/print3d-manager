"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Clock3, Layers3, Package, ShoppingBag, Sparkles, Star } from "lucide-react";
import { CatalogItem } from "@/lib/types";
import { formatBRL, formatTime } from "@/lib/calculations";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export function ProductCard({ item }: { item: CatalogItem }) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);
  const displayName = item.headline_venda || item.name;
  const description = item.descricao_venda;

  const requiredFilaments = item.required_filaments || [
    { material: item.material || "PLA", weight_grams: item.weight_grams || 0 },
  ];
  const isMultiColor = requiredFilaments.length > 1;
  const primaryMaterial = requiredFilaments[0]?.material ?? "PLA";
  const totalWeight = requiredFilaments.reduce((sum, filament) => sum + (filament.weight_grams || 0), 0);

  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

  const FAKE_PRICE_MULTIPLIER = 1.35;
  const fakeOriginalPrice = effectivePrice * FAKE_PRICE_MULTIPLIER;
  const isFeatured = item.destaque === true;

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
    <article className="evins-panel-strong group relative flex h-full flex-col overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {isFeatured && (
        <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.15)]">
          <Star className="size-3 fill-current" />
          Destaque
        </div>
      )}

      <div className="relative aspect-[4/3] overflow-hidden border-b border-white/8 bg-gradient-to-br from-[#10131d] via-[#0f0f14] to-[#181028]">
        <div className="evins-grid-bg absolute inset-0 opacity-[0.14]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.22),transparent_36%)]" />

        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={displayName}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="flex size-18 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Package className="size-8 text-white/30" />
            </div>
            <span className="text-xs uppercase tracking-[0.3em] text-white/35">Sem foto</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-black/20 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
          <span className="evins-chip bg-black/45 text-white/80 backdrop-blur-md">
            <Layers3 className="size-3.5" />
            {primaryMaterial}
          </span>
          {isMultiColor && (
            <span className="evins-chip bg-secondary/16 text-secondary-foreground">
              <Sparkles className="size-3.5" />
              Multicor
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 space-y-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/80">
              EVINS Collection
            </p>
            <h3 className="text-xl font-semibold leading-tight text-white transition-colors group-hover:text-primary-foreground">
              {displayName}
            </h3>
            {description && (
              <p className="line-clamp-3 text-sm leading-relaxed text-white/58">
                {description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                Tempo
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-white/86">
                <Clock3 className="size-4 text-primary" />
                {formatTime(item.time_minutes)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                Material
              </p>
              <p className="text-sm font-medium text-white/86">
                {totalWeight}g estimados
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-white/8 pt-5">
          <div className="min-w-0">
            {isFeatured ? (
              <>
                <p className="text-xs text-white/30 line-through tabular-nums">
                  {formatBRL(fakeOriginalPrice)}
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-3xl font-bold tabular-nums text-white evins-price-glow">
                    {formatBRL(effectivePrice)}
                  </span>
                  <span className="mb-1 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-300">
                    Oferta
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
                  A partir de
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-white evins-price-glow">
                  {formatBRL(effectivePrice)}
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={added}
            className={cn(
              "evins-focus inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-all duration-300 active:scale-[0.98] disabled:cursor-default",
              added
                ? "border border-yellow-400/25 bg-yellow-400 text-black shadow-[0_14px_30px_rgba(250,204,21,0.22)]"
                : "evins-gradient-button"
            )}
          >
            {added ? (
              <>
                <Check className="size-4" />
                Adicionado
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
