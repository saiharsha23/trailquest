const cell=(v:unknown)=>{const s=v==null?"":String(v);return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
export const toCsv=(rows:unknown[][])=>rows.map(r=>r.map(cell).join(",")).join("\n");
export function download(name:string,text:string,type="text/csv"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
