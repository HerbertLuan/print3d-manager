"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
}

export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3 w-full">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
              isOpen
                ? "border-white/20 bg-white/[0.06]"
                : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15"
            }`}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between px-6 py-5 text-left gap-4 group"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-white/85 group-hover:text-white transition-colors text-sm sm:text-base">
                {item.question}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-white/40 shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-180 text-orange-400" : ""
                }`}
              />
            </button>
            <div
              className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                isOpen ? "max-h-96 pb-5 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <p className="text-white/55 text-sm leading-relaxed">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
