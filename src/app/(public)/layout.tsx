// Layout público — sem Sidebar admin.
// Todas as rotas dentro de (public)/ usam este layout limpo.
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Print3D Design — Catálogo de Peças em Impressão 3D",
  description:
    "Chaveiros NFC, miniaturas e peças personalizadas em impressão 3D de alta qualidade. Feito sob medida, entregue com cuidado.",
  openGraph: {
    title: "Print3D Design — Vitrine",
    description: "Peças exclusivas em impressão 3D. Personalize o seu agora.",
    type: "website",
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark scroll-smooth">
      <body
        className={`${geistSans.variable} antialiased bg-[#050507] text-slate-50 min-h-screen overflow-x-hidden`}
      >
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              success:
                "!bg-emerald-950 !border-emerald-500/30 !text-emerald-300",
            },
          }}
        />
      </body>
    </html>
  );
}
