import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AdminInfo {
  status: "loading" | "anon" | "denied" | "admin" | "noconfig";
  uid?: string;
  email?: string;
}

export function useAdmin(): AdminInfo {
  const [state, setState] = useState<AdminInfo>({
    status: supabase ? "loading" : "noconfig",
  });

  useEffect(() => {
    if (!supabase) return;
    const check = async () => {
      const { data } = await supabase!.auth.getSession();
      const user = data.session?.user;
      if (!user) return setState({ status: "anon" });
      const { data: row } = await supabase!
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setState({
        status: row ? "admin" : "denied",
        uid: user.id,
        email: user.email,
      });
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
