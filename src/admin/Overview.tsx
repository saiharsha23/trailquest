import {useEffect,useState} from "react";import {supabase as sb} from "../lib/supabase";import {Card,Err} from "./ui";
export default function Overview(){const [d,setD]=useState<any>(null);const [err,setErr]=useState("");
 useEffect(()=>{(async()=>{const [t,s,r,p,e]=await Promise.all([sb!.from("teams").select("id,name,color,player_count").order("created_at"),sb!.from("stations").select("id",{count:"exact",head:true}).eq("active",true),
  sb!.from("team_routes").select("team_id,checkpoint_order,stations(name)").order("checkpoint_order"),sb!.from("team_progress").select("*"),sb!.from("events").select("name,status").limit(1).maybeSingle()]);
  const bad=t.error??s.error??r.error??p.error??e.error;if(bad)return setErr(bad.message);setD({teams:t.data??[],stations:s.count??0,routes:r.data??[],prog:p.data??[],ev:e.data})})()},[]);
 if(err)return <Card><h1 className="font-serif text-2xl">Can't reach the database</h1><p className="text-bad mt-2">{err}</p><p className="text-muted mt-2">Check your .env values and that migrations 0001–0005 are applied.</p></Card>;
 if(!d)return <p className="text-muted">Loading…</p>;
 const started=d.prog.filter((p:any)=>p.scanned_order||p.completed_order).length,done=d.prog.reduce((n:number,p:any)=>n+p.completed_order,0),fin=d.prog.filter((p:any)=>p.finished_at).length;
 const stats=[["Teams",d.teams.length],["Active stations",d.stations],["Checkpoints",d.routes.length],["Teams started",started],["Checkpoints completed",done],["Teams finished",fin],["Game status",d.ev?.status??"no event"]];
 return <div className="grid gap-5 max-w-5xl"><h1 className="font-serif text-3xl">{d.ev?.name??"Overview"}</h1>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{stats.map(([l,v])=><Card key={l as string}><p className="text-sm text-muted">{l}</p><p className="font-serif text-3xl mt-1">{v}</p></Card>)}</div>
 <div className="grid sm:grid-cols-2 gap-4">{d.teams.map((t:any)=>{const p=d.prog.find((x:any)=>x.team_id===t.id);const mine=d.routes.filter((x:any)=>x.team_id===t.id);const c=p?.completed_order??0;
 const cur=mine.find((x:any)=>x.checkpoint_order===(p?.scanned_order>c?p.scanned_order:c+1));const st=p?.finished_at?"Finished":p?.scanned_order||c?"In progress":"Not started";
 return <Card key={t.id}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-ink" style={{background:t.color}} aria-hidden/><h2 className="font-serif text-xl">{t.name}</h2><span className="ml-auto text-sm">{st}</span></div>
 <p className="text-sm text-muted mt-1">{t.player_count} players · last activity {p?.last_activity?new Date(p.last_activity).toLocaleTimeString():"—"}</p>
 <div className="flex justify-between text-sm mt-3"><span>{c}/{mine.length} checkpoints</span><span className="text-muted">{p?.finished_at?"Done":cur?`Current: ${cur.stations?.name}`:"No route"}</span></div>
 <div className="h-3 bg-cream rounded-full overflow-hidden mt-1"><div className="h-full bg-antique" style={{width:(mine.length?c/mine.length*100:0)+"%"}}/></div></Card>})}</div></div>}
