import { getApplyDraft } from "@/actions/apply/prepare";
import { ApplyDraftView } from "@/components/apply/ApplyDraftView";
import { notFound } from "next/navigation";

async function ApplyDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getApplyDraft(id);
  if (!result || !("success" in result) || !result.success || !result.data) {
    notFound();
  }

  return <ApplyDraftView draft={result.data} />;
}

export default ApplyDraftPage;
