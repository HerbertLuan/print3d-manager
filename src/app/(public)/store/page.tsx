"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Image from "next/image";
import { getStoreItems, getActiveCollections } from "@/lib/firestore";
import { CatalogItem, Collection } from "@/lib/types";
import { Accordion } from "@/components/ui/accordion";
import { useCartHydrated, useCartStore } from "@/lib/cart-store";
import { CartSheet, CartFab } from "./components/CartSheet";
import { ExpandableCategory, CategoryGroup } from "./components/ExpandableCategory";
import {
  ChevronRight,
  Wifi,
  Zap,
  ShieldCheck,
  Package,
  ArrowDown,
  MessageCircle,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase";

// ─── Configuração (editável) ────────────────────────────────────────────────

const WHATSAPP_NUMBER = "5561985592709";
const BRAND_NAME = "EVINS Personalizados";

const HERO = {
  badge: "✦ Impressão 3D sob medida",
  headline: "Peças únicas que\ncabem na sua vida.",
  subheadline:
    "Chaveiros NFC, miniaturas e acessórios personalizados feitos com alta precisão. Escolha o seu favorito e receba com cuidado.",
  cta: "Ver Catálogo",
};

const PILLARS = [
  {
    icon: Wifi,
    title: "Tecnologia NFC",
    description:
      "Nossos chaveiros com chip NFC permitem compartilhar contato, redes sociais ou links com um simples toque.",
    color: "from-primary/20 to-secondary/20",
    iconColor: "text-primary",
    borderColor: "border-primary/20",
  },
  {
    icon: Zap,
    title: "Fabricação Rápida",
    description:
      "Produção ágil com impressoras Bambu Lab de última geração. Peças prontas em horas, não em dias.",
    color: "from-secondary/20 to-primary/10",
    iconColor: "text-secondary",
    borderColor: "border-secondary/20",
  },
  {
    icon: ShieldCheck,
    title: "Qualidade Premium",
    description:
      "Materiais certificados PLA e PETG com acabamento profissional. Cada peça é inspecionada antes do envio.",
    color: "from-yellow-400/14 to-primary/14",
    iconColor: "text-yellow-300",
    borderColor: "border-yellow-400/20",
  },
];

const FAQ_ITEMS = [
  {
    question: "O chip NFC funciona em iPhones?",
    answer:
      "Sim! Os chaverios NFC são compatíveis com iPhones 7 ou superior (iOS 13+) e com qualquer Android com NFC ativado. Não é necessário instalar nenhum aplicativo.",
  },
  {
    question: "O material é resistente? Pode molhar?",
    answer:
      "Usamos PLA+ e PETG de alta qualidade que são resistentes ao uso cotidiano. Evite imersão prolongada em água e temperaturas acima de 60°C (como deixar dentro de um carro no verão).",
  },
  {
    question: "Qual o prazo de fabricação e entrega?",
    answer:
      "A fabricação leva entre 24h e 72h dependendo da peça. A entrega é combinada via WhatsApp — fazemos envio por Correios ou entrega pessoal na região do DF.",
  },
  {
    question: "Posso personalizar cores e textos?",
    answer:
      "Sim! Entre em contato via WhatsApp antes de fazer seu pedido e combinamos todas as personalizações. Trabalhamos com uma ampla paleta de filamentos.",
  },
  {
    question: "Como funciona o pagamento?",
    answer:
      "Aceitamos Pix, transferência bancária e dinheiro. Combinamos tudo pelo WhatsApp após você demonstrar interesse em um produto.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGenericWhatsappUrl(): string {
  const message = encodeURIComponent(
    `Olá! Vim pelo catálogo online e gostaria de saber mais sobre as peças disponíveis.`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Navbar() {
  const { openCart, totalItems, cartTotal } = useCartStore();
  const hydrated = useCartHydrated();
  // Durante SSR e 1ª renderização do cliente, força count=0
  // para evitar mismatch com o HTML gerado pelo servidor.
  const count = hydrated ? totalItems() : 0;

  function handleOpenCart() {
    // 📊 GA4: begin_checkout — dispara apenas quando há itens no carrinho
    if (hydrated && totalItems() > 0) {
      analytics.then((a) => {
        if (!a) return;
        logEvent(a, "begin_checkout", {
          currency: "BRL",
          value: cartTotal(),
        });
      });
    }
    openCart();
  }

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-black/50 backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="evins-glass-panel relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl">
            <div className="evins-logo-halo absolute inset-1 opacity-90" />
            <Image
              src="/evins-symbol-raw.png"
              alt="Ícone EVINS"
              fill
              priority
              sizes="40px"
              className="relative z-10 object-contain p-1.5"
            />
          </div>
          <span className="hidden text-sm font-semibold tracking-[0.24em] text-white/82 sm:inline-block">
            EVINS
          </span>
        </div>

        {/* Nav direita */}
        <div className="flex items-center gap-4">
          <a
            href={buildGenericWhatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Fale Conosco
            <ChevronRight className="w-3 h-3" />
          </a>

          {/* Botão carrinho na navbar */}
          <button
            onClick={handleOpenCart}
            aria-label="Abrir carrinho"
            className="relative flex items-center gap-2 h-9 px-4 rounded-full border border-white/15 bg-white/[0.02] text-white/60 text-sm hover:bg-white/5 hover:text-white hover:border-primary/40 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-r from-primary to-secondary text-[9px] font-extrabold text-white shadow-[0_0_12px_rgba(37,99,235,0.35)]">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({ catalogRef }: { catalogRef: React.RefObject<HTMLElement | null> }) {
  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-16 px-5 sm:px-8 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary/18 via-secondary/12 to-yellow-400/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-secondary/14 blur-[100px]" />
      </div>

      {/* Grid overlay pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
        <div className="mb-6 flex w-full justify-center sm:mb-8">
          {/* Logo flutuando livremente — sem caixa, sem borda */}
          <div className="relative flex items-center justify-center">

            {/* Sparkles orgânicos */}
            <span aria-hidden="true" className="evins-sparkle pointer-events-none absolute z-20 rounded-full bg-[#2563EB]" style={{width:5,height:5,top:'-14%',left:'8%',animationDelay:'0s'}} />
            <span aria-hidden="true" className="evins-sparkle pointer-events-none absolute z-20 rounded-full bg-[#7C3AED]" style={{width:4,height:4,top:'5%',right:'6%',animationDelay:'1.1s'}} />
            <span aria-hidden="true" className="evins-sparkle pointer-events-none absolute z-20 rounded-full bg-[#8B5CF6]" style={{width:3,height:3,bottom:'-10%',left:'18%',animationDelay:'2.4s'}} />
            <span aria-hidden="true" className="evins-sparkle pointer-events-none absolute z-20 rounded-full bg-white/70" style={{width:3,height:3,top:'-8%',left:'48%',animationDelay:'0.7s'}} />
            <span aria-hidden="true" className="evins-sparkle pointer-events-none absolute z-20 rounded-full bg-[#2563EB]" style={{width:4,height:4,bottom:'-8%',right:'14%',animationDelay:'1.9s'}} />
            <span aria-hidden="true" className="evins-sparkle pointer-events-none absolute z-20 rounded-full bg-[#7C3AED]" style={{width:3,height:3,top:'30%',left:'-4%',animationDelay:'3.1s'}} />

            {/* A logo em si — PNG com alpha transparente, sem mix-blend-mode */}
            <img
              src="/evins-logo-hero.png"
              alt="EVINS Personalizados"
              className="evins-hero-logo relative z-10 w-[270px] sm:w-[390px] lg:w-[490px] xl:w-[550px]"
              draggable="false"
            />
          </div>
        </div>

        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-white/60 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300" />
          {HERO.badge}
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            {HERO.headline.split("\n")[0]}
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-yellow-300">
            {HERO.headline.split("\n")[1]}
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-white/45 max-w-2xl font-light leading-relaxed mb-10">
          {HERO.subheadline}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={scrollToCatalog}
            className="evins-gradient-button group flex h-14 items-center gap-2 rounded-full px-8 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98]"
          >
            {HERO.cta}
            <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-1" />
          </button>
          <a
            href={buildGenericWhatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center gap-2 rounded-full border border-white/15 px-8 text-sm font-medium text-white/70 transition-all duration-200 hover:border-secondary/40 hover:bg-white/5 hover:text-white"
          >
            <MessageCircle className="w-4 h-4" />
            Falar pelo WhatsApp
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
        <span className="text-[10px] uppercase tracking-widest">Role para ver</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/20 to-transparent" />
      </div>
    </section>
  );
}

function ValuePillars() {
  return (
    <section className="py-20 px-5 sm:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className={`relative rounded-3xl border ${p.borderColor} bg-gradient-to-br ${p.color} p-7 backdrop-blur-sm overflow-hidden group hover:scale-[1.02] transition-transform duration-300`}
            >
              <div className="absolute inset-0 bg-black/40 rounded-3xl" />
              <div className="relative z-10">
                <div className={`w-11 h-11 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center mb-5`}>
                  <Icon className={`w-5 h-5 ${p.iconColor}`} />
                </div>
                <h3 className="font-semibold text-white text-base mb-2">{p.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{p.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}



function CategorySkeleton() {
  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/5 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-5 w-36 bg-white/8 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-white/5 rounded-full animate-pulse" />
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-[0_0_72%] sm:flex-[0_0_40%] lg:flex-[0_0_28%] aspect-[3/4] rounded-2xl bg-white/5 animate-pulse shrink-0"
          />
        ))}
      </div>
      <div className="h-px bg-white/[0.05]" />
    </div>
  );
}

function StoreCatalog({ catalogRef }: { catalogRef: React.RefObject<HTMLElement | null> }) {
  const [allItems, setAllItems] = useState<CatalogItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Cargas independentes: coleções que falham não bloqueiam os produtos
    getStoreItems()
      .then(setAllItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    getActiveCollections()
      .then(setCollections)
      .catch((err) =>
        console.warn("Collections not loaded:", err)
      );
  }, []);

  // Agrupa produtos por coleção (coleções em destaque primeiro, depois por ordem)
  const groups = useMemo((): CategoryGroup[] => {
    const sortedCols = [...collections].sort((a, b) =>
      a.em_destaque === b.em_destaque ? a.ordem - b.ordem : a.em_destaque ? -1 : 1
    );

    const result: CategoryGroup[] = sortedCols
      .map((col) => ({
        collection: col,
        items: allItems.filter((i) => i.collectionId === col.id),
      }))
      .filter((g) => g.items.length > 0); // omite coleções sem produtos na loja

    // Grupo "Geral" para itens sem coleção (ao final)
    const generalItems = allItems.filter(
      (i) => !i.collectionId || !collections.find((c) => c.id === i.collectionId)
    );
    if (generalItems.length > 0) {
      result.push({ collection: null, items: generalItems });
    }

    return result;
  }, [allItems, collections]);

  return (
    <section ref={catalogRef} id="catalogo" className="py-20 px-5 sm:px-8 max-w-7xl mx-auto">
      {/* Cabeçalho da seção */}
      <div className="text-center mb-14">
        <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <Sparkles className="w-4 h-4" />
          Vitrine
          <Sparkles className="w-4 h-4" />
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Nossas Coleções
        </h2>
        <p className="text-white/40 max-w-md mx-auto text-base">
          Clique em uma coleção para ver todos os produtos. Cada peça é feita por encomenda.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          <CategorySkeleton />
          <CategorySkeleton />
        </div>
      )}

      {/* Erro */}
      {!loading && error && (
        <div className="text-center py-20 text-white/30">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Não foi possível carregar o catálogo. Tente novamente em instantes.</p>
        </div>
      )}

      {/* Catálogo vazio */}
      {!loading && !error && allItems.length === 0 && (
        <div className="text-center py-24 text-white/30">
          <Package className="w-16 h-16 mx-auto mb-6 opacity-20" />
          <h3 className="text-xl font-semibold mb-2">Em breve!</h3>
          <p className="text-sm max-w-xs mx-auto">
            Novos produtos chegando. Entre em contato para encomendas personalizadas.
          </p>
          <a
            href={buildGenericWhatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 text-sm font-medium text-white/70 transition-all hover:border-primary/35 hover:bg-white/10 hover:text-white"
          >
            <MessageCircle className="w-4 h-4" />
            Fazer encomenda
          </a>
        </div>
      )}

      {/* Grupos de coleção */}
      {!loading && !error && groups.length > 0 && (
        <div className="space-y-2">
          {groups.map((group) => (
            <ExpandableCategory
              key={group.collection?.id ?? "__general__"}
              group={group}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FaqSection() {

  return (
    <section className="py-20 px-5 sm:px-8 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Perguntas Frequentes
        </h2>
        <p className="text-white/40 text-sm">
          Tire suas dúvidas antes de fazer seu pedido.
        </p>
      </div>
      <Accordion items={FAQ_ITEMS} />
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="py-16 px-5 sm:px-8">
      <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/18 via-secondary/14 to-yellow-400/12" />
        <div className="absolute inset-0 backdrop-blur-sm border border-white/10 rounded-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 p-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Não encontrou o que procura?
            </h2>
            <p className="text-white/50 text-sm">
              Fazemos peças totalmente personalizadas. Mande uma mensagem!
            </p>
          </div>
          <a
            href={buildGenericWhatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="evins-gradient-button flex h-14 shrink-0 items-center gap-2 rounded-full px-8 text-sm font-bold text-white transition-all active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4" />
            Chamar no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12 px-5 text-center">
      <div className="mb-4 flex justify-center">
        <div className="relative h-16 w-52">
          <Image
            src="/evins-wordmark-transparent.png"
            alt="EVINS Personalizados"
            fill
            sizes="208px"
            className="object-contain"
          />
        </div>
      </div>
      <p className="text-xs text-white/20">
        © {new Date().getFullYear()} {BRAND_NAME}. Todos os direitos reservados.
      </p>
    </footer>
  );
}

// ─── Page Principal ────────────────────────────────────────────────────────────

export default function StorePage() {
  const catalogRef = useRef<HTMLElement>(null);

  return (
    <div className="w-full min-h-screen selection:bg-orange-500/30 selection:text-white">
      <Navbar />
      <HeroSection catalogRef={catalogRef} />
      <ValuePillars />
      <StoreCatalog catalogRef={catalogRef} />
      <FaqSection />
      <CtaBanner />
      <Footer />

      {/* Carrinho */}
      <CartSheet />
      <CartFab />
    </div>
  );
}
