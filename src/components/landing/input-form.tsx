"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InputForm() {
  const router = useRouter();
  const [inputA, setInputA] = useState("");
  const [inputB, setInputB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Side A */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-side-a">
            <span className="w-3 h-3 rounded-full bg-side-a" />
            Side A
          </label>
          <textarea
            value={inputA}
            onChange={(e) => setInputA(e.target.value)}
            placeholder="Paste a Claude/ChatGPT share link, or type the argument directly..."
            className="h-48 rounded-xl bg-surface border border-side-a/20 p-4 text-sm text-foreground placeholder-zinc-500 resize-none focus:outline-none focus:border-side-a/50 focus:ring-1 focus:ring-side-a/30 transition-colors"
            required
          />
        </div>

        {/* Side B */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-side-b">
            <span className="w-3 h-3 rounded-full bg-side-b" />
            Side B
          </label>
          <textarea
            value={inputB}
            onChange={(e) => setInputB(e.target.value)}
            placeholder="Paste a Claude/ChatGPT share link, or type the argument directly..."
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
            "Start the Debate"
          )}
        </button>
      </div>
    </form>
  );
}
