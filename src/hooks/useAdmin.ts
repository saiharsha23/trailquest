import {useEffect,useState} from "react";import {supabase} from "../lib/supabase";
export type AdminState="loading"|"anon"|"denied"|"admin"|"noconfig";
export function useAdmin(){const [state,set]=useState<AdminState>(supabase?"loading":"noconfig");
 useEffect(()=>{if(!supabase)return;const check=async()=>{const {data}=await supabase!.auth.getSession();const uid=data.session?.user.id;
  if(!uid)return set("anon");const {data:row}=await supabase!.from("admins").select("user_id").eq("user_id",uid).maybeSingle();set(row?"admin":"denied")};
  check();const {data:sub}=supabase.auth.onAuthStateChange(()=>{check()});return()=>sub.subscription.unsubscribe()},[]);
 return state}
