import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import Sidebar from "@/components/layout/Sidebar";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

export const metadata: Metadata = {
  title: "Print3D Manager — Bambu Lab A1",
  description:
    "Sistema de gerenciamento para impressão 3D personalizada — Calculadora de custos, catálogo de peças e gerenciador de pedidos.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/*
          AuthProvider envolve tudo:
          - Escuta onAuthStateChanged globalmente
          - Redireciona rotas protegidas → /login se não autenticado
          - Redireciona /login → /dashboard se já autenticado
          A Sidebar contém seu próprio useAuth() e se oculta sozinha
          quando não há usuário (ex: na página /login).
        */}
        <AuthProvider>
          <AnalyticsTracker />
          <div className="flex flex-col md:flex-row min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col min-h-screen overflow-auto">
              {children}
            </main>
          </div>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
