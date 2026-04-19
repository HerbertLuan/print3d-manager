"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, BookOpen, ClipboardList, Printer, Menu, PackageOpen, Tag, Receipt, Database, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
    href: "/filaments",
    label: "Filamentos",
    icon: Database,
    description: "Gestão Físicas das bobinas",
  },
  {
    href: "/supplies",
    label: "Insumos",
    icon: Tag,
    description: "Argolas, tags NFC…",
  },
  {
    href: "/expenses",
    label: "Despesas",
    icon: Receipt,
    description: "Custos operacionais",
  },
];

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
              <span className="text-sm font-medium leading-tight">
                {label}
              </span>
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

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shrink-0">
        <Printer className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <h1 className="font-bold text-sm leading-tight text-foreground">
          Print3D Manager
        </h1>
        <p className="text-xs text-muted-foreground">Bambu Lab A1</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/store")) return null;

  return (
    <>
      {/* Mobile Top Header (hidden on md and up) */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-30">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="shrink-0" />}>
            <Menu className="w-6 h-6" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <div className="p-6 border-b border-border">
              <Logo />
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                MVP v2.0 · Sua Loja 3D
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex w-64 min-h-screen bg-card border-r border-border flex-col shrink-0 sticky top-0">
        <div className="p-6 border-b border-border">
          <Logo />
        </div>
        <NavLinks />
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            MVP v2.0 · Sua Loja 3D
          </p>
        </div>
      </aside>
    </>
  );
}
