import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="grid gap-4 @3xl/main:col-span-3 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Skeleton className="h-32 rounded-xl bg-muted/60" />
        <Skeleton className="h-32 rounded-xl bg-muted/60" />
        <Skeleton className="h-32 rounded-xl bg-muted/60" />
        <Skeleton className="h-32 rounded-xl bg-muted/60" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <Skeleton className="h-64 col-span-2 rounded-xl bg-muted/60" />
        <Skeleton className="h-64 rounded-xl bg-muted/60" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl bg-muted/60 mt-2" />
    </div>
  );
}
