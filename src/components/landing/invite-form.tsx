"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function InviteForm({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    async function lookupInvite() {
      try {
        const res = await fetch(`/api/invite/${inviteToken}`);
        if (res.status === 404) {
          setExpired(true);
          return;
        }
        if (!res.ok) {
          console.error("Invite lookup failed with status:", res.status);
          setLookupError(true);
          return;
        }
        const data = await res.json();
        setDebateId(data.debateId);
        if (data.status !== "waiting_for_side_b") {
          setExpired(true);
        }
      } catch (err) {
        console.error("Invite lookup error:", err);
        setLookupError(true);
      } finally {
        setResolving(false);
      }
    }
    lookupInvite();
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debateId) {
      setError("Invite could not be verified. Please refresh the page.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/debate/${debateId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, inviteToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push(`/debate/${data.debateId}`);
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (resolving) {
    return (
      <div className="w-full max-w-xl mx-auto flex justify-center py-12">
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          Verifying invite...
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="w-full max-w-xl mx-auto text-center">
        <div className="p-6 rounded-xl bg-surface border border-border">
          <p className="text-zinc-400 mb-4">
            This invite has expired or the debate has already started.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 rounded-full bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            Start Your Own Debate
          </Link>
        </div>
      </div>
    );
  }

  if (lookupError) {
    return (
      <div className="w-full max-w-xl mx-auto text-center">
        <div className="p-6 rounded-xl bg-surface border border-border">
          <p className="text-zinc-400 mb-4">
            Something went wrong verifying this invite. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block px-6 py-2.5 rounded-full bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-side-b">
          <span className="w-3 h-3 rounded-full bg-side-b" />
          Your Side
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your conversation with AI about this disagreement, or write your perspective directly..."
          className="h-64 rounded-xl bg-surface border border-side-b/20 p-4 text-sm text-foreground placeholder-zinc-500 resize-none focus:outline-none focus:border-side-b/50 focus:ring-1 focus:ring-side-b/30 transition-colors"
          required
        />
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-8 py-3 rounded-full bg-white text-black font-semibold text-base transition-all hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            "Submit & Start the Debate"
          )}
        </button>
      </div>
    </form>
  );
}
