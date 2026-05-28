"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePartnerAuth } from "@/lib/partner-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgePercent, Loader2, AlertTriangle } from "lucide-react";

export default function PartnerLoginPage() {
  const { signIn, loading, error } = usePartnerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // error handled by context
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mx-auto">
            <BadgePercent className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portal do Parceiro</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe suas indicações e comissões
            </p>
          </div>
        </div>

        {/* Aviso de redirecionamento */}
        {reason === "partner" && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Parceiros não têm acesso ao painel administrativo. Use o Portal do Parceiro abaixo.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="partner-login-email">E-mail</Label>
            <Input
              id="partner-login-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-login-password">Senha</Label>
            <Input
              id="partner-login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || loading || !email.trim() || !password}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Acesso exclusivo para parceiros cadastrados pela EVINS.
        </p>
      </div>
    </div>
  );
}
