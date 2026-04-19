"use client";

import { useEffect, useState } from "react";
import { getCatalogItems } from "@/lib/firestore";
import { CatalogItem } from "@/lib/types";
import { formatBRL, formatTime } from "@/lib/calculations";
import { ShoppingBag, ChevronRight, Package, Clock, ShieldCheck, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StorefrontPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      try {
        const data = await getCatalogItems();
        // Filtrar ou ordenar se necessário, ex: apenas itens com imagem
        setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, []);

  const whatsappNumber = "5561985592709";

  return (
    <div className="bg-[#000000] min-h-screen text-slate-50 w-full overflow-x-hidden selection:bg-primary/30">
      
      {/* ── Navbar Premium ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-rose-500 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.3)]">
               <Printer className="w-4 h-4 text-white" />
             </div>
             <span className="font-semibold tracking-wide text-sm">Print3D Design</span>
          </div>
          <a href={`https://wa.me/${whatsappNumber}?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20as%20impressões%203D!`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-white/50 hover:text-white transition-colors cursor-pointer flex items-center gap-1">
            Fale Conosco <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-20 px-6 sm:px-12 flex flex-col items-center justify-center min-h-[55vh] overflow-hidden">
         {/* Background Glows */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-orange-500/20 via-rose-500/10 to-purple-500/20 blur-[120px] rounded-full pointer-events-none" />
         
         <Badge className="bg-white/5 text-white/70 hover:bg-white/10 border-white/10 mb-8 backdrop-blur-md px-4 py-1.5 font-normal tracking-wide text-xs uppercase">
            Peças exclusivas. Sob medida.
         </Badge>
         
         <h1 className="text-5xl md:text-7xl font-bold text-center tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 max-w-4xl leading-[1.1]">
           Projetos que ganham <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-500">forma na sua mão.</span>
         </h1>
         <p className="text-center text-lg text-white/50 max-w-2xl font-light mb-10">
           Catálogo completo das nossas peças premium disponíveis para fabricação imediata via impressão 3D avançada.
         </p>
      </section>

      {/* ── Catalog Grid ── */}
      <main className="max-w-7xl mx-auto px-6 pb-32">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-96 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item) => {
              const whatsappMessage = encodeURIComponent(
                `Olá! Tenho interesse na peça *${item.name}*. Gostaria de fazer o meu pedido.`
              );

               // Main material info
               const requiredFilaments = item.required_filaments || [{ material: item.material || "PLA", weight_grams: item.weight_grams || 0 }];
               const isMultiColor = requiredFilaments.length > 1;

              return (
                <div key={item.id} className="group flex flex-col bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.04] transition-all duration-300 rounded-3xl overflow-hidden shadow-2xl relative">
                  
                  {/* Image wrapper */}
                  <div className="relative w-full aspect-[4/3] bg-white/[0.02] overflow-hidden flex items-center justify-center">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-white/10" />
                    )}
                    
                    {/* Badge Multicolor */}
                    {isMultiColor && (
                       <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                          <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500" />
                          <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">Multi-Color</span>
                       </div>
                    )}
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-xl font-semibold mb-2 text-white/90 group-hover:text-white transition-colors">{item.name}</h3>
                    
                    {/* Tech details */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-start gap-2">
                        <Clock className="w-4 h-4 text-white/40 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-white/40">Tempo Fab.</p>
                          <p className="text-sm text-white/70 font-medium">{formatTime(item.time_minutes)}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-white/40 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-white/40">Acabamento</p>
                          <p className="text-sm text-white/70 font-medium">{requiredFilaments[0].material}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Investimento Base</span>
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tabular-nums">
                           {formatBRL(item.calculated_price)}
                        </span>
                      </div>
                      
                      <a 
                        href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-12 px-6 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 group/btn"
                      >
                        Pedir <ShoppingBag className="w-4 h-4 transition-transform group-hover/btn:-translate-y-0.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-white/30 text-sm">
         <p>© 2024 Print3D Design. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
