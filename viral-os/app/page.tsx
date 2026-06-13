"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import { createResearch, generateDrafts, publishDraft, updateDraft } from "../lib/api";
import type { Draft, ResearchResponse } from "../lib/types";

const personas = ["違和感ノート", "深夜ラジオ", "地方観測者", "懐かしさ収集家", "静かな考察者"];
const nav = ["Dashboard", "Research", "Drafts", "Approval Queue", "Schedule", "Settings"];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export default function Home() {
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [persona, setPersona] = useState(personas[0]);
  const [research, setResearch] = useState<ResearchResponse | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [view, setView] = useState("Dashboard");
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const token = session?.access_token ?? "";

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setBusy("");
    }
  }

  async function refreshSession() {
    if (!supabase) return setError("Supabase public environment variables are not configured.");
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  }

  async function signIn() {
    if (!supabase) return setError("Supabase public environment variables are not configured.");
    const { error: authError } = await supabase.auth.signInWithOtp({ email });
    setError(authError ? authError.message : "Magic link sent. Open it, then refresh session.");
  }

  const scored = drafts.filter((draft) => draft.status === "scored");
  const scheduled = drafts.filter((draft) => draft.status === "scheduled");
  const failed = drafts.filter((draft) => draft.status === "failed");

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="border-b border-line pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-acid">Viral OS MVP</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">Threads approval OS</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          Research, extract, generate, score, approve, schedule, and publish to Threads only.
        </p>
      </header>

      <nav className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {nav.map((item) => (
          <button
            key={item}
            className={`focus-ring rounded border px-3 py-3 text-sm font-bold ${
              view === item ? "border-acid bg-acid text-black" : "border-line bg-panel"
            }`}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {error && <div className="rounded border border-red-500 bg-red-950/40 p-4 text-sm">{error}</div>}
      {busy && <div className="rounded border border-acid bg-acid/10 p-4 text-sm text-acid">{busy}</div>}

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="rounded border border-line bg-panel p-5">
          <h2 className="text-xl font-black">Operator</h2>
          {!session && (
            <div className="mt-4 grid gap-3">
              <input className="focus-ring rounded border border-line bg-ink p-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" />
              <button className="focus-ring rounded bg-acid px-4 py-3 font-black text-black" onClick={signIn}>Send magic link</button>
              <button className="focus-ring rounded border border-line px-4 py-3 font-bold" onClick={refreshSession}>Refresh session</button>
            </div>
          )}
          <label className="mt-6 block text-sm font-bold text-zinc-300">Topic</label>
          <textarea className="focus-ring mt-2 min-h-28 w-full rounded border border-line bg-ink p-3 text-sm" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="地方スーパーの閉店前" />
          <label className="mt-4 block text-sm font-bold text-zinc-300">Persona</label>
          <select className="focus-ring mt-2 w-full rounded border border-line bg-ink p-3 text-sm" value={persona} onChange={(event) => setPersona(event.target.value)}>
            {personas.map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="mt-5 grid gap-3">
            <button className="focus-ring rounded bg-acid px-4 py-3 font-black text-black disabled:opacity-40" disabled={!token || !topic || Boolean(busy)} onClick={() => run("Researching with Tavily.", async () => {
              const result = await createResearch(token, topic, persona);
              setResearch(result);
              setView("Research");
            })}>New research</button>
            <button className="focus-ring rounded border border-line px-4 py-3 font-bold disabled:opacity-40" disabled={!token || !research || Boolean(busy)} onClick={() => run("Generating scored drafts.", async () => {
              if (!research) return;
              const result = await generateDrafts(token, research.briefId, 20, persona);
              setDrafts(result.drafts);
              setView("Drafts");
            })}>Generate drafts</button>
          </div>
        </aside>

        <section className="grid gap-5">
          {view === "Dashboard" && <Panel title="Dashboard"><Metrics rows={[["Awaiting approval", scored.length], ["Scheduled", scheduled.length], ["Failed jobs", failed.length], ["Recent sources", research?.sources.length ?? 0]]} /></Panel>}
          {view === "Research" && <Panel title="Research">{research ? <ResearchView research={research} /> : <Empty>Start research from a topic.</Empty>}</Panel>}
          {(view === "Drafts" || view === "Approval Queue") && (
            <Panel title={view}>
              <DraftList
                drafts={view === "Approval Queue" ? scored : drafts}
                scheduleAt={scheduleAt}
                setScheduleAt={setScheduleAt}
                onEdit={(draft) => {
                  const text = window.prompt("Edit Threads draft", draft.text);
                  if (!text || text === draft.text) return;
                  run("Saving edit.", async () => {
                    await updateDraft(token, draft.id, { text });
                    setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, text } : item));
                  });
                }}
                onApprove={(id) => run("Approving draft.", async () => {
                  await updateDraft(token, id, { status: "approved" });
                  setDrafts((items) => items.map((item) => item.id === id ? { ...item, status: "approved" } : item));
                })}
                onReject={(id) => run("Rejecting draft.", async () => {
                  await updateDraft(token, id, { status: "rejected" });
                  setDrafts((items) => items.map((item) => item.id === id ? { ...item, status: "rejected" } : item));
                })}
                onSchedule={(id) => run("Scheduling approved draft.", async () => {
                  await updateDraft(token, id, { status: "scheduled", scheduledAt: scheduleAt });
                  setDrafts((items) => items.map((item) => item.id === id ? { ...item, status: "scheduled", scheduledAt: scheduleAt } : item));
                })}
                onPublish={(id) => run("Publishing to Threads.", async () => {
                  await publishDraft(token, id);
                  setDrafts((items) => items.map((item) => item.id === id ? { ...item, status: "published" } : item));
                })}
              />
            </Panel>
          )}
          {view === "Schedule" && <Panel title="Schedule"><DraftList drafts={scheduled} scheduleAt={scheduleAt} setScheduleAt={setScheduleAt} /></Panel>}
          {view === "Settings" && <Panel title="Settings"><p className="text-sm leading-7 text-zinc-300">Threads publishing target only. Human approval is required before publishing. Worker URL: {process.env.NEXT_PUBLIC_WORKER_BASE_URL || "not configured"}</p></Panel>}
        </section>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded border border-line bg-panel p-5"><h2 className="text-2xl font-black">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metrics({ rows }: { rows: [string, number][] }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{rows.map(([label, value]) => <div key={label} className="rounded border border-line bg-ink p-4"><p className="text-3xl font-black text-acid">{value}</p><p className="text-xs text-zinc-400">{label}</p></div>)}</div>;
}

function ResearchView({ research }: { research: ResearchResponse }) {
  return <div className="grid gap-4"><p className="text-sm leading-7 text-zinc-300">{research.summary}</p>{research.sources.map((source, index) => <article key={`${source.url}-${index}`} className="rounded border border-line bg-ink p-4"><div className="flex flex-wrap gap-2"><Badge>{source.priority}</Badge><Badge>{source.sourceType}</Badge><Badge>reliability {source.reliability}</Badge><Badge>impact {source.impact}</Badge></div><p className="mt-3 font-bold">{source.title}</p><p className="mt-2 text-sm text-zinc-400">{source.summary}</p>{source.url && <p className="mt-2 break-all text-xs text-acid">{source.url}</p>}</article>)}<div className="flex flex-wrap gap-2">{research.viralElements.map((element, index) => <Badge key={`${element.value}-${index}`}>{element.elementType}: {element.value} ({element.score})</Badge>)}</div></div>;
}

function DraftList(props: {
  drafts: Draft[];
  scheduleAt: string;
  setScheduleAt: (value: string) => void;
  onEdit?: (draft: Draft) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onSchedule?: (id: string) => void;
  onPublish?: (id: string) => void;
}) {
  if (!props.drafts.length) return <Empty>No drafts in this view.</Empty>;
  return <div className="grid gap-4">{props.drafts.map((draft) => <article key={draft.id} className="rounded border border-line bg-ink p-4"><div className="flex flex-wrap items-center gap-2 text-xs"><Badge>{draft.status ?? "scored"}</Badge><Badge>{draft.category}</Badge>{draft.hookType && <Badge>{draft.hookType}</Badge>}<span className="ml-auto font-black text-acid">Score {draft.scoreTotal}</span></div><p className="mt-4 text-lg font-bold leading-8">{draft.text}</p><div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(draft.scoreDetail).map(([key, value]) => <div key={key} className="rounded border border-line p-2 text-xs"><p className="text-zinc-500">{key}</p><p className="text-lg font-black">{value}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{props.onEdit && <Button onClick={() => props.onEdit?.(draft)}>Edit</Button>}{props.onApprove && <Button onClick={() => props.onApprove?.(draft.id)}>Approve</Button>}{props.onReject && <Button onClick={() => props.onReject?.(draft.id)}>Reject</Button>}{props.onSchedule && <input className="focus-ring rounded border border-line bg-panel px-3 py-2 text-sm" type="datetime-local" value={props.scheduleAt} onChange={(event) => props.setScheduleAt(event.target.value)} />}{props.onSchedule && <Button onClick={() => props.onSchedule?.(draft.id)}>Schedule</Button>}{props.onPublish && <Button onClick={() => props.onPublish?.(draft.id)}>Publish now</Button>}</div>{draft.sourceTrace.length > 0 && <p className="mt-3 text-xs text-zinc-500">Sources: {draft.sourceTrace.join(", ")}</p>}</article>)}</div>;
}

function Button({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button className="focus-ring rounded border border-line px-3 py-2 text-sm font-bold" onClick={onClick}>{children}</button>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-line bg-panel px-2 py-1 text-xs font-bold text-acid">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded border border-dashed border-line p-6 text-sm text-zinc-500">{children}</p>;
}
