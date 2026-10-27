import {useEffect,useRef,useState} from "react";import {Html5Qrcode} from "html5-qrcode";import {Btn,Field} from "../admin/ui";import {extractToken} from "../lib/qr";
export default function Scanner({onToken,onClose}:{onToken:(t:string)=>void;onClose:()=>void}){
 const [manual,setManual]=useState(false);const [tok,setTok]=useState("");const done=useRef(false);
 useEffect(()=>{if(manual)return;const q=new Html5Qrcode("qr-region");
  q.start({facingMode:"environment"},{fps:10,qrbox:240},txt=>{if(done.current)return;done.current=true;onToken(extractToken(txt))},()=>{}).catch(()=>setManual(true));
  return()=>{q.stop().then(()=>q.clear()).catch(()=>{})}},[manual]);
 return <div className="grid gap-4">{!manual?<><div id="qr-region" className="rounded-3xl overflow-hidden border border-line"/><p className="text-sm text-muted text-center">Point the camera at your team's QR card.</p>
 <Btn kind="secondary" onClick={()=>setManual(true)}>Enter code manually</Btn></>:
 <><p className="text-sm text-muted">Camera unavailable or skipped. Type the token printed under the QR code.</p><Field label="Checkpoint code" value={tok} onChange={e=>setTok(e.target.value)}/>
 <Btn disabled={!tok.trim()} onClick={()=>onToken(extractToken(tok))}>Unlock clue</Btn></>}
 <Btn kind="secondary" onClick={onClose}>Cancel</Btn></div>}
