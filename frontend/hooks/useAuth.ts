"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email,
              displayName: session.user.user_metadata?.display_name,
            }
          : null
      );
      setLoading(false);
    });

    // Initial fetch
    supabase.auth.getSession().then(({ data }) => {
      setUser(
        data.session?.user
          ? {
              id: data.session.user.id,
              email: data.session.user.email,
              displayName: data.session.user.user_metadata?.display_name,
            }
          : null
      );
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, signOut };
}


