import {describe,it,expect} from "vitest";import {extractToken,friendly} from "./qr";
describe("qr",()=>{
 it("reads bare tokens",()=>expect(extractToken("  abc123 ")).toBe("abc123"));
 it("reads token from url query",()=>expect(extractToken("https://x.app/play?t=abc123")).toBe("abc123"));
 it("reads token from url path",()=>expect(extractToken("https://x.app/s/abc123")).toBe("abc123"));
 it("maps errors without leaking details",()=>{expect(friendly("out_of_sequence")).toMatch(/current checkpoint/);expect(friendly("boom")).toMatch(/went wrong/)});
});
