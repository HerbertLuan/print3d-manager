import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habilita export estático para deploy no Firebase Hosting
  // Para usar com Firebase Hosting (CDN), exportamos como SPA estática.
  // Remova `output: "export"` se migrar para Firebase App Hosting (SSR).
  output: "export",

  // Desabilita o prefixo de imagem otimizada (não disponível em export estático)
  images: {
    unoptimized: true,
  },

  // Trailing slash para compatibilidade com hosting estático
  trailingSlash: true,
};

export default nextConfig;
