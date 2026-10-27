import {useCallback,useEffect,useState,FormEvent} from "react";import {supabase as sb,configured} from "../lib/supabase";import {friendly} from "../lib/qr";import {Btn,Card,Err,Field} from "../admin/ui";import Scanner from "./Scanner";
interface Clue{checkpoint:number;title:string;clue:string;hint:string|null;hint_available?:boolean;hint_penalty?:number}
interface State{team:string;color:string;event:string;status:string;completed:number;total:number;started_at:string|null;finished_at:string|null;clue:Clue|null;victory?:string|null;deadline?:string|null}
const CHEERS=["Brilliant teamwork! One step closer to the treasure.","Clue cracked! Keep your eyes open and your team spirit high.","Great minds, fast feet — on to the next checkpoint!","Fantastic work! Your teamwork is paying off."];
const dur=(a:string,b:string)=>{const s=Math.max(0,Math.round((+new Date(b)-+new Date(a))/1000));return `${Math.floor(s/60)} min ${s%60} s`};
function Join({onJoined}:{onJoined:()=>void}){const [code,setCode]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 const go=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setErr("");
  const s=await sb!.auth.getSession();if(!s.data.session){const a=await sb!.auth.signInAnonymously();if(a.error){setBusy(false);return setErr("Team sign-in is not enabled yet. Ask the organiser.")}}
  const {data,error}=await sb!.rpc("join_team",{p_code:code});setBusy(false);const m=error?.message??data?.error;m?setErr(friendly(m)):onJoined()};
 return <form onSubmit={go}><Card><p className="text-xs tracking-[.3em] text-antique font-bold">TEAM LOGIN</p><h1 className="font-serif text-3xl mt-2 mb-4">Join your team</h1>
 <div className="grid gap-3"><Field label="Team code" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value)} required/><Err msg={err}/><Btn type="submit" disabled={busy}>{busy?"Joining…":"Join team"}</Btn></div></Card></form>}
function Countdown({to}:{to:string}){const [n,setN]=useState(Date.now());useEffect(()=>{const i=setInterval(()=>setN(Date.now()),1000);return()=>clearInterval(i)},[]);const s=Math.max(0,Math.round((+new Date(to)-n)/1000));return <span>{Math.floor(s/60)}:{String(s%60).padStart(2,"0")}</span>}
export default function PlayApp(){
 const [st,setSt]=useState<State|null|undefined>(undefined);const [scan,setScan]=useState(false);const [ans,setAns]=useState("");const [err,setErr]=useState("");const [msg,setMsg]=useState("");const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const s=await sb!.auth.getSession();if(!s.data.session)return setSt(null);const {data,error}=await sb!.rpc("get_my_state");setSt(error?null:data)},[]);
 useEffect(()=>{const t=new URLSearchParams(location.search).get("t");if(t){sessionStorage.setItem("tq_t",t);history.replaceState(null,"","/play")}},[]);
 useEffect(()=>{if(configured)load()},[load]);
 useEffect(()=>{const t=sessionStorage.getItem("tq_t");if(t&&st){sessionStorage.removeItem("tq_t");onToken(t)}},[st]);
 useEffect(()=>{if(!configured)return;const i=setInterval(load,15000);return()=>clearInterval(i)},[load]);  // picks up pause/end
 const onToken=async(t:string)=>{setScan(false);setErr("");setMsg("");const {data,error}=await sb!.rpc("scan_checkpoint",{p_token:t});const m=error?.message??data?.error;m?setErr(friendly(m)):load()};
 const hint=async()=>{const {error}=await sb!.rpc("request_hint");error?setErr(friendly(error.message)):load()};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setErr("");setMsg("");
  const {data,error}=await sb!.rpc("submit_answer",{p_answer:ans});setBusy(false);if(error)return setErr(friendly(error.message));
  if(!data.correct)return setErr("Not quite — read the clue again and have another go.");
  setAns("");setMsg([data.message,data.quote].filter(Boolean).join(" ")||CHEERS[Math.floor(Math.random()*CHEERS.length)]);load()};
 const wrap=(c:React.ReactNode)=><div className="min-h-screen p-4 max-w-md mx-auto grid content-start gap-4"><div className="font-serif font-bold tracking-widest text-center pt-2">TRAILQUEST</div>{c}</div>;
 if(!configured)return wrap(<Card><h1 className="font-serif text-2xl">Not connected</h1><p className="text-muted mt-2">The organiser needs to finish setup.</p></Card>);
 if(st===undefined)return wrap(<p className="text-muted text-center">Loading…</p>);
 if(st===null)return wrap(<Join onJoined={load}/>);
 const done=!!st.finished_at;const pct=st.total?Math.round(st.completed/st.total*100):0;
 return wrap(<>
 <Card><div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full border border-ink" style={{background:st.color}} aria-hidden/><h1 className="font-serif text-2xl">{st.team}</h1></div>
 <p className="text-sm text-muted mt-1">{st.event} · {st.status==="live"?"Game live":st.status==="paused"?"Game paused":st.status==="ended"?"Game ended":"Not started"}</p>
 <div className="mt-4 flex justify-between text-sm"><span>Progress</span><span className="font-bold">{st.completed}/{st.total}</span></div>
 <div className="h-3 bg-cream rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-antique transition-all" style={{width:pct+"%"}}/></div></Card>
 {st.deadline&&!done&&<p className="text-center font-bold">Time left: <Countdown to={st.deadline}/></p>}
 {done?<Card><p className="text-xs tracking-[.3em] text-antique font-bold">TREASURE FOUND</p><h2 className="font-serif text-3xl mt-2">Victory, {st.team}!</h2>
 <p className="text-muted mt-3">{st.victory??"Every checkpoint solved. Superb teamwork!"}</p>{st.started_at&&<p className="mt-2 font-serif text-xl">Your time: {dur(st.started_at,st.finished_at!)}</p>}</Card>:<>
 {msg&&<Card><p className="font-serif text-xl text-ok" role="status">{msg}</p></Card>}
 {scan?<Card><Scanner onToken={onToken} onClose={()=>setScan(false)}/></Card>:st.clue?
 <Card><p className="text-xs tracking-[.3em] text-antique font-bold">CHECKPOINT {st.clue.checkpoint}</p><h2 className="font-serif text-2xl mt-2">{st.clue.title}</h2>
 <p className="mt-3 whitespace-pre-line leading-relaxed">{st.clue.clue}</p>{st.clue.hint?<p className="mt-3 text-sm bg-cream rounded-2xl p-3"><b>Hint:</b> {st.clue.hint}</p>:st.clue.hint_available&&<button type="button" onClick={hint} className="mt-3 text-sm underline text-muted">Reveal hint{st.clue.hint_penalty?` (−${st.clue.hint_penalty} points)`:""}</button>}
 <form onSubmit={submit} className="grid gap-3 mt-5"><Field label="Your answer" value={ans} onChange={e=>setAns(e.target.value)} autoComplete="off" required/><Err msg={err}/><Btn type="submit" disabled={busy||st.status!=="live"}>{busy?"Checking…":"Submit answer"}</Btn></form></Card>:
 <Card><p className="text-muted mb-4">{st.completed?"Find your next QR code, then scan it here.":"Find your first QR code, then scan it here."}</p><Err msg={err}/>
 <button disabled={st.status!=="live"} onClick={()=>{setErr("");setScan(true)}} className="w-full py-6 rounded-3xl bg-gold font-serif text-2xl disabled:opacity-50">Scan QR</button>
 {st.status!=="live"&&<p className="text-sm text-muted mt-3">Scanning opens when the organiser starts the game.</p>}</Card>}</>}
 </>)}
