"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "both" | "invite";

export function InputForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("both");
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteDebateId, setInviteDebateId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleBothSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputA, inputB }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push(`/debate/${data.id}`);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: inviteInput, side: "a" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      const link = `${window.location.origin}/invite/${data.inviteToken}`;
      setInviteLink(link);
      setInviteDebateId(data.debateId);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyInvite() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setError("Failed to copy. Please select and copy the link manually.");
      }
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Mode toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-full bg-surface border border-border p-1">
          <button
            type="button"
            onClick={() => { setMode("both"); setError(null); setInviteLink(null); }}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              mode === "both"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            I have both sides
          </button>
          <button
            type="button"
            onClick={() => { setMode("invite"); setError(null); }}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              mode === "invite"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Invite the other side
          </button>
        </div>
      </div>

      {mode === "both" ? (
        <form onSubmit={handleBothSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-side-a">
                <span className="w-3 h-3 rounded-full bg-side-a" />
                Side A
              </label>
              <textarea
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                placeholder="Describe what happened from this person's perspective..."
                className="h-48 rounded-xl bg-surface border border-side-a/20 p-4 text-sm text-foreground placeholder-zinc-500 resize-none focus:outline-none focus:border-side-a/50 focus:ring-1 focus:ring-side-a/30 transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-side-b">
                <span className="w-3 h-3 rounded-full bg-side-b" />
                Side B
              </label>
              <textarea
                value={inputB}
                onChange={(e) => setInputB(e.target.value)}
                placeholder="Describe what happened from this person's perspective..."
                className="h-48 rounded-xl bg-surface border border-side-b/20 p-4 text-sm text-foreground placeholder-zinc-500 resize-none focus:outline-none focus:border-side-b/50 focus:ring-1 focus:ring-side-b/30 transition-colors"
                required
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              disabled={loading || !inputA.trim() || !inputB.trim()}
              className="px-8 py-3 rounded-full bg-white text-black font-semibold text-base transition-all hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Setting up debate...
                </span>
              ) : (
                "Get the Ruling"
              )}
            </button>
          </div>
        </form>
      ) : inviteLink ? (
        /* Invite link generated */
        <div className="max-w-xl mx-auto text-center">
          <div className="p-6 rounded-xl bg-surface border border-border">
            <p className="text-sm text-zinc-400 mb-4">
              Your side has been submitted. Send this link to the other person — they&apos;ll paste their side without seeing yours.
            </p>
            <div className="flex items-center gap-2 bg-surface-2 rounded-lg p-3 mb-4">
              <code className="flex-1 text-sm text-zinc-200 truncate">
                {inviteLink}
              </code>
              <button
                onClick={handleCopyInvite}
                className="shrink-0 px-4 py-1.5 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              The debate starts automatically once they submit their side.
            </p>
            {inviteDebateId && (
              <button
                onClick={() => router.push(`/debate/${inviteDebateId}`)}
                className="px-6 py-2.5 rounded-full bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
              >
                Go to Debate Page
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Invite form — single side input */
        <form onSubmit={handleInviteSubmit} className="max-w-xl mx-auto">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-side-a">
              <span className="w-3 h-3 rounded-full bg-side-a" />
              Your Side
            </label>
            <textarea
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Describe what happened from your perspective..."
              className="h-64 rounded-xl bg-surface border border-side-a/20 p-4 text-sm text-foreground placeholder-zinc-500 resize-none focus:outline-none focus:border-side-a/50 focus:ring-1 focus:ring-side-a/30 transition-colors"
              required
            />
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            After submitting, you&apos;ll get a link to send to the other person. They won&apos;t see what you wrote.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={loading || !inviteInput.trim()}
              className="px-8 py-3 rounded-full bg-white text-black font-semibold text-base transition-all hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                "Submit & Get Invite Link"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
