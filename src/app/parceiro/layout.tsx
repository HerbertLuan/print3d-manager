import type { Metadata } from "next";
import { PartnerAuthProvider } from "@/lib/partner-auth-context";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Portal do Parceiro — EVINS",
  description: "Acompanhe suas indicações e comissões em tempo real.",
};

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PartnerAuthProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {children}
      </div>
      <Toaster richColors position="top-right" />
    </PartnerAuthProvider>
  );
}
