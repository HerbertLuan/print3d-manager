"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getPartnerByEmail } from "@/lib/firestore";

// ─── Rotas públicas — não requerem autenticação ──────────────────────────────
const PUBLIC_ROUTES = ["/store", "/login", "/parceiro"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const isPublic = isPublicRoute(pathname);

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        if (!isPublic) {
          router.replace("/login");
        }
        return;
      }

      // ── Guarda: impede parceiros de acessar o painel admin ──────────────
      // Rotas /parceiro/* são públicas e gerenciadas pelo PartnerAuthProvider.
      // Se um parceiro tentar acessar uma rota admin, redirecionamos para o portal.
      if (!isPublic) {
        try {
          const partnerRecord = await getPartnerByEmail(firebaseUser.email ?? "");
          if (partnerRecord) {
            // É um parceiro — não tem acesso ao admin
            await firebaseSignOut(auth);
            setUser(null);
            setLoading(false);
            router.replace("/parceiro/login?reason=partner");
            return;
          }
        } catch {
          // Se a query falhar, deixa passar (fail open para não bloquear o admin real)
        }
      }

      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser && pathname === "/login") {
        // Já autenticado tentando acessar /login → dashboard
        router.replace("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
