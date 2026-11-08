import {useEffect,useState} from "react";import {supabase as sb} from "../lib/supabase";import {generateRoutes,findConflicts} from "../lib/routes";import {Btn,Card,Err,Field} from "./ui";
interface St{id:string;name:string}interface Tm{id:string;name:string}
export default function RouteBuilder(){
 const [st,setSt]=useState<St[]>([]);const [tm,setTm]=useState<Tm[]>([]);const [k,setK]=useState(6);const [destination,setDestination]=useState<string>("");const [routes,setR]=useState<string[][]>([]);const [err,setErr]=useState("");const [ok,setOk]=useState("");
 useEffect(()=>{(async()=>{const [s,t]=await Promise.all([sb!.from("stations").select("id,name").eq("active",true).order("sort"),sb!.from("teams").select("id,name").order("created_at")]);
  setErr(s.error?.message??t.error?.message??"");const stations=(s.data??[]) as St[];setSt(stations);setTm(t.data??[]);
  if(stations.length)setDestination(prev=>prev&&stations.some(x=>x.id===prev)?prev:stations[stations.length-1].id);
 })()},[]);
 const name=(id:string)=>st.find(s=>s.id===id)?.name??id;
 const auto=()=>{try{setErr("");const destId=destination||(st[st.length-1]?.id??"");setR(generateRoutes(st.map(s=>s.id),tm.length,k,destId))}catch(e){setErr((e as Error).message)}};
 const move=(t:number,i:number,d:number)=>setR(rs=>rs.map((r,x)=>{if(x!==t||i+d<0||i+d>=r.length)return r;const c=[...r];[c[i],c[i+d]]=[c[i+d],c[i]];return c}));
 const swap=(t:number,i:number,id:string)=>setR(rs=>rs.map((r,x)=>x===t?r.map((v,j)=>j===i?id:v):r));
 const conflicts=findConflicts(routes);const dupes=routes.some(r=>new Set(r).size!==r.length);
 const commonDest=routes.length>0&&routes.every(r=>r[r.length-1]===routes[0][r.length-1])?routes[0][routes.length-1]:null;
 const publish=async()=>{const {data:pr}=await sb!.from("team_progress").select("team_id,scanned_order,completed_order");const hit=tm.filter(t=>(pr??[]).some((p:any)=>p.team_id===t.id&&(p.scanned_order||p.completed_order)));
  if(!confirm(hit.length?`${hit.map(t=>t.name).join(", ")} already have progress. Publishing RESETS them to the start and their printed QR cards stop working. Continue?`:"Publish these routes? Existing QR codes for these teams will stop working."))return;
  for(let t=0;t<tm.length;t++){const {error}=await sb!.rpc("publish_route",{p_team:tm[t].id,p_stations:routes[t]});if(error)return setErr(error.message)}setOk("Routes published.")};
 return <div className="grid gap-5 max-w-6xl"><h1 className="font-serif text-3xl">Route Builder</h1><Err msg={err}/>{ok&&<p className="text-ok text-sm">{ok}</p>}
 <Card><div className="flex gap-3 items-end flex-wrap"><Field label="Checkpoints per team" type="number" min={1} max={st.length||1} value={k} onChange={e=>setK(+e.target.value)}/>
 <label className="grid gap-1 text-sm"><span className="text-muted">Destination (final checkpoint)</span>
 <select value={destination||(st[st.length-1]?.id??"")} onChange={e=>setDestination(e.target.value)} className="bg-ivory border border-line rounded-xl px-3 py-2 text-ink">
  {st.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
 </select></label>
 <Btn onClick={auto} disabled={!st.length||!tm.length}>{routes.length?"Regenerate":"Generate routes"}</Btn><span className="text-sm text-muted">{st.length} active stations, {tm.length} teams</span></div></Card>
 {routes.length>0&&<><div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{routes.map((r,t)=><Card key={tm[t].id}><h2 className="font-serif text-xl mb-3">{tm[t].name}</h2>
 <ol className="grid gap-2">{r.map((id,i)=><li key={i} className="flex items-center gap-1 text-sm"><span className="w-5 text-muted">{i+1}</span>
 <select value={id} onChange={e=>swap(t,i,e.target.value)} className="flex-1 bg-ivory border border-line rounded-lg px-2 py-1">{st.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
 {i===r.length-1&&<span className="text-[11px] bg-cream text-antique px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">End</span>}
 <button aria-label="Move up" className="px-1" onClick={()=>move(t,i,-1)}>↑</button><button aria-label="Move down" className="px-1" onClick={()=>move(t,i,1)}>↓</button></li>)}</ol></Card>)}</div>
 <Card>{commonDest&&<p className="text-sm text-ok mb-2 font-medium">Single destination: <b>{name(commonDest)}</b> (final checkpoint for all teams)</p>}
 {dupes&&<p className="text-bad text-sm mb-2">A team has the same station twice. Fix this before publishing.</p>}
 {conflicts.length?<ul className="text-sm text-bad mb-3 list-disc pl-5">{conflicts.map(c=><li key={c.position}>Checkpoint {c.position}: {name(c.station)} is shared by {c.teams.map(i=>tm[i].name).join(" and ")}. Teams may crowd here.</li>)}</ul>:<p className="text-sm text-ok mb-3">No team shares a station at the same checkpoint number. Teams can still cross paths at other times.</p>}
 <Btn disabled={dupes} onClick={publish}>Publish routes</Btn></Card></>}</div>}
