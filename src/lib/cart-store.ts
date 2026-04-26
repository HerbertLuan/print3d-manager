/**
 * cart-store.ts — Estado global do carrinho com persistência em localStorage.
 * Usa Zustand com o middleware `persist`.
 *
 * NOTA DE SEGURANÇA (Firestore):
 * Como o projeto usa static export e não tem API Routes, os pedidos são gravados
 * diretamente pelo Firestore Client SDK. Configure as Security Rules assim:
 *
 *   match /orders/{orderId} {
 *     allow read: if request.auth != null;
 *     allow create: if request.resource.data.origem == "site"
 *                   && request.resource.data.production_status == "pending_approval"
 *                   && request.resource.data.keys().hasAll(["cliente_nome","cliente_telefone","cart_items","valor_total"]);
 *     allow update, delete: if request.auth != null;
 *   }
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem } from "@/lib/types";
import { useEffect, useState } from "react";

/**
 * Hook de hidratação segura para componentes que lêem o cart store.
 * Retorna `false` no primeiro render (SSR/hidratação) e `true` após
 * o cliente montar, evitando o React Error #418 causado pelo persist
 * middleware do Zustand que lê o localStorage só no browser.
 *
 * Uso:
 *   const hydrated = useCartHydrated();
 *   const count = hydrated ? totalItems() : 0;
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Derived
  cartTotal: () => number;
  totalItems: () => number;

  // Actions
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (catalogItemId: string) => void;
  updateQuantity: (catalogItemId: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      cartTotal: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),

      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.catalogItemId === newItem.catalogItemId
          );
          if (existing) {
            // Incrementa quantidade se já está no carrinho
            return {
              items: state.items.map((i) =>
                i.catalogItemId === newItem.catalogItemId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
              // ⚠️ NÃO abre o carrinho automaticamente — usuário continua navegando
            };
          }
          return { items: [...state.items, { ...newItem, quantity: 1 }] };
        });
      },

      removeItem: (catalogItemId) => {
        set((state) => ({
          items: state.items.filter((i) => i.catalogItemId !== catalogItemId),
        }));
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
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: "print3d-cart", // chave no localStorage
      // Não persiste isOpen para não reabrir o sheet após refresh
      partialize: (state) => ({ items: state.items }),
    }
  )
);
