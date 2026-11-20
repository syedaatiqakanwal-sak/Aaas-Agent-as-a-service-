import { Paperclip, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";

import { useAgents } from "@/components/agents-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  apiErrorMessage,
  createSession,
  sendMessage,
  uploadDocument,
} from "@/lib/api";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function ChatPage() {
  const { slug = "" } = useParams();
  const { agents, loading } = useAgents();
  const agent = agents.find((item) => item.slug === slug);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const sessionId = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionId.current = null;
    setLines([]);
    setDraft("");
    setNotice("");
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines, sending]);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!agent || !message || sending) {
      return;
    }
    setDraft("");
    setNotice("");
    setLines((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: message },
    ]);
    setSending(true);
    try {
      if (!sessionId.current) {
        const session = await createSession(agent.slug);
        sessionId.current = session.id;
      }
      const reply = await sendMessage({
        agentId: agent.slug,
        sessionId: sessionId.current,
        message,
      });
      setLines((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: reply.message },
      ]);
    } catch (caught) {
      setLines((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: apiErrorMessage(caught) },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!agent || !file) {
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice("Files must be 5MB or smaller.");
      return;
    }
    setNotice("Uploading knowledge...");
    try {
      const document = await uploadDocument(agent.slug, file);
      setNotice(`Indexed ${document.title}.`);
    } catch (caught) {
      setNotice(apiErrorMessage(caught));
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading agent...</p>;
  }

  if (!agent) {
    return <p className="p-6 text-sm text-muted-foreground">That agent is not available.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{agent.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{agent.model}</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.json,text/plain"
            className="hidden"
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Paperclip />
            Upload Knowledge
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask {agent.name} something. The first message starts a session.
            </p>
          ) : null}
          {lines.map((line) => (
            <div
              key={line.id}
              className={
                line.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] text-sm leading-6 whitespace-pre-wrap"
              }
            >
              {line.content}
            </div>
          ))}
          {sending ? <p className="text-sm text-muted-foreground">Thinking...</p> : null}
          <div ref={bottomRef} />
        </div>
      </div>
      <form onSubmit={onSend} className="border-t border-border px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Message ${agent.name}`}
            className="max-h-40 min-h-12"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send">
            <SendHorizontal />
          </Button>
        </div>
        {notice ? <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">{notice}</p> : null}
      </form>
    </div>
  );
}
