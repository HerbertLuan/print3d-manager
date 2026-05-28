"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getPartnerByEmail } from "@/lib/firestore";
import { Partner } from "@/lib/types";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PartnerAuthContextValue {
  user: User | null;
  partner: Partner | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const PartnerAuthContext = createContext<PartnerAuthContextValue>({
  user: null,
  partner: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function usePartnerAuth() {
  return useContext(PartnerAuthContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function PartnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setPartner(null);
    router.push("/parceiro/login");
  }, [router]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Verificar se o e-mail está cadastrado como parceiro ativo
      const partnerData = await getPartnerByEmail(credential.user.email ?? "");
      if (!partnerData) {
        await firebaseSignOut(auth);
        throw new Error("Acesso não autorizado. Este e-mail não está cadastrado como parceiro ativo.");
      }
      setPartner(partnerData);
      router.push("/parceiro/dashboard");
    } catch (err: any) {
      const msg =
        err.message?.includes("parceiro")
          ? err.message
          : err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
          ? "E-mail ou senha incorretos."
          : err.code === "auth/user-not-found"
          ? "Nenhuma conta encontrada com este e-mail."
          : err.code === "auth/too-many-requests"
          ? "Muitas tentativas. Tente novamente mais tarde."
          : "Erro ao fazer login. Verifique suas credenciais.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser && pathname.startsWith("/parceiro")) {
        // Carrega dados do parceiro se ainda não carregado
        if (!partner) {
          try {
            const partnerData = await getPartnerByEmail(firebaseUser.email ?? "");
            if (partnerData) {
              setPartner(partnerData);
            } else {
              // Usuário logado mas não é parceiro — redireciona para o login
              await firebaseSignOut(auth);
              router.push("/parceiro/login");
            }
          } catch {
            // silently fail
          }
        }
      }

      // Se não autenticado e tentando acessar o dashboard do parceiro
      if (!firebaseUser && pathname === "/parceiro/dashboard") {
        router.replace("/parceiro/login");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router]);

  return (
    <PartnerAuthContext.Provider value={{ user, partner, loading, error, signIn, signOut }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}
