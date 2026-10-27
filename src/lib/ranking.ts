export interface Row{team:string;completed:number;total:number;started_at:string|null;finished_at:string|null;last_activity:string|null;wrong:number;hints:number;score:number}
const ms=(r:Row)=>r.started_at&&r.finished_at?+new Date(r.finished_at)-+new Date(r.started_at):Infinity;
const base=(a:Row,b:Row)=>{const fa=!!a.finished_at,fb=!!b.finished_at;if(fa!==fb)return fa?-1:1;
 if(fa)return ms(a)-ms(b)||a.wrong-b.wrong;if(a.completed!==b.completed)return b.completed-a.completed;
 const la=a.last_activity?+new Date(a.last_activity):Infinity,lb=b.last_activity?+new Date(b.last_activity):Infinity;return la-lb||a.wrong-b.wrong};
/** Scoring off: finished first (fastest), then checkpoints. Scoring on: score first, then the same rules as tie-breakers. */
export const rank=(rows:Row[],scoring=false):Row[]=>[...rows].sort((a,b)=>scoring&&a.score!==b.score?b.score-a.score:base(a,b));
export const score=(o:{completed:number;wrong:number;hints:number;finished:boolean},s:{points:number;wrongPenalty:number;hintPenalty:number;finishBonus:number})=>
 Math.max(0,o.completed*s.points-o.wrong*s.wrongPenalty-o.hints*s.hintPenalty+(o.finished?s.finishBonus:0));
