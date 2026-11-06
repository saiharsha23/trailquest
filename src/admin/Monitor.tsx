import {useCallback,useEffect,useState} from "react";import {supabase as sb} from "../lib/supabase";import {toCsv,download} from "../lib/csv";import {Btn,Card,Err} from "./ui";
interface T{id:string;name:string;color:string;player_count:number}
interface P{team_id:string;scanned_order:number;completed_order:number;started_at:string|null;finished_at:string|null;last_activity:string|null}
interface A{id:number;team_id:string;kind:string;checkpoint_order:number|null;created_at:string}
interface Ev{id:string;status:string}
const LABEL:Record<string,string>={scan:"scanned a QR",invalid_scan:"scanned an invalid or out-of-order QR",hint:"used a hint",correct:"answered correctly",incorrect:"gave an incorrect answer",completed:"completed checkpoint",finished:"finished the hunt"};
const fmt=(s:string|null)=>s?new Date(s).toLocaleTimeString():"—";
const dur=(a:string|null,b:string|null)=>a&&b?`${Math.round((+new Date(b)-+new Date(a))/60000)} min`:"—";
export default function Monitor(){const [teams,setT]=useState<T[]>([]);const [prog,setP]=useState<P[]>([]);const [feed,setF]=useState<A[]>([]);const [total,setTotal]=useState<Record<string,number>>({});
 const [ev,setEv]=useState<Ev|null>(null);const [err,setErr]=useState("");const [live,setLive]=useState("connecting");const [upd,setUpd]=useState<Date|null>(null);const [ft,setFt]=useState("");const [fk,setFk]=useState("");
 const load=useCallback(async()=>{const [t,p,a,r,e]=await Promise.all([sb!.from("teams").select("id,name,color,player_count").order("created_at"),sb!.from("team_progress").select("*"),
  sb!.from("activity_log").select("*").order("id",{ascending:false}).limit(100),sb!.from("team_routes").select("team_id"),sb!.from("events").select("id,status").limit(1).maybeSingle()]);
  setErr(t.error?.message??p.error?.message??a.error?.message??"");setT(t.data??[]);setP((p.data??[]) as P[]);setF((a.data??[]) as A[]);setEv(e.data as Ev|null);
  const c:Record<string,number>={};(r.data??[]).forEach((x:any)=>c[x.team_id]=(c[x.team_id]??0)+1);setTotal(c);setUpd(new Date())},[]);
 useEffect(()=>{load();const ch=sb!.channel("monitor").on("postgres_changes",{event:"INSERT",schema:"public",table:"activity_log"},(m)=>{setF(f=>[m.new as A,...f].slice(0,100));setUpd(new Date())})
  .on("postgres_changes",{event:"*",schema:"public",table:"team_progress"},()=>load()).on("postgres_changes",{event:"*",schema:"public",table:"events"},()=>load())
  .subscribe(s=>setLive(s==="SUBSCRIBED"?"live":s==="CLOSED"?"disconnected":"connecting"));return()=>{sb!.removeChannel(ch)}},[load]);
 const status=(p?:P)=>p?.finished_at?"Finished":p&&(p.scanned_order||p.completed_order)?"In progress":"Not started";
 const set=async(s:string,ask?:string)=>{if(ask&&!confirm(ask))return;const {error}=await sb!.rpc("set_game_status",{p_event:ev!.id,p_status:s});setErr(error?.message??"");load()};
 const reset=async(t:T)=>{if(!confirm(`Reset ${t.name}? Progress and attempts will be erased.`))return;const {error}=await sb!.rpc("reset_team",{p_team:t.id});setErr(error?.message??"");load()};
 const act=async(fn:string,args:object,ask:string)=>{if(!confirm(ask))return;const {error}=await sb!.rpc(fn,args);setErr(error?.message??"");load()};
 const restart=()=>ev&&act("reset_progress",{p_event:ev.id},"Restart from scratch? All teams go back to the start and the game returns to draft. Players and join codes are kept.");
 const fresh=()=>ev&&act("reset_game",{p_event:ev.id,p_clear_codes:true},"START FRESH? Erases all progress and activity, removes every player from their team, clears all join codes, and returns the game to draft. Clues, routes and QR cards are kept.");
 const clearAct=()=>ev&&act("clear_activity",{p_event:ev.id},"Clear the whole activity feed? This cannot be undone.");
 const exp=()=>download("results.csv",toCsv([["Team","Completed","Total","Status","Start","Finish","Duration"],...teams.map(t=>{const p=prog.find(x=>x.team_id===t.id);return [t.name,p?.completed_order??0,total[t.id]??0,status(p),p?.started_at,p?.finished_at,dur(p?.started_at??null,p?.finished_at??null)]})]));
 const s=ev?.status;const name=(id:string)=>teams.find(t=>t.id===id)?.name??"A team";
 return <div className="grid gap-5 max-w-5xl"><h1 className="font-serif text-3xl">Live Game Monitor</h1><Err msg={err}/>
 <Card><div className="flex gap-3 flex-wrap items-center"><span className="font-bold">Game: {s??"no event"}</span>
 {(s==="draft"||s==="ended")&&<Btn onClick={()=>set("live",s==="ended"?"Restart the game? Teams can play again.":undefined)}>{s==="ended"?"Restart game":"Start game"}</Btn>}{s==="live"&&<Btn kind="secondary" onClick={()=>set("paused")}>Pause</Btn>}{s==="paused"&&<Btn onClick={()=>set("live")}>Resume</Btn>}
 {(s==="live"||s==="paused")&&<Btn kind="danger" onClick={()=>set("ended","End the game? Teams will no longer be able to play.")}>End game</Btn>}<Btn kind="secondary" onClick={exp}>Export results</Btn>
 {ev&&<><Btn kind="danger" onClick={restart}>Restart from scratch</Btn><Btn kind="danger" onClick={fresh}>Start fresh</Btn></>}
 <span className="text-xs text-muted ml-auto">Realtime: {live} · updated {upd?upd.toLocaleTimeString():"—"}</span></div></Card>
 <div className="grid sm:grid-cols-2 gap-4">{teams.map(t=>{const p=prog.find(x=>x.team_id===t.id);const n=total[t.id]??0,c=p?.completed_order??0;
 return <Card key={t.id}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-ink" style={{background:t.color}} aria-hidden/><h2 className="font-serif text-xl">{t.name}</h2><span className="ml-auto text-sm">{status(p)}</span></div>
 <p className="text-sm text-muted mt-1">{t.player_count} players · last activity {fmt(p?.last_activity??null)}{p?.finished_at&&` · finished in ${dur(p.started_at,p.finished_at)}`}</p>
 <div className="flex justify-between text-sm mt-3"><span>Checkpoints</span><b>{c}/{n}</b></div><div className="h-3 bg-cream rounded-full overflow-hidden"><div className="h-full bg-antique" style={{width:(n?c/n*100:0)+"%"}}/></div>
 <div className="mt-3"><Btn kind="secondary" onClick={()=>reset(t)}>Reset progress</Btn></div></Card>})}</div>
 <Card><div className="flex gap-3 flex-wrap mb-3"><h2 className="font-serif text-xl mr-auto">Activity</h2>{ev&&<Btn kind="secondary" onClick={clearAct}>Clear activity</Btn>}
 <select aria-label="Team filter" value={ft} onChange={e=>setFt(e.target.value)} className="bg-ivory border border-line rounded-xl px-2"><option value="">All teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
 <select aria-label="Activity filter" value={fk} onChange={e=>setFk(e.target.value)} className="bg-ivory border border-line rounded-xl px-2"><option value="">All activity</option>{Object.entries(LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
 <ul className="grid gap-1 text-sm max-h-96 overflow-auto">{feed.filter(a=>(!ft||a.team_id===ft)&&(!fk||a.kind===fk)).map(a=><li key={a.id} className="flex gap-3"><span className="text-muted w-20 shrink-0">{fmt(a.created_at)}</span><span><b>{name(a.team_id)}</b> {LABEL[a.kind]}{a.checkpoint_order?` ${a.checkpoint_order}`:""}</span></li>)}
 {!feed.length&&<li className="text-muted">Nothing yet. Activity appears here as teams play.</li>}</ul></Card></div>}