import {useEffect,useState} from "react";import {supabase as sb} from "../lib/supabase";import {Btn,Card,Err,Field} from "./ui";
export default function Settings(){const [e,setE]=useState<any>(null);const [err,setErr]=useState("");const [ok,setOk]=useState("");
 useEffect(()=>{sb!.from("events").select("*").limit(1).maybeSingle().then(({data,error})=>{setErr(error?.message??"");setE(data)})},[]);
 if(!e)return <div><Err msg={err}/><p className="text-muted">{err?"":"No event yet. Create one on the Team Management page."}</p></div>;
 const up=(p:object)=>setE({...e,...p});const area=(l:string,k:string,r=3)=><label className="grid gap-1 text-sm text-muted">{l}<textarea rows={r} value={e[k]??""} onChange={x=>up({[k]:x.target.value})} className="bg-ivory border border-line rounded-xl px-3 py-2 text-ink"/></label>;
 const save=async()=>{const {error}=await sb!.from("events").update({name:e.name,instructions:e.instructions,max_attempts:e.max_attempts,time_limit_minutes:e.time_limit_minutes||null,points_per_checkpoint:e.points_per_checkpoint,wrong_penalty:e.wrong_penalty,hint_penalty:e.hint_penalty,finish_bonus:e.finish_bonus,hints_enabled:e.hints_enabled,victory_message:e.victory_message}).eq("id",e.id);setErr(error?.message??"");setOk(error?"":"Settings saved")};
 return <div className="grid gap-5 max-w-2xl"><h1 className="font-serif text-3xl">Game Settings</h1><Err msg={err}/>{ok&&<p className="text-ok text-sm">{ok}</p>}
 <Card><div className="grid gap-4"><Field label="Event name" value={e.name} onChange={x=>up({name:x.target.value})}/>{area("Event instructions","instructions")}
 <Field label="Wrong answers allowed per minute (per checkpoint)" type="number" min={1} value={e.max_attempts} onChange={x=>up({max_attempts:+x.target.value})}/>
 <label className="flex gap-2 items-center"><input type="checkbox" checked={e.hints_enabled} onChange={x=>up({hints_enabled:x.target.checked})}/>Show hints to teams</label>{area("Final victory message","victory_message")}
 <div className="grid sm:grid-cols-2 gap-3"><Field label="Time limit per team, minutes (blank = none)" type="number" min={1} value={e.time_limit_minutes??""} onChange={x=>up({time_limit_minutes:x.target.value?+x.target.value:null})}/>
 <Field label="Points per checkpoint (0 = scoring off)" type="number" min={0} value={e.points_per_checkpoint} onChange={x=>up({points_per_checkpoint:+x.target.value})}/>
 <Field label="Penalty per wrong answer" type="number" min={0} value={e.wrong_penalty} onChange={x=>up({wrong_penalty:+x.target.value})}/>
 <Field label="Penalty per hint" type="number" min={0} value={e.hint_penalty} onChange={x=>up({hint_penalty:+x.target.value})}/>
 <Field label="Bonus for finishing" type="number" min={0} value={e.finish_bonus} onChange={x=>up({finish_bonus:+x.target.value})}/></div>
 <p className="text-sm text-muted">Game status is controlled from the Live Game Monitor. The time limit starts when a team scans its first QR code.</p><Btn onClick={save}>Save settings</Btn></div></Card></div>}
