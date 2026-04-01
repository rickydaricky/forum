import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Debate, DebateMode, InputType, PhaseRecord } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function createDebate(debate: {
  id: string;
  mode?: DebateMode;
  invite_token?: string;
  input_a_type?: InputType;
  input_a_raw?: string;
  input_b_type?: InputType;
  input_b_raw?: string;
}): Promise<Debate> {
  const { data, error } = await supabase
    .from("debates")
    .insert({
      ...debate,
      status: debate.mode === "invite" ? "waiting_for_side_b" : "pending",
      phases: [],
      total_tokens_used: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create debate: ${error.message}`);
  return data as Debate;
}

export async function getDebateByInviteToken(
  token: string
): Promise<Debate | null> {
  const { data, error } = await supabase
    .from("debates")
    .select("*")
    .eq("invite_token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch debate by invite: ${error.message}`);
  }
  return data as Debate;
}

export async function getDebate(id: string): Promise<Debate | null> {
  const { data, error } = await supabase
    .from("debates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    // This is Supabase's way of saying "not found" for .single() queries
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch debate ${id}: ${error.message}`);
  }
  return data as Debate;
}

export async function updateDebate(
  id: string,
  updates: Partial<
    Pick<
      Debate,
      | "status"
      | "input_a_type"
      | "input_a_raw"
      | "input_b_type"
      | "input_b_raw"
      | "position_a"
      | "position_b"
      | "phases"
      | "error_message"
      | "total_tokens_used"
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from("debates")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(`Failed to update debate: ${error.message}`);
}

/**
 * Atomically join a debate — only succeeds if status is still waiting_for_side_b.
 * Returns true if the join succeeded, false if the debate was already joined.
 */
export async function joinDebate(
  id: string,
  inviteToken: string,
  updates: {
    input_a_type?: InputType;
    input_a_raw?: string;
    input_b_type?: InputType;
    input_b_raw?: string;
  }
): Promise<boolean> {
  const { data, error } = await supabase
    .from("debates")
    .update({ ...updates, status: "pending" })
    .eq("id", id)
    .eq("invite_token", inviteToken)
    .eq("status", "waiting_for_side_b")
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return false; // no row matched — already joined
    throw new Error(`Failed to join debate: ${error.message}`);
  }
  return !!data;
}

export async function appendPhase(
  id: string,
  phase: PhaseRecord
): Promise<void> {
  const debate = await getDebate(id);
  if (!debate) throw new Error("Debate not found");

  const phases = [...debate.phases, phase];
  await updateDebate(id, { phases });
}

export async function updateLatestPhase(
  id: string,
  phase: PhaseRecord
): Promise<void> {
  const debate = await getDebate(id);
  if (!debate) throw new Error("Debate not found");

  const phases = [...debate.phases];
  phases[phases.length - 1] = phase;
  await updateDebate(id, { phases });
}
