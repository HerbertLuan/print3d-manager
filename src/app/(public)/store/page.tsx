"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { getStoreItems } from "@/lib/firestore";
import { CatalogItem } from "@/lib/types";
import { formatBRL } from "@/lib/calculations";
import { Accordion } from "@/components/ui/accordion";
import { useCartStore, useCartHydrated } from "@/lib/cart-store";
import { CartSheet, CartFab } from "./components/CartSheet";
import { toast } from "sonner";
import {
  Printer,
  ChevronRight,
  Wifi,
  Zap,
  ShieldCheck,
  Package,
  ArrowDown,
  MessageCircle,
  Star,
  Sparkles,
  ShoppingBag,
} from "lucide-react";

// ─── Configuração (editável) ────────────────────────────────────────────────

const WHATSAPP_NUMBER = "5561985592709";
const BRAND_NAME = "Print3D Design";

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
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-cyan-400",
    borderColor: "border-cyan-500/20",
  },
  {
    icon: Zap,
    title: "Fabricação Rápida",
    description:
      "Produção ágil com impressoras Bambu Lab de última geração. Peças prontas em horas, não em dias.",
    color: "from-orange-500/20 to-amber-500/20",
    iconColor: "text-orange-400",
    borderColor: "border-orange-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Qualidade Premium",
    description:
      "Materiais certificados PLA e PETG com acabamento profissional. Cada peça é inspecionada antes do envio.",
    color: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/20",
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

function buildWhatsappUrl(productName: string): string {
  const message = encodeURIComponent(
    `Olá! Gostei do *${productName}* que vi na loja e queria saber mais.`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

function buildGenericWhatsappUrl(): string {
  const message = encodeURIComponent(
    `Olá! Vim pelo catálogo online e gostaria de saber mais sobre as peças disponíveis.`
  );
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Navbar() {
  const { openCart, totalItems } = useCartStore();
  const hydrated = useCartHydrated();
  // Durante SSR e 1ª renderização do cliente, força count=0
  // para evitar mismatch com o HTML gerado pelo servidor.
  const count = hydrated ? totalItems() : 0;

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-black/50 backdrop-blur-2xl border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.35)]">
            <Printer className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-white/90">
            {BRAND_NAME}
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
            onClick={openCart}
            aria-label="Abrir carrinho"
            className="relative flex items-center gap-2 h-9 px-4 rounded-full border border-white/15 text-white/60 text-sm hover:bg-white/5 hover:text-white hover:border-white/30 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Carrinho</span>
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-orange-500 text-white text-[9px] font-extrabold flex items-center justify-center">
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
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-br from-orange-500/15 via-rose-500/10 to-purple-600/15 blur-[140px] rounded-full" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full" />
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
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5 text-xs text-white/60 font-medium tracking-widest uppercase mb-8 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          {HERO.badge}
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            {HERO.headline.split("\n")[0]}
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-rose-400 to-pink-500">
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
            className="group h-14 px-8 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_0_30px_rgba(249,115,22,0.3)] flex items-center gap-2"
          >
            {HERO.cta}
            <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-1" />
          </button>
          <a
            href={buildGenericWhatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="h-14 px-8 rounded-full border border-white/15 text-white/70 font-medium text-sm hover:bg-white/5 hover:text-white hover:border-white/30 transition-all duration-200 flex items-center gap-2"
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

// ─── Card de Produto ──────────────────────────────────────────────────────────

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

  // Preço efetivo: preco_venda_loja tem prioridade; fallback para calculated_price
  const effectivePrice =
    item.preco_venda_loja && item.preco_venda_loja > 0
      ? item.preco_venda_loja
      : item.calculated_price;

  // Âncora de preço: multiplicador de 1.35 → simula 35% de desconto
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

    // Feedback visual discreto no botão
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);

    // Toast silencioso — não interrompe a navegação
    toast.success(`${displayName} adicionado à sacola!`, {
      duration: 2500,
      position: "bottom-right",
    });
  }

  return (
    <article className="group relative flex flex-col bg-white/[0.025] border border-white/[0.07] hover:border-white/20 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(249,115,22,0.07)]">
      {/* Destaque badge */}
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
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Package className="w-16 h-16 text-white/10" />
            <span className="text-xs text-white/20">Sem foto</span>
          </div>
        )}

        {/* Multi-color badge */}
        {isMultiColor && (
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-blue-500" />
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Multi-Color</span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-6">
        {/* Material tag */}
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-2">
          {primaryMaterial}
        </span>

        {/* Nome */}
        <h3 className="text-lg font-semibold text-white/90 group-hover:text-white transition-colors leading-snug mb-2">
          {displayName}
        </h3>

        {/* Descrição */}
        {description && (
          <p className="text-sm text-white/45 leading-relaxed mb-4 line-clamp-2">
            {description}
          </p>
        )}

        {/* ── Preço + CTA ─────────────────────────────────────────── */}
        <div className="mt-auto pt-5 border-t border-white/[0.07] flex items-center justify-between gap-4">

          {isDestaque ? (
            /* ── Ancoragem de Preço (apenas em itens Destaque) ── */
            <div className="flex flex-col gap-0.5">
              {/* Falso preço antigo (âncora) */}
              <p className="text-xs text-white/30 line-through tabular-nums leading-none">
                De: {formatBRL(fakeOriginalPrice)}
              </p>
              {/* Preço real em destaque cromático verde-esmeralda */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                  Por apenas
                </span>
                <span className="text-2xl font-bold text-emerald-400 tabular-nums drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]">
                  {formatBRL(effectivePrice)}
                </span>
              </div>
              {/* Badge de economia */}
              <span className="inline-flex w-fit items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5">
                Economia de {formatBRL(fakeOriginalPrice - effectivePrice)}
              </span>
            </div>
          ) : (
            /* ── Preço limpo (itens sem destaque) ── */
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-0.5">
                a partir de
              </p>
              <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tabular-nums">
                {formatBRL(effectivePrice)}
              </p>
            </div>
          )}

          {/* Botão Adicionar ao Carrinho */}
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


function ProductSkeleton() {
  return (
    <div className="flex flex-col bg-white/[0.02] border border-white/[0.05] rounded-3xl overflow-hidden">
      <div className="w-full aspect-[4/3] bg-white/5 animate-pulse" />
      <div className="p-6 space-y-3">
        <div className="h-3 w-16 bg-white/5 rounded-full animate-pulse" />
        <div className="h-5 w-3/4 bg-white/8 rounded-full animate-pulse" />
        <div className="h-4 w-full bg-white/5 rounded-full animate-pulse" />
        <div className="h-4 w-2/3 bg-white/5 rounded-full animate-pulse" />
        <div className="h-px bg-white/5 my-2" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-7 w-24 bg-white/8 rounded-full animate-pulse" />
          <div className="h-12 w-32 bg-white/5 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function StoreCatalog({ catalogRef }: { catalogRef: React.RefObject<HTMLElement | null> }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getStoreItems()
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section ref={catalogRef} id="catalogo" className="py-20 px-5 sm:px-8 max-w-7xl mx-auto">
      {/* Section header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-widest mb-4">
          <Sparkles className="w-4 h-4" />
          Vitrine
          <Sparkles className="w-4 h-4" />
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Escolha o seu favorito
        </h2>
        <p className="text-white/40 max-w-md mx-auto text-base">
          Cada peça é fabricada por encomenda com atenção aos detalhes.
        </p>
      </div>

      {/* Grid */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-20 text-white/30">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Não foi possível carregar o catálogo. Tente novamente em instantes.</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
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
            className="inline-flex items-center gap-2 mt-6 h-12 px-6 rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            Fazer encomenda
          </a>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} />
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
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-rose-500/15 to-purple-600/20" />
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
            className="shrink-0 h-14 px-8 rounded-full bg-white text-black font-bold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xl"
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
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
          <Printer className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-white/50">{BRAND_NAME}</span>
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
