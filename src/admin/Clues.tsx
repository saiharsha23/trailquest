import {useEffect,useState} from "react";import {supabase as sb} from "../lib/supabase";import {Btn,Card,Err,Field} from "./ui";
interface S{id:string;event_id:string;name:string;location_desc:string|null;clue_title:string;clue_text:string;hint:string|null;success_message:string|null;quote:string|null;active:boolean;answers:string}
export default function Clues(){const [rows,setR]=useState<S[]>([]);const [err,setErr]=useState("");const [ok,setOk]=useState("");const [pv,setPv]=useState("");
 const load=async()=>{const [s,a]=await Promise.all([sb!.from("stations").select("*").order("sort"),sb!.from("station_answers").select("*")]);
  if(s.error)return setErr(s.error.message);const m=new Map((a.data??[]).map((x:any)=>[x.station_id,(x.accepted as string[]).join(", ")]));
  setR((s.data as any[]).map(x=>({...x,answers:m.get(x.id)??""})))};
 useEffect(()=>{load()},[]);
 const upd=(id:string,p:Partial<S>)=>setR(r=>r.map(x=>x.id===id?{...x,...p}:x));
 const save=async(s:S)=>{const {answers,...st}=s;const acc=answers.split(",").map(x=>x.trim()).filter(Boolean);
  if(!acc.length)return setErr("Add at least one accepted answer.");
  const a=await sb!.from("stations").update({name:st.name,location_desc:st.location_desc,clue_title:st.clue_title,clue_text:st.clue_text,hint:st.hint,success_message:st.success_message,quote:st.quote,active:st.active}).eq("id",s.id);
  const b=await sb!.from("station_answers").upsert({station_id:s.id,accepted:acc});setErr(a.error?.message??b.error?.message??"");if(!a.error&&!b.error){setOk(s.name+" saved");}};
 const add=async()=>{const ev=rows[0]?.event_id??(await sb!.from("events").select("id").limit(1).maybeSingle()).data?.id;if(!ev)return setErr("Create an event on the Team Management page first.");
  const {error}=await sb!.from("stations").insert({event_id:ev,name:"New station",clue_title:"Untitled clue",clue_text:"Write your riddle here.",sort:rows.length+1});setErr(error?.message??"");load()};
 const move=async(i:number,d:number)=>{const j=i+d;if(j<0||j>=rows.length)return;const a=[...rows];[a[i],a[j]]=[a[j],a[i]];await Promise.all(a.map((x,k)=>sb!.from("stations").update({sort:k}).eq("id",x.id)));load()};
 const dup=async(s:S)=>{const {id,answers,...c}=s;const {data,error}=await sb!.from("stations").insert({...c,name:s.name+" (copy)"}).select("id").single();if(error)return setErr(error.message);
  await sb!.from("station_answers").insert({station_id:data.id,accepted:answers.split(",").map(x=>x.trim()).filter(Boolean)});load()};
 const del=async(s:S)=>{if(!confirm(`Delete ${s.name}? This cannot be undone.`))return;const {error}=await sb!.from("stations").delete().eq("id",s.id);setErr(error?.message??"");load()};
 return <div className="grid gap-5 max-w-4xl"><div className="flex justify-between items-center"><h1 className="font-serif text-3xl">Clue Library</h1><Btn onClick={add}>Add station</Btn></div><Err msg={err}/>{ok&&<p className="text-ok text-sm">{ok}</p>}
 {rows.map((s,i)=><Card key={s.id}><div className="grid sm:grid-cols-2 gap-3"><Field label="Station name" value={s.name} onChange={e=>upd(s.id,{name:e.target.value})}/>
 <Field label="Location description" value={s.location_desc??""} onChange={e=>upd(s.id,{location_desc:e.target.value})}/><Field label="Clue title" value={s.clue_title} onChange={e=>upd(s.id,{clue_title:e.target.value})}/>
 <Field label="Accepted answers (comma separated)" value={s.answers} onChange={e=>upd(s.id,{answers:e.target.value})}/></div>
 <label className="grid gap-1 text-sm text-muted mt-3">Clue (10–15 lines fit comfortably)<textarea rows={10} value={s.clue_text} onChange={e=>upd(s.id,{clue_text:e.target.value})} className="bg-ivory border border-line rounded-xl px-3 py-2 text-ink"/></label>
 <div className="grid sm:grid-cols-3 gap-3 mt-3"><Field label="Hint" value={s.hint??""} onChange={e=>upd(s.id,{hint:e.target.value})}/><Field label="Success message" value={s.success_message??""} onChange={e=>upd(s.id,{success_message:e.target.value})}/><Field label="Motivational quote" value={s.quote??""} onChange={e=>upd(s.id,{quote:e.target.value})}/></div>
 <div className="flex gap-3 mt-4 flex-wrap items-center"><label className="flex gap-2 items-center"><input type="checkbox" checked={s.active} onChange={e=>upd(s.id,{active:e.target.checked})}/>Active</label>
 <Btn onClick={()=>save(s)}>Save</Btn><Btn kind="secondary" onClick={()=>dup(s)}>Duplicate</Btn><Btn kind="secondary" onClick={()=>setPv(pv===s.id?"":s.id)}>Preview</Btn><Btn kind="secondary" aria-label="Move up" onClick={()=>move(i,-1)}>↑</Btn><Btn kind="secondary" aria-label="Move down" onClick={()=>move(i,1)}>↓</Btn><Btn kind="danger" onClick={()=>del(s)}>Delete</Btn></div>
 {pv===s.id&&<div className="mt-4 bg-ivory border border-line rounded-3xl p-5"><p className="text-xs tracking-[.3em] text-antique font-bold">PLAYER VIEW</p><h3 className="font-serif text-2xl mt-1">{s.clue_title}</h3><p className="whitespace-pre-line mt-2">{s.clue_text}</p></div>}</Card>)}</div>}
