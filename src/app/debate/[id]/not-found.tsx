import Link from "next/link";

export default function DebateNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-24">
      <h1 className="text-2xl font-bold mb-2">Debate not found</h1>
      <p className="text-zinc-400 mb-6">
        This debate may have been removed or the link is incorrect.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-full bg-white text-black font-medium text-sm hover:bg-zinc-200 transition-colors"
      >
        Start a New Debate
      </Link>
    </div>
  );
}
