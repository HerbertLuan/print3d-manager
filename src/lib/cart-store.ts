/**
 * cart-store.ts — Estado global do carrinho com persistência em localStorage.
 * Usa Zustand com o middleware `persist`.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, Coupon } from "@/lib/types";
import { getCouponByCode } from "@/lib/firestore";
import { useEffect, useState } from "react";

/** Arredonda para 2 casas decimais de forma segura. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcula o valor de desconto dado um cupom e o subtotal. */
function calcDiscount(coupon: Coupon, subtotal: number): number {
  if (coupon.type === "percentage") return round2((subtotal * coupon.value) / 100);
  if (coupon.type === "fixed") return round2(Math.min(coupon.value, subtotal));
  return 0; // gift
}

/**
 * Hook de hidratação segura para componentes que lêem o cart store.
 * Retorna `false` no primeiro render (SSR/hidratação) e `true` após o cliente montar.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  appliedCoupon: Coupon | null;
  discountValue: number;
  couponError: string;
  couponLoading: boolean;

  // Derived
  getSubtotal: () => number;
  getTotal: () => number;
  totalItems: () => number;
  /** Alias legado (retorna getTotal) */
  cartTotal: () => number;

  // Actions
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (catalogItemId: string) => void;
  updateQuantity: (catalogItemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      /**
       * Recalcula o desconto com base no subtotal atual.
       * Remove o cupom automaticamente se o mínimo não for mais atingido.
       */
      function recalcDiscount() {
        const coupon = get().appliedCoupon;
        if (!coupon) return;
        const subtotal = get().getSubtotal();
        if (subtotal < coupon.min_purchase_value) {
          set({ appliedCoupon: null, discountValue: 0, couponError: "" });
          return;
        }
        set({ discountValue: calcDiscount(coupon, subtotal) });
      }

      return {
        items: [],
        isOpen: false,
        appliedCoupon: null,
        discountValue: 0,
        couponError: "",
        couponLoading: false,

        getSubtotal: () =>
          round2(get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)),

        getTotal: () => {
          const subtotal = get().getSubtotal();
          return round2(Math.max(0, subtotal - get().discountValue));
        },

        totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

        cartTotal: () => get().getTotal(),

        openCart: () => set({ isOpen: true }),
        closeCart: () => set({ isOpen: false }),

        addItem: (newItem) => {
          set((state) => {
            const existing = state.items.find(
              (i) => i.catalogItemId === newItem.catalogItemId
            );
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.catalogItemId === newItem.catalogItemId
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
                ),
              };
            }
            return { items: [...state.items, { ...newItem, quantity: 1 }] };
          });
          recalcDiscount();
        },

        removeItem: (catalogItemId) => {
          set((state) => ({
            items: state.items.filter((i) => i.catalogItemId !== catalogItemId),
          }));
          recalcDiscount();
        },

        updateQuantity: (catalogItemId, quantity) => {
          if (quantity <= 0) {
            get().removeItem(catalogItemId);
            return;
          }
          set((state) => ({
            items: state.items.map((i) =>
              i.catalogItemId === catalogItemId ? { ...i, quantity } : i
            ),
          }));
          recalcDiscount();
        },

        clearCart: () =>
          set({
            items: [],
            appliedCoupon: null,
            discountValue: 0,
            couponError: "",
          }),

        applyCoupon: async (code: string) => {
          const trimmed = code.trim().toUpperCase();
          if (!trimmed) {
            set({ couponError: "Digite um código de cupom." });
            return;
          }

          set({ couponLoading: true, couponError: "" });

          try {
            const coupon = await getCouponByCode(trimmed);

            if (!coupon) {
              set({ couponError: "Cupom inválido ou expirado.", couponLoading: false });
              return;
            }

            const subtotal = get().getSubtotal();

            if (subtotal < coupon.min_purchase_value) {
              const minFmt = coupon.min_purchase_value.toFixed(2).replace(".", ",");
              set({
                couponError: `Este cupom exige uma compra mínima de R$ ${minFmt}.`,
                couponLoading: false,
              });
              return;
            }

            set({
              appliedCoupon: coupon,
              discountValue: calcDiscount(coupon, subtotal),
              couponError: "",
              couponLoading: false,
            });
          } catch (err) {
            console.error("Erro ao buscar cupom:", err);
            set({
              couponError: "Erro ao verificar cupom. Tente novamente.",
              couponLoading: false,
            });
          }
        },

        removeCoupon: () =>
          set({ appliedCoupon: null, discountValue: 0, couponError: "" }),
      };
    },
    {
      name: "print3d-cart",
      partialize: (state) => ({
        items: state.items,
        appliedCoupon: state.appliedCoupon,
        discountValue: state.discountValue,
      }),
    }
  )
);
