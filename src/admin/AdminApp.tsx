import {useState,FormEvent} from "react";import {NavLink,Navigate,Outlet,Route,Routes} from "react-router-dom";
import {supabase,configured} from "../lib/supabase";import {useAdmin} from "../hooks/useAdmin";import {Btn,Card,Err,Field} from "./ui";
import Teams from "./Teams";import Clues from "./Clues";import RouteBuilder from "./RouteBuilder";import QrStudio from "./QrStudio";import Overview from "./Overview";import Settings from "./Settings";import Results from "./Results";import Monitor from "./Monitor";

function Login(){const [e,setE]=useState("");const [p,setP]=useState("");const [err,setErr]=useState("");
 const go=async(ev:FormEvent)=>{ev.preventDefault();const {error}=await supabase!.auth.signInWithPassword({email:e,password:p});setErr(error?.message??"")};
 return <div className="min-h-screen grid place-items-center p-5"><form onSubmit={go} className="w-full max-w-sm"><Card><h1 className="font-serif text-3xl mb-4">Organiser login</h1>
 <div className="grid gap-3"><Field label="Email" type="email" value={e} onChange={x=>setE(x.target.value)} required/><Field label="Password" type="password" value={p} onChange={x=>setP(x.target.value)} required/>
 <Err msg={err}/><Btn type="submit">Sign in</Btn></div></Card></form></div>}

const links=[["overview","Overview"],["teams","Team Management"],["clues","Clue Library"],["routes","Route Builder"],["qr","QR Code Studio"],["monitor","Live Game Monitor"],["settings","Game Settings"],["results","Results and Reports"]];

function Shell(){return <div className="min-h-screen md:flex"><aside className="no-print md:w-60 bg-cream border-b md:border-r border-line p-5">
 <div className="font-serif font-bold tracking-widest mb-4">TRAILQUEST</div><nav className="flex md:grid gap-1 overflow-x-auto">
 {links.map(([to,l])=><NavLink key={to} to={to} className={({isActive})=>"px-4 py-2 rounded-full whitespace-nowrap "+(isActive?"bg-gold":"hover:bg-gold/50")}>{l}</NavLink>)}</nav>
 <div className="mt-6"><Btn kind="secondary" onClick={()=>supabase!.auth.signOut()}>Sign out</Btn></div></aside><main className="flex-1 p-5 md:p-10"><Outlet/></main></div>}

export default function AdminApp(){
 const s=useAdmin();
 if(!configured||s.status==="noconfig")return <div className="p-10"><Card><h1 className="font-serif text-2xl">Database not connected</h1><p className="text-muted mt-2">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart.</p></Card></div>;
 if(s.status==="loading")return <p className="p-10 text-muted">Loading…</p>;
 if(s.status==="anon")return <Login/>;
 if(s.status==="denied"){
  const sql=`insert into admins (user_id) values ('${s.uid}') on conflict do nothing;`;
  return <div className="p-10 max-w-lg mx-auto"><Card>
   <h1 className="font-serif text-2xl">One Quick Step</h1>
   <p className="text-sm text-muted mt-2">Signed in as <b>{s.email}</b>. To authorize this account as an organiser, run this one line in your Supabase SQL Editor:</p>
   <div className="mt-3 bg-cream p-3 rounded-xl border border-line text-xs font-mono break-all select-all font-bold text-ink">{sql}</div>
   <div className="mt-4 flex gap-2">
    <Btn onClick={()=>location.reload()}>I've run it, refresh</Btn>
    <Btn kind="secondary" onClick={()=>supabase!.auth.signOut()}>Sign out</Btn>
   </div>
  </Card></div>;
 }
 return <Routes><Route element={<Shell/>}><Route index element={<Navigate to="overview" replace/>}/><Route path="overview" element={<Overview/>}/><Route path="settings" element={<Settings/>}/><Route path="results" element={<Results/>}/><Route path="teams" element={<Teams/>}/><Route path="clues" element={<Clues/>}/><Route path="routes" element={<RouteBuilder/>}/><Route path="qr" element={<QrStudio/>}/><Route path="monitor" element={<Monitor/>}/></Route></Routes>;
}
