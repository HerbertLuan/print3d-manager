"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  src?: string;
  alt?: string;
}

export function BrandLogo({
  className,
  imageClassName,
  priority = false,
  src = "/evins-logo-full.png",
  alt = "EVINS Personalizados",
}: BrandLogoProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 320px, 720px"
        className={cn("object-contain", imageClassName)}
      />
    </div>
  );
}
