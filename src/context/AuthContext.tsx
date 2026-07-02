import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { storage } from '@/utils/storage';

const GUEST_KEY = 'zetto.guest';

interface AuthContextValue {
  session: Session | null;
  /** Local-only profile with no account (works without Supabase). */
  isGuest: boolean;
  /** Authenticated either via Supabase or as a local guest. */
  isAuthenticated: boolean;
  loading: boolean;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isGuest: false,
  isAuthenticated: false,
  loading: true,
  continueAsGuest: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the persisted session and guest flag on mount.
    Promise.all([supabase.auth.getSession(), storage.getItem(GUEST_KEY)]).then(
      ([{ data: { session } }, guestFlag]) => {
        setSession(session);
        setIsGuest(guestFlag === 'true');
        setLoading(false);
      },
    );

    // Keep session state in sync with Supabase auth events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const continueAsGuest = useCallback(async () => {
    await storage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
  }, []);

  const signOut = useCallback(async () => {
    await storage.removeItem(GUEST_KEY);
    setIsGuest(false);
    if (session) await supabase.auth.signOut();
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        isGuest,
        isAuthenticated: Boolean(session) || isGuest,
        loading,
        continueAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
