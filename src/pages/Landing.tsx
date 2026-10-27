import {useState} from "react";import {BookOpen,Compass,Trophy,Menu,X} from "lucide-react";
const nav=["Home","How to Play","Team Login","Admin Login"];
const features=[{i:BookOpen,t:"Solve the Clues",d:"Read carefully crafted riddles, discover hidden meanings, and identify your next destination."},
{i:Compass,t:"Explore Together",d:"Follow physical QR checkpoints, work as a team, and discover new places around the hostel."},
{i:Trophy,t:"Celebrate Every Victory",d:"Unlock checkpoints, track your progress, and celebrate the moment your team reaches the treasure."}];
const steps=["Join your assigned team.","Scan your team's QR code.","Solve the clue and submit your answer.","Find the next QR and continue to victory."];
export default function Landing(){const [open,setOpen]=useState(false);
return <div>
<header className="bg-cream border-b border-line"><div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
<div className="flex items-center gap-3"><div className="h-11 w-11 rounded-full bg-ink text-gold grid place-items-center font-serif">TQ</div>
<div><div className="font-serif font-bold tracking-widest">TRAILQUEST</div><div className="text-[11px] tracking-[.2em] text-muted">HOSTEL TREASURE HUNT</div></div></div>
<nav className="hidden md:flex gap-2">{nav.map((n,i)=><a key={n} href={n==="Admin Login"?"/admin":n==="Team Login"?"/play":"#"} className={"px-4 py-2 rounded-full "+(i===0?"bg-gold":"hover:bg-gold/50")}>{n}</a>)}</nav>
<button className="md:hidden p-2" aria-label="Menu" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div>
{open&&<nav className="md:hidden px-5 pb-4 grid gap-1">{nav.map(n=><a key={n} href="#" className="px-4 py-3 rounded-2xl hover:bg-gold/50">{n}</a>)}</nav>}</header>
<main><section className="max-w-4xl mx-auto px-5 py-20 text-center">
<p className="text-xs tracking-[.3em] text-antique font-bold">THE ADVENTURE BEGINS</p>
<h1 className="font-serif text-4xl md:text-6xl mt-4 leading-tight">Every Clue Leads to Adventure</h1>
<p className="text-muted mt-6 max-w-2xl mx-auto leading-relaxed">Think together. Follow the clues. Discover the hidden trail. Work as a team to solve riddles, uncover secret checkpoints, and race towards the final treasure.</p>
<div className="mt-8 flex gap-3 justify-center flex-wrap"><a href="/play" className="px-6 py-3 rounded-full bg-gold font-bold hover:brightness-95">Join Your Team</a>
<a href="/admin" className="px-6 py-3 rounded-full bg-card border border-line hover:bg-cream">Organiser Login</a></div></section>
<section className="max-w-6xl mx-auto px-5 grid md:grid-cols-3 gap-6">{features.map(({i:I,t,d})=>
<div key={t} className="bg-card border border-line rounded-card p-8 shadow-warm"><div className="h-12 w-12 rounded-2xl bg-gold grid place-items-center text-antique"><I/></div>
<h2 className="font-serif text-2xl mt-5">{t}</h2><p className="text-muted mt-2">{d}</p></div>)}</section>
<section className="bg-cream mt-20 py-16"><div className="max-w-4xl mx-auto px-5"><h2 className="font-serif text-3xl text-center">How to Play</h2>
<ol className="mt-8 grid sm:grid-cols-2 gap-4">{steps.map((s,i)=><li key={s} className="bg-card border border-line rounded-3xl p-6 flex gap-4 items-center">
<span className="h-9 w-9 shrink-0 rounded-full bg-ink text-gold grid place-items-center font-serif">{i+1}</span>{s}</li>)}</ol></div></section></main>
<footer className="text-center text-sm text-muted py-8">TrailQuest · Hostel Treasure Hunt</footer></div>}
