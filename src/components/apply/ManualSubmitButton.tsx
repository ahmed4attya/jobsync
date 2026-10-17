"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toastError, toastSuccess } from "@/lib/toast";
import { markApplicationSubmittedManually } from "@/actions/apply/submit-manual";
import { CheckCircle2, Loader } from "lucide-react";

export function ManualSubmitButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleManualSubmit = () => {
    startTransition(async () => {
      const res = await markApplicationSubmittedManually({ applicationId });
      if (res?.success) {
        toastSuccess("Application marked as submitted manually");
        router.refresh();
      } else {
        toastError(res?.message ?? "Failed to mark as submitted");
      }
    });
  };

  return (
    <Button
      onClick={handleManualSubmit}
      disabled={pending}
      className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
    >
      {pending ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      تم التقديم يدوياً (Mark Submitted)
    </Button>
  );
}
