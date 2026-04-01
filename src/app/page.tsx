import { Hero } from "@/components/landing/hero";
import { InputForm } from "@/components/landing/input-form";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
      <Hero />
      <InputForm />

      <div className="mt-16 text-center text-xs text-zinc-600 max-w-md">
        <p>
          Paste your AI conversation, a text thread, or just describe your side
          in your own words. Your input is used only for this debate and stored
          to enable sharing.
        </p>
      </div>
    </main>
  );
}
