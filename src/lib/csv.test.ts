import {describe,it,expect} from "vitest";import {toCsv} from "./csv";
describe("csv",()=>{it("quotes commas, quotes and newlines",()=>expect(toCsv([["a,b",'say "hi"',"x\ny",null,3]])).toBe('"a,b","say ""hi""","x\ny",,3'))});
