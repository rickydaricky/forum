import { InviteForm } from "@/components/landing/invite-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You've been invited to a debate — Both Takes",
  description:
    "Someone wants to hear your side. Paste your perspective and an AI judge will weigh in.",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Your side of the story
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Someone submitted their perspective on a disagreement and invited you
          to share yours. Paste your side below — neither of you can see what
          the other wrote until the debate begins.
        </p>
      </div>
      <InviteForm inviteToken={token} />
    </main>
  );
}
