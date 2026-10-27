import {ReactNode} from "react";
export const Card=({children}:{children:ReactNode})=><div className="bg-card border border-line rounded-card p-6 shadow-warm">{children}</div>;
export const Btn=({kind="primary",...p}:React.ButtonHTMLAttributes<HTMLButtonElement>&{kind?:"primary"|"secondary"|"danger"})=>
 <button {...p} className={"px-5 py-2.5 rounded-full font-bold disabled:opacity-50 "+({primary:"bg-gold text-ink hover:brightness-95",secondary:"bg-card border border-line hover:bg-cream",danger:"bg-bad text-white hover:brightness-95"})[kind]}/>;
export const Field=(p:React.InputHTMLAttributes<HTMLInputElement>&{label:string})=><label className="grid gap-1 text-sm text-muted">{p.label}<input {...p} className="bg-ivory border border-line rounded-xl px-3 py-2 text-ink"/></label>;
export const Err=({msg}:{msg:string})=>msg?<p role="alert" className="text-bad text-sm">{msg}</p>:null;
