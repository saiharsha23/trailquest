import {describe,it,expect} from "vitest";import {isCorrect} from "./answer";
describe("answer matching",()=>{
 it("ignores case and outer whitespace",()=>{for(const v of ["library","LIBRARY","Library"," library "])expect(isCorrect(v,["library"])).toBe(true)});
 it("keeps internal spaces meaningful",()=>expect(isCorrect("sports room",["sportsroom"])).toBe(false));
 it("supports alternatives",()=>expect(isCorrect("Books",["library","books"])).toBe(true));
 it("rejects wrong answers",()=>expect(isCorrect("kitchen",["library"])).toBe(false));
});
