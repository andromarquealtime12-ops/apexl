import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "buyer" | "seller" | "driver" | "agent";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isSeller: boolean;
  isDriver: boolean;
  isAgent: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  validateAdminCode: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (!error && data) {
      setRoles(data.map(r => r.role as AppRole));
    }
  };

  const syncEmailVerified = async (userId: string, emailConfirmedAt: string | null) => {
    if (emailConfirmedAt) {
      await supabase
        .from("profiles")
        .update({ email_verified: true, verification_code: null, verification_code_expires_at: null })
        .eq("user_id", userId)
        .eq("email_verified", false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(() => fetchUserRoles(session.user.id), 0);
          // Sync email verification status from auth to profile
          if (session.user.email_confirmed_at) {
            setTimeout(() => syncEmailVerified(session.user.id, session.user.email_confirmed_at ?? null), 100);
          }
        } else {
          setRoles([]);
        }
        
        setLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
        if (session.user.email_confirmed_at) {
          syncEmailVerified(session.user.id, session.user.email_confirmed_at ?? null);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });
    
    // Supabase returns a fake user with empty identities when email already exists
    if (!error && data?.user && data.user.identities?.length === 0) {
      return { error: new Error("Cette adresse email est déjà inscrite.") as any };
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const validateAdminCode = async (code: string): Promise<boolean> => {
    if (!user) return false;
    
    const { data, error } = await supabase.rpc("validate_admin_code", {
      code_input: code,
    } as any);
    
    if (!error && data) {
      await fetchUserRoles(user.id);
      return true;
    }
    return false;
  };

  const value = {
    user,
    session,
    loading,
    roles,
    isAdmin: roles.includes("admin"),
    isSeller: roles.includes("seller"),
    isDriver: roles.includes("driver"),
    isAgent: roles.includes("agent"),
    signUp,
    signIn,
    signOut,
    validateAdminCode
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
