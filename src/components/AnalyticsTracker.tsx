"use client";

/**
 * AnalyticsTracker — Registra page_view no GA4 a cada mudança de rota.
 *
 * ARQUITETURA ANTI-CRASH (Next.js App Router):
 * 1. `"use client"` → garante execução apenas no browser.
 * 2. `useSearchParams` exige envolver o componente em <Suspense> no ponto
 *    de uso (ou aqui mesmo) para evitar o erro de build do Next.js:
 *    "useSearchParams() should be wrapped in a suspense boundary".
 *    Resolvemos isso exportando um wrapper com <Suspense> embutido.
 * 3. O analytics é uma Promise<Analytics | null> — sempre aguardamos antes
 *    de chamar logEvent, tornando o código seguro contra SSR e ad-blockers.
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";

// ─── Componente interno (precisa de Suspense no pai) ─────────────────────────

function AnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Monta a URL completa incluindo query string (ex: /store?ref=instagram)
    const search = searchParams.toString();
    const pagePath = search ? `${pathname}?${search}` : pathname;

    // Aguarda a Promise para garantir que o Analytics está pronto
    analytics.then((a) => {
      if (!a) return; // SDK não suportado ou bloqueado
      logEvent(a, "page_view", { page_path: pagePath });
    });
  }, [pathname, searchParams]);

  // Componente puramente comportamental — não renderiza nada
  return null;
}

// ─── Export público com Suspense embutido ─────────────────────────────────────

/**
 * Injete este componente no layout raiz (ou no layout da /store).
 * O <Suspense> interno evita o erro de build do Next.js com useSearchParams.
 */
export function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTrackerInner />
    </Suspense>
  );
}
