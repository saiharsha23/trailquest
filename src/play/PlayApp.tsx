import {useCallback,useEffect,useState,FormEvent} from "react";
import {supabase as sb,configured} from "../lib/supabase";
import {friendly} from "../lib/qr";
import {Btn,Card,Err,Field} from "../admin/ui";
import Scanner from "./Scanner";
import LockPad from "./LockPad";

interface Clue{checkpoint:number;title:string;clue:string;hint:string|null;hint_available?:boolean;hint_penalty?:number;image_url?:string|null}
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
 const [st,setSt]=useState<State|null|undefined>(undefined);
 const [scan,setScan]=useState(false);
 const [ans,setAns]=useState("");
 const [err,setErr]=useState("");
 const [msg,setMsg]=useState("");
 const [busy,setBusy]=useState(false);
 const [useLock,setUseLock]=useState(true);
 const [finalDesc,setFinalDesc]=useState<string>(()=>sessionStorage.getItem("tq_final_desc")??"");
 const [finalQuote,setFinalQuote]=useState<string>(()=>sessionStorage.getItem("tq_final_quote")??"");
 const [zoomImg,setZoomImg]=useState<string|null>(null);

 const load=useCallback(async()=>{
  const s=await sb!.auth.getSession();
  if(!s.data.session)return setSt(null);
  const {data,error}=await sb!.rpc("get_my_state");
  setSt(error?null:data);
 },[]);

 useEffect(()=>{const t=new URLSearchParams(location.search).get("t");if(t){sessionStorage.setItem("tq_t",t);history.replaceState(null,"","/play")}},[]);
 useEffect(()=>{if(configured)load()},[load]);
 useEffect(()=>{const t=sessionStorage.getItem("tq_t");if(t&&st){sessionStorage.removeItem("tq_t");onToken(t)}},[st]);
 useEffect(()=>{if(!configured)return;const i=setInterval(load,15000);return()=>clearInterval(i)},[load]);

 const onToken=async(t:string)=>{
  setScan(false);setErr("");setMsg("");
  const {data,error}=await sb!.rpc("scan_checkpoint",{p_token:t});
  const m=error?.message??data?.error;
  m?setErr(friendly(m)):load();
 };

 const hint=async()=>{
  const {error}=await sb!.rpc("request_hint");
  error?setErr(friendly(error.message)):load();
 };

 const submitCode=async(codeValue:string)=>{
  if(busy)return;
  setBusy(true);setErr("");setMsg("");
  const {data,error}=await sb!.rpc("submit_answer",{p_answer:codeValue});
  setBusy(false);
  if(error)return setErr(friendly(error.message));
  if(!data.correct)return setErr("Incorrect combination or answer. Check the clue and try again.");
  
  setAns("");
  const successDesc=data.message??"";
  const quote=data.quote??"";
  if(successDesc){
   setFinalDesc(successDesc);
   sessionStorage.setItem("tq_final_desc",successDesc);
  }
  if(quote){
   setFinalQuote(quote);
   sessionStorage.setItem("tq_final_quote",quote);
  }
  setMsg([successDesc,quote].filter(Boolean).join(" ")||CHEERS[Math.floor(Math.random()*CHEERS.length)]);
  load();
 };

 const submit=async(e:FormEvent)=>{
  e.preventDefault();
  submitCode(ans);
 };

 const wrap=(c:React.ReactNode)=><div className="min-h-screen p-4 max-w-md mx-auto grid content-start gap-4"><div className="font-serif font-bold tracking-widest text-center pt-2">TRAILQUEST</div>{c}</div>;

 if(!configured)return wrap(<Card><h1 className="font-serif text-2xl">Not connected</h1><p className="text-muted mt-2">The organiser needs to finish setup.</p></Card>);
 if(st===undefined)return wrap(<p className="text-muted text-center">Loading…</p>);
 if(st===null)return wrap(<Join onJoined={load}/>);

 const done=!!st.finished_at;
 const pct=st.total?Math.round(st.completed/st.total*100):0;
 const isFinal=!!st.clue&&st.clue.checkpoint===st.total;
 const hasLockKeywords=!!st.clue&&/\b(lock|digit|code|pin|vault|number|combination)\b/i.test(st.clue.clue+" "+st.clue.title);
 const showLock=useLock&&(isFinal||hasLockKeywords);
 const defaultDigits=!!st.clue&&/\b3\s*digit/i.test(st.clue.clue)?3:4;

 return wrap(<>
 <Card><div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full border border-ink" style={{background:st.color}} aria-hidden/><h1 className="font-serif text-2xl">{st.team}</h1></div>
 <p className="text-sm text-muted mt-1">{st.event} · {st.status==="live"?"Game live":st.status==="paused"?"Game paused":st.status==="ended"?"Game ended":"Not started"}</p>
 <div className="mt-4 flex justify-between text-sm"><span>Progress</span><span className="font-bold">{st.completed}/{st.total}</span></div>
 <div className="h-3 bg-cream rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-antique transition-all" style={{width:pct+"%"}}/></div></Card>
 
 {st.deadline&&!done&&<p className="text-center font-bold">Time left: <Countdown to={st.deadline}/></p>}

 {done?<Card className="animate-unlock">
  <div className="text-center pb-1">
   <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cream border-2 border-antique text-4xl mb-2 shadow-inner">🔓</div>
   <p className="text-xs tracking-[.3em] text-antique font-bold">TREASURE FOUND · FINAL DESTINATION</p>
   <h2 className="font-serif text-3xl mt-1">Victory, {st.team}!</h2>
  </div>

  {finalDesc&&(
   <div className="mt-4 bg-cream/70 border border-antique/40 rounded-2xl p-4">
    <div className="flex items-center gap-1.5 text-xs tracking-[.2em] text-antique font-bold mb-2">
     <span>★</span>
     <span>FINAL DESTINATION DESCRIPTION</span>
    </div>
    <p className="font-serif text-lg leading-relaxed whitespace-pre-line text-ink">{finalDesc}</p>
    {finalQuote&&<p className="text-sm italic text-muted mt-2 border-t border-line/60 pt-2">“{finalQuote}”</p>}
   </div>
  )}

  <p className="text-muted mt-4 text-center">{st.victory??"Every checkpoint solved. Superb teamwork!"}</p>
  {st.started_at&&<p className="mt-3 font-serif text-xl text-center">Your time: {dur(st.started_at,st.finished_at!)}</p>}
 </Card>:<>
  {msg&&<Card className="animate-unlock border-2 border-ok/30">
   <div className="flex items-center gap-2 text-ok font-bold mb-1">
    <span className="text-xl">🔓</span>
    <span>LOCK OPENED!</span>
   </div>
   <p className="font-serif text-lg leading-relaxed whitespace-pre-line text-ink">{msg}</p>
  </Card>}

  {scan?<Card><Scanner onToken={onToken} onClose={()=>setScan(false)}/></Card>:st.clue?
  <Card>
   <div className="flex justify-between items-center">
    <p className="text-xs tracking-[.3em] text-antique font-bold">
     {isFinal?"FINAL CHECKPOINT "+st.clue.checkpoint:"CHECKPOINT "+st.clue.checkpoint}
    </p>
    {isFinal&&<span className="text-xs bg-gold/50 text-antique px-2 py-0.5 rounded-full font-bold">Final Destination</span>}
   </div>
   <h2 className="font-serif text-2xl mt-2">{st.clue.title}</h2>

   {/* Clue Description Image with tap-to-zoom */}
   {st.clue.image_url&&(
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-cream/40">
     <img
      src={st.clue.image_url}
      alt={st.clue.title}
      onClick={()=>setZoomImg(st.clue!.image_url!)}
      className="max-h-64 w-full object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
     />
     <p className="py-1 text-center text-[11px] text-muted tracking-wide">Tap image to zoom</p>
    </div>
   )}

   <p className="mt-3 whitespace-pre-line leading-relaxed">{st.clue.clue}</p>
   
   {st.clue.hint?<p className="mt-3 text-sm bg-cream rounded-2xl p-3"><b>Hint:</b> {st.clue.hint}</p>:st.clue.hint_available&&<button type="button" onClick={hint} className="mt-3 text-sm underline text-muted">Reveal hint{st.clue.hint_penalty?` (−${st.clue.hint_penalty} points)`:""}</button>}
   
   <div className="mt-5">
    {showLock?
     <div>
      <LockPad
       digitsCount={defaultDigits}
       onSubmit={submitCode}
       busy={busy||st.status!=="live"}
       err={err}
       isFinal={isFinal}
       onSwitchToText={()=>setUseLock(false)}
      />
      <Err msg={err}/>
     </div>
    :
     <form onSubmit={submit} className="grid gap-3">
      <Field label="Your answer" value={ans} onChange={e=>setAns(e.target.value)} autoComplete="off" required/>
      <Err msg={err}/>
      <Btn type="submit" disabled={busy||st.status!=="live"}>{busy?"Checking…":"Submit answer"}</Btn>
      <button type="button" onClick={()=>setUseLock(true)} className="text-xs text-muted hover:text-ink underline text-center block mt-1">
       Switch to combination lock keypad
      </button>
     </form>
    }
   </div>
  </Card>:
  <Card><p className="text-muted mb-4">{st.completed?"Find your next QR code, then scan it here.":"Find your first QR code, then scan it here."}</p><Err msg={err}/>
  <button disabled={st.status!=="live"} onClick={()=>{setErr("");setScan(true)}} className="w-full py-6 rounded-3xl bg-gold font-serif text-2xl disabled:opacity-50">Scan QR</button>
  {st.status!=="live"&&<p className="text-sm text-muted mt-3">Scanning opens when the organiser starts the game.</p>}</Card>}
 </>}

 {/* Full-screen image zoom modal */}
 {zoomImg&&(
  <div
   className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 cursor-zoom-out"
   onClick={()=>setZoomImg(null)}
  >
   <div className="relative max-h-full max-w-full">
    <img src={zoomImg} alt="Clue enlarged" className="max-h-[85vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl" />
    <button
     type="button"
     onClick={()=>setZoomImg(null)}
     className="absolute -top-3 -right-3 rounded-full bg-ivory px-3 py-1 font-sans text-xs font-bold text-ink shadow-lg hover:bg-cream"
    >
     ✕ Close
    </button>
   </div>
  </div>
 )}
 </>)}
