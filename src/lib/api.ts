/**
 * Every Supabase call the screens need lives here. Screens call these functions
 * and never import the Supabase client directly.
 */
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  onboarding_completed_at: string | null;
};

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, onboarding_completed_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/** Marks onboarding as done. Used for both "finished" and "skipped". */
export async function completeOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

/** Saves "this type of spending belongs under this umbrella". Placing it again replaces the old choice. */
export async function saveTypeRule(spendingType: string, categoryId: number): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from('type_rules')
    .select('id')
    .eq('spending_type', spendingType)
    .maybeSingle();
  if (findError) throw findError;

  const { error } = existing
    ? await supabase.from('type_rules').update({ category_id: categoryId }).eq('id', existing.id)
    : await supabase.from('type_rules').insert({ spending_type: spendingType, category_id: categoryId });
  if (error) throw error;
}
