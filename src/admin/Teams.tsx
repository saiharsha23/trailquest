import {useEffect,useState} from "react";import {supabase as sb} from "../lib/supabase";import {Btn,Card,Err,Field} from "./ui";
interface T{id:string;name:string;color:string;player_count:number}
export default function Teams(){const [teams,setT]=useState<T[]>([]);const [err,setErr]=useState("");const [codes,setCodes]=useState<Record<string,string>>({});const [eventId,setEv]=useState<string|null>(null);
 const load=async()=>{const {data,error}=await sb!.from("teams").select("id,name,color,player_count").order("created_at");if(error)setErr(error.message);else setT(data as T[]);
  const e=await sb!.from("events").select("id").limit(1).maybeSingle();setEv(e.data?.id??null)};
 useEffect(()=>{load()},[]);
 const upd=(id:string,p:Partial<T>)=>setT(ts=>ts.map(t=>t.id===id?{...t,...p}:t));
 const save=async(t:T)=>{const {error}=await sb!.from("teams").update({name:t.name,color:t.color,player_count:t.player_count}).eq("id",t.id);setErr(error?.message??"")};
 const rotate=async(id:string)=>{const {data,error}=await sb!.rpc("rotate_join_code",{p_team:id});if(error)setErr(error.message);else setCodes(c=>({...c,[id]:data}))};
 const seed=async()=>{const {error}=await sb!.rpc("seed_event",{p_name:"Hostel Treasure Hunt"});setErr(error?.message??"");load()};
 return <div className="grid gap-5 max-w-4xl"><h1 className="font-serif text-3xl">Team Management</h1><Err msg={err}/>
 {!eventId&&<Card><p className="text-muted mb-3">No event yet. Create one with four teams (9, 9, 10, 10 players) and eight editable stations.</p><Btn onClick={seed}>Create starter event</Btn></Card>}
 {teams.map(t=><Card key={t.id}><div className="grid sm:grid-cols-3 gap-3"><Field label="Team name" value={t.name} onChange={e=>upd(t.id,{name:e.target.value})}/>
 <Field label="Colour" type="color" value={t.color} onChange={e=>upd(t.id,{color:e.target.value})}/><Field label="Players" type="number" min={0} value={t.player_count} onChange={e=>upd(t.id,{player_count:+e.target.value})}/></div>
 <div className="flex gap-3 mt-4 flex-wrap items-center"><Btn onClick={()=>save(t)}>Save team</Btn><Btn kind="secondary" onClick={()=>rotate(t.id)}>New join code</Btn>
 {codes[t.id]&&<span className="font-mono bg-gold px-3 py-1 rounded-full">{codes[t.id]}</span>}</div>
 {codes[t.id]&&<p className="text-xs text-muted mt-2">Shown once. Only a hash is stored; generating a new code revokes the old one.</p>}</Card>)}</div>}
