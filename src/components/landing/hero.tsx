export function Hero() {
  return (
    <div className="text-center mb-12">
      <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
        The Forum
      </h1>
      <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
        Paste two sides of a disagreement. Watch AI advocates debate each
        other. Get a fair ruling from an impartial judge.
      </p>
      <div className="flex justify-center gap-8 mt-8 text-sm text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-side-a" />
          Opening Statements
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-side-b" />
          Responses
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-judge" />
          Judge&apos;s Ruling
        </div>
      </div>
    </div>
  );
}
