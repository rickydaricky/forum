"use client";

import Link from "next/link";

export default function DebateError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-24">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-zinc-400 mb-6">
        There was an error loading this debate.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-full border border-border text-sm font-medium hover:border-zinc-500 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-full bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
        >
          Start a New Debate
        </Link>
      </div>
    </div>
  );
}
