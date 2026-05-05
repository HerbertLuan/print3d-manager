"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  BookOpen,
  ClipboardList,
  Menu,
  PackageOpen,
  Tag,
  LayoutDashboard,
  LogOut,
  Loader2,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo } from "@/components/branding/BrandLogo";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Métricas Financeiras",
  },
  {
    href: "/calculator",
    label: "Calculadora",
    icon: Calculator,
    description: "Calcule o custo",
  },
  {
    href: "/catalog",
    label: "Catálogo",
    icon: BookOpen,
    description: "Peças salvas",
  },
  {
    href: "/orders",
    label: "Pedidos",
    icon: ClipboardList,
    description: "Gerenciar pedidos ativos",
  },
  {
    href: "/inventory",
    label: "Estoque (Peças)",
    icon: PackageOpen,
    description: "Pronta entrega",
  },
  {
    href: "/supplies",
    label: "Insumos",
    icon: Tag,
    description: "Argolas, tags NFC…",
  },
  {
    href: "/dashboard/promocoes",
    label: "Promoções",
    icon: Ticket,
    description: "Cupons e brindes",
  },
];

// ─── Botão de Logout ─────────────────────────────────────────────────────────

function LogoutButton({ compact = false }: { compact?: boolean }) {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        compact && "justify-center"
      )}
    >
      {signingOut ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <LogOut className="w-4 h-4 shrink-0" />
      )}
      {!compact && <span>{signingOut ? "Saindo..." : "Sair"}</span>}
    </button>
  );
}

// ─── Nav Links ───────────────────────────────────────────────────────────────

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map(({ href, label, icon: Icon, description }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5 shrink-0 transition-transform duration-200",
                isActive ? "" : "group-hover:scale-110"
              )}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium leading-tight">{label}</span>
              <span
                className={cn(
                  "text-xs leading-tight truncate",
                  isActive
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                )}
              >
                {description}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

// ─── Logo ────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <BrandLogo
          src="/evins-symbol.png"
          alt="Icone EVINS"
          className="h-14 w-14 rounded-2xl border-white/12 bg-black/55 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
          imageClassName="object-contain"
        />
        <div>
          <h1 className="font-bold text-sm leading-tight text-foreground">
          EVINS Personalizados
          </h1>
          <p className="text-xs text-muted-foreground">Painel de operacoes 3D</p>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Principal ────────────────────────────────────────────────────────

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Rotas onde a sidebar nunca deve aparecer
  const hiddenRoutes = ["/store", "/login"];
  const isHidden = hiddenRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  // Não renderiza: rota pública OU ainda carregando auth OU sem usuário
  if (isHidden || loading || !user) return null;

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-30">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="shrink-0" />
            }
          >
            <Menu className="w-6 h-6" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <div className="p-6 border-b border-border">
              <Logo />
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="p-4 border-t border-border space-y-1">
              <LogoutButton />
              <p className="text-xs text-muted-foreground text-center pt-1">
                MVP v2.0 · Sua Loja 3D
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 min-h-screen bg-card border-r border-border flex-col shrink-0 sticky top-0">
        <div className="p-6 border-b border-border">
          <Logo />
        </div>
        <NavLinks />
        <div className="p-4 border-t border-border space-y-1">
          <LogoutButton />
          <p className="text-xs text-muted-foreground text-center pt-1">
            MVP v2.0 · Sua Loja 3D
          </p>
        </div>
      </aside>
    </>
  );
}
