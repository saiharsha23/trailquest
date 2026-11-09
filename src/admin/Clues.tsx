import { useEffect, useState } from "react"; import { supabase as sb } from "../lib/supabase"; import { uploadClueImage } from "../lib/storage"; import { Btn, Card, Err, Field } from "./ui";

interface S { id: string; event_id: string; name: string; location_desc: string | null; clue_title: string; clue_text: string; hint: string | null; success_message: string | null; quote: string | null; active: boolean; answers: string; image_url?: string | null }

export default function Clues() {
    const [rows, setR] = useState<S[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [pv, setPv] = useState(""); const [uploadingId, setUploadingId] = useState<string | null>(null);

    const load = async () => {
        const [s, a] = await Promise.all([sb!.from("stations").select("*").order("sort"), sb!.from("station_answers").select("*")]);
        if (s.error) return setErr(s.error.message); const m = new Map((a.data ?? []).map((x: any) => [x.station_id, (x.accepted as string[]).join(", ")]));
        setR((s.data as any[]).map(x => ({ ...x, answers: m.get(x.id) ?? "", image_url: x.image_url ?? null })))
    };

    useEffect(() => { load() }, []);

    const upd = (id: string, p: Partial<S>) => setR(r => r.map(x => x.id === id ? { ...x, ...p } : x));

    const save = async (s: S) => {
        const { answers, ...st } = s; const acc = answers.split(",").map(x => x.trim()).filter(Boolean);
        if (!acc.length) return setErr("Add at least one accepted answer.");
        const a = await sb!.from("stations").update({ name: st.name, location_desc: st.location_desc, clue_title: st.clue_title, clue_text: st.clue_text, hint: st.hint, success_message: st.success_message, quote: st.quote, active: st.active, image_url: st.image_url || null }).eq("id", s.id);
        const b = await sb!.from("station_answers").upsert({ station_id: s.id, accepted: acc });
        setErr(a.error?.message ?? b.error?.message ?? ""); if (!a.error && !b.error) { setOk(s.name + " saved"); }
    };

    const add = async () => {
        const ev = rows[0]?.event_id ?? (await sb!.from("events").select("id").limit(1).maybeSingle()).data?.id; if (!ev) return setErr("Create an event on the Team Management page first.");
        const { error } = await sb!.from("stations").insert({ event_id: ev, name: "New station", clue_title: "Untitled clue", clue_text: "Write your riddle here.", sort: rows.length + 1 }); setErr(error?.message ?? ""); load()
    };

    const move = async (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const a = [...rows];[a[i], a[j]] = [a[j], a[i]]; await Promise.all(a.map((x, k) => sb!.from("stations").update({ sort: k }).eq("id", x.id))); load() };

    const resetAll = async () => { const ev = rows[0]?.event_id; if (!ev || !confirm("Reset ALL clues? Every station goes back to a blank riddle and all accepted answers are deleted. Teams cannot answer until you write them again.")) return; const { error } = await sb!.rpc("reset_clues", { p_event: ev }); setErr(error?.message ?? ""); setOk(error ? "" : "All clues reset"); load() };

    const dup = async (s: S) => {
        const { id, answers, ...c } = s; const { data, error } = await sb!.from("stations").insert({ ...c, name: s.name + " (copy)" }).select("id").single(); if (error) return setErr(error.message);
        await sb!.from("station_answers").insert({ station_id: data.id, accepted: answers.split(",").map(x => x.trim()).filter(Boolean) }); load()
    };

    const del = async (s: S) => { if (!confirm(`Delete ${s.name}? This cannot be undone.`)) return; const { error } = await sb!.from("stations").delete().eq("id", s.id); setErr(error?.message ?? ""); load() };

    const handleFileUpload = async (stationId: string, file: File) => {
        setErr(""); setOk(""); setUploadingId(stationId);
        const { url, error } = await uploadClueImage(file);
        setUploadingId(null);
        if (error) return setErr(error);
        if (url) { upd(stationId, { image_url: url }); setOk("Image uploaded successfully! Click Save to apply changes.") }
    };

    return <div className="grid gap-5 max-w-4xl"><div className="flex justify-between items-center"><h1 className="font-serif text-3xl">Clue Library</h1><div className="flex gap-2"><Btn kind="danger" onClick={resetAll}>Reset all clues</Btn><Btn onClick={add}>Add station</Btn></div></div><Err msg={err} />{ok && <p className="text-ok text-sm">{ok}</p>}
        {rows.map((s, i) => <Card key={s.id}><div className="grid sm:grid-cols-2 gap-3"><Field label="Station name" value={s.name} onChange={e => upd(s.id, { name: e.target.value })} />
            <Field label="Location description" value={s.location_desc ?? ""} onChange={e => upd(s.id, { location_desc: e.target.value })} /><Field label="Clue title" value={s.clue_title} onChange={e => upd(s.id, { clue_title: e.target.value })} />
            <Field label="Accepted answers (e.g. 1234 or 789 for lock)" value={s.answers} onChange={e => upd(s.id, { answers: e.target.value })} /></div>

            <label className="grid gap-1 text-sm text-muted mt-3">Clue / Riddle (instructions to find the code)<textarea rows={8} value={s.clue_text} onChange={e => upd(s.id, { clue_text: e.target.value })} className="bg-ivory border border-line rounded-xl px-3 py-2 text-ink" /></label>

            {/* Clue Image Upload & URL */}
            <div className="mt-4 p-4 bg-cream/30 border border-line rounded-2xl">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <span className="text-sm font-bold text-ink">Clue Image (optional visual description / map)</span>
                    {s.image_url && <button type="button" onClick={() => upd(s.id, { image_url: null })} className="text-xs text-bad hover:underline font-semibold">Remove Image</button>}
                </div>

                {s.image_url && (
                    <div className="mb-3">
                        <img src={s.image_url} alt="Clue preview" className="h-32 w-auto max-w-sm object-contain rounded-xl border border-line bg-card shadow-sm" />
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3 items-end">
                    <Field label="Image URL" placeholder="https://example.com/image.jpg" value={s.image_url ?? ""} onChange={e => upd(s.id, { image_url: e.target.value })} />
                    <label className="grid gap-1 text-sm text-muted">
                        <span>Upload image file (PNG, JPG, WEBP)</span>
                        <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingId === s.id}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(s.id, f) }}
                            className="bg-ivory border border-line rounded-xl px-3 py-1.5 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-antique file:text-white file:text-xs file:font-bold hover:file:bg-antique/90 cursor-pointer disabled:opacity-50"
                        />
                    </label>
                </div>
                {uploadingId === s.id && <p className="text-xs text-antique mt-2 font-medium">Uploading image to storage…</p>}
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mt-4"><Field label="Hint" value={s.hint ?? ""} onChange={e => upd(s.id, { hint: e.target.value })} /><Field label="Success / Final destination description" value={s.success_message ?? ""} onChange={e => upd(s.id, { success_message: e.target.value })} /><Field label="Motivational quote" value={s.quote ?? ""} onChange={e => upd(s.id, { quote: e.target.value })} /></div>

            <div className="flex gap-3 mt-4 flex-wrap items-center"><label className="flex gap-2 items-center"><input type="checkbox" checked={s.active} onChange={e => upd(s.id, { active: e.target.checked })} />Active</label>
                <Btn onClick={() => save(s)}>Save</Btn><Btn kind="secondary" onClick={() => dup(s)}>Duplicate</Btn><Btn kind="secondary" onClick={() => setPv(pv === s.id ? "" : s.id)}>Preview</Btn><Btn kind="secondary" aria-label="Move up" onClick={() => move(i, -1)}>↑</Btn><Btn kind="secondary" aria-label="Move down" onClick={() => move(i, 1)}>↓</Btn><Btn kind="danger" onClick={() => del(s)}>Delete</Btn></div>

            {pv === s.id && <div className="mt-4 bg-ivory border border-line rounded-3xl p-5">
                <p className="text-xs tracking-[.3em] text-antique font-bold">PLAYER VIEW</p>
                <h3 className="font-serif text-2xl mt-1">{s.clue_title}</h3>
                {s.image_url && <div className="my-3 overflow-hidden rounded-2xl border border-line bg-cream/40"><img src={s.image_url} alt={s.clue_title} className="max-h-60 w-full object-contain" /></div>}
                <p className="whitespace-pre-line mt-2">{s.clue_text}</p>
            </div>}</Card>)}</div>
}
