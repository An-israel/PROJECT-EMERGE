import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Public honor-roll names for partners who opted in. NAMES ONLY — this query
 * never selects any amount, and there is no join to partnerships/receipts.
 * Uses `honor_roll_name` when set, otherwise `full_name`.
 */
export async function getHonorRollNames(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("honor_roll").select("display_name");
    if (!data) return [];
    return data.map((p: { display_name: string }) => p.display_name);
  } catch {
    return [];
  }
}
