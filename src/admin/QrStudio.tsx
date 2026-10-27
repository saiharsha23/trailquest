import {useCallback,useEffect,useState} from "react";import QRCode from "qrcode";import {supabase as sb} from "../lib/supabase";import {toCsv,download} from "../lib/csv";import {Btn,Card,Err} from "./ui";
interface R{team_id:string;checkpoint_order:number;revoked:boolean;qr_token_plain:string|null;stations:{name:string}|null}interface T{id:string;name:string;color:string}
export default function QrStudio(){const [teams,setT]=useState<T[]>([]);const [routes,setR]=useState<R[]>([]);const [imgs,setI]=useState<Record<string,string>>({});const [event,setEv]=useState("Treasure Hunt");const [err,setErr]=useState("");
 const load=useCallback(async()=>{const [t,r,e]=await Promise.all([sb!.from("teams").select("id,name,color").order("created_at"),
  sb!.from("team_routes").select("team_id,checkpoint_order,revoked,qr_token_plain,stations(name)").order("checkpoint_order"),sb!.from("events").select("name").limit(1).maybeSingle()]);
  setErr(t.error?.message??r.error?.message??"");setT(t.data??[]);const rows=(r.data??[]) as unknown as R[];setR(rows);setEv(e.data?.name??"Treasure Hunt");
  const m:Record<string,string>={};for(const x of rows)if(x.qr_token_plain)m[x.qr_token_plain]=await QRCode.toDataURL(`${location.origin}/play?t=${x.qr_token_plain}`,{width:600,margin:2,errorCorrectionLevel:"M",color:{dark:"#000000",light:"#FFFFFF"}});
  setI(m)},[]);
 useEffect(()=>{load()},[load]);
 const act=async(fn:string,args:object,ask?:string)=>{if(ask&&!confirm(ask))return;const {error}=await sb!.rpc(fn,args);setErr(error?.message??"");load()};
 const tn=(id:string)=>teams.find(t=>t.id===id);
 const csv=()=>download("route-inventory.csv",toCsv([["Team","Checkpoint","Station","Status"],...routes.map(r=>[tn(r.team_id)?.name,r.checkpoint_order,r.stations?.name,r.revoked?"revoked":"active"])]));
 const png=(r:R)=>{const a=document.createElement("a");a.href=imgs[r.qr_token_plain!];a.download=`${tn(r.team_id)?.name}-checkpoint-${r.checkpoint_order}.png`;a.click()};
 return <div className="grid gap-5 max-w-6xl"><div className="no-print grid gap-4"><h1 className="font-serif text-3xl">QR Code Studio</h1><Err msg={err}/>
 <Card><div className="flex gap-3 flex-wrap items-center"><Btn onClick={()=>window.print()} disabled={!routes.length}>Print cards</Btn><Btn kind="secondary" onClick={()=>window.print()}>Export to PDF</Btn><Btn kind="secondary" onClick={csv} disabled={!routes.length}>Route inventory CSV</Btn>
 <span className="text-sm text-muted">{routes.length} QR codes. In the print dialog choose “Save as PDF” to export. Turn on background graphics for the team colour bars.</span></div></Card>
 {!routes.length&&<Card><p className="text-muted">No QR codes yet. Publish routes in the Route Builder first.</p></Card>}
 <div className="grid gap-2">{routes.map(r=><div key={r.team_id+r.checkpoint_order} className="bg-card border border-line rounded-2xl px-4 py-2 flex gap-3 items-center flex-wrap text-sm">
 <span className="font-bold w-28">{tn(r.team_id)?.name}</span><span className="w-16">#{r.checkpoint_order}</span><span className="flex-1 text-muted">{r.stations?.name}{r.revoked&&" · revoked"}</span>
 <Btn kind="secondary" onClick={()=>png(r)} disabled={!imgs[r.qr_token_plain??""]}>PNG</Btn>
 <Btn kind="secondary" onClick={()=>act("revoke_token",{p_team:r.team_id,p_order:r.checkpoint_order,p_revoked:!r.revoked})}>{r.revoked?"Restore":"Revoke"}</Btn>
 <Btn kind="danger" onClick={()=>act("regenerate_token",{p_team:r.team_id,p_order:r.checkpoint_order},"Regenerate this token? The printed card stops working and must be reprinted.")}>New token</Btn></div>)}</div></div>
 <div className="grid grid-cols-2 gap-4 print:gap-3">{routes.filter(r=>!r.revoked&&imgs[r.qr_token_plain??""]).map(r=>{const t=tn(r.team_id);return <div key={r.team_id+r.checkpoint_order} className="qr-card bg-card border-2 rounded-card overflow-hidden text-center" style={{borderColor:t?.color}}>
 <div className="py-2 font-serif font-bold text-white" style={{background:t?.color,printColorAdjust:"exact"}}>{t?.name}</div><div className="p-4"><p className="text-xs tracking-[.2em] text-muted">{event.toUpperCase()}</p>
 <p className="font-serif text-2xl mt-1">Checkpoint {r.checkpoint_order}</p><img src={imgs[r.qr_token_plain!]} alt={`QR for ${t?.name} checkpoint ${r.checkpoint_order}`} className="mx-auto w-48 h-48 mt-2"/>
 <p className="text-xs text-muted mt-2">Open TrailQuest on your phone, tap Scan QR, and point the camera here.</p><p className="text-[10px] font-mono break-all mt-1 text-muted">{r.qr_token_plain}</p></div></div>})}</div></div>}
