import ModelTrainingView from "@/components/model-training/ModelTrainingView";
import { createClient } from "@/lib/supabase/server";
import { getTrainedModels } from "@/lib/supabase/trainedModels";
import type { TrainedModel } from "@/types/database";

async function getPageData(): Promise<{ models: TrainedModel[]; userId: string | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { models: [], userId: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { models: [], userId: null };

  const models = await getTrainedModels(supabase, user.id);
  return { models, userId: user.id };
}

export default async function ModelTrainingPage() {
  const { models, userId } = await getPageData();
  return <ModelTrainingView initialModels={models} userId={userId} />;
}
