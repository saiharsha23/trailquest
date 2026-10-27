import {describe,it,expect} from "vitest";import {rank,score,Row} from "./ranking";
const r=(team:string,o:Partial<Row>):Row=>({team,completed:0,total:6,started_at:null,finished_at:null,last_activity:null,wrong:0,hints:0,score:0,...o});
describe("rank",()=>{
 it("puts finished teams first, fastest first",()=>{const x=rank([r("slow",{completed:6,started_at:"2026-01-01T10:00:00Z",finished_at:"2026-01-01T11:00:00Z"}),r("mid",{completed:5}),r("fast",{completed:6,started_at:"2026-01-01T10:00:00Z",finished_at:"2026-01-01T10:30:00Z"})]);expect(x.map(y=>y.team)).toEqual(["fast","slow","mid"])});
 it("ranks unfinished by checkpoints then earlier activity",()=>{const x=rank([r("b",{completed:3,last_activity:"2026-01-01T10:20:00Z"}),r("a",{completed:3,last_activity:"2026-01-01T10:10:00Z"}),r("c",{completed:4})]);expect(x.map(y=>y.team)).toEqual(["c","a","b"])});
 it("ranks by score when scoring is on",()=>expect(rank([r("lo",{score:100}),r("hi",{score:300})],true).map(y=>y.team)).toEqual(["hi","lo"]));
});
describe("score",()=>{
 const s={points:100,wrongPenalty:10,hintPenalty:25,finishBonus:200};
 it("applies penalties and bonus",()=>expect(score({completed:6,wrong:2,hints:1,finished:true},s)).toBe(755));
 it("never goes below zero",()=>expect(score({completed:0,wrong:5,hints:3,finished:false},s)).toBe(0));
});
