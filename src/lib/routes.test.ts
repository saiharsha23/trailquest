import {describe,it,expect} from "vitest";import {generateRoutes,findConflicts} from "./routes";
const S=["a","b","c","d","e","f","g","h"];
describe("routes",()=>{
 it("gives each team 6 unique stations",()=>{for(const r of generateRoutes(S,4,6)){expect(r).toHaveLength(6);expect(new Set(r).size).toBe(6)}});
 it("has different starts and no same-position clashes for 8/4/6",()=>{const r=generateRoutes(S,4,6);expect(new Set(r.map(x=>x[0])).size).toBe(4);expect(findConflicts(r)).toEqual([])});
 it("rejects too few stations",()=>expect(()=>generateRoutes(["a"],2,3)).toThrow());
 it("flags clashes",()=>expect(findConflicts([["a","b"],["a","c"]])).toHaveLength(1));
 it("converges all teams to a single default destination",()=>{
  const r=generateRoutes(S,4,6);
  const destinations=new Set(r.map(x=>x[x.length-1]));
  expect(destinations.size).toBe(1);
  expect(destinations.has("h")).toBe(true);
 });
 it("converges all teams to a custom single destination without duplicates",()=>{
  const r=generateRoutes(S,4,6,"c");
  const destinations=new Set(r.map(x=>x[x.length-1]));
  expect(destinations.size).toBe(1);
  expect(destinations.has("c")).toBe(true);
  for(const route of r){
   expect(route).toHaveLength(6);
   expect(new Set(route).size).toBe(6);
   expect(route[5]).toBe("c");
   expect(route.slice(0,5)).not.toContain("c");
  }
 });
});
