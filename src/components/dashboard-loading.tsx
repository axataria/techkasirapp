import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardLoading() {
  return (
    <>
      <p className="sr-only" role="status">Memuat dasbor</p>
      <div className="dashboard-loading contents" aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-5 w-56 max-w-full" />
          </div>
          <Skeleton className="h-11 w-36" />
        </div>
        <Skeleton className="h-4 w-64 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 @min-[880px]:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="gap-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="size-5" />
              </div>
              <div className="flex flex-wrap items-baseline gap-3"><Skeleton className="h-8 w-36 max-w-full" /><Skeleton className="h-5 w-24" /></div>
              <Skeleton className="h-4 w-44 max-w-full" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map(index => <Card key={index} className="gap-4"><Skeleton className="h-5 w-28" /><Skeleton className="h-8 w-36 max-w-full" /><Skeleton className="h-4 w-44 max-w-full" /></Card>)}
        </div>
        <div className="grid gap-6 @min-[880px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card className="p-3 sm:p-6">
            <CardHeader>
              <div className="space-y-1">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-5 w-36" />
              </div>
              <Skeleton className="h-8 w-16" />
            </CardHeader>
            <Skeleton className="h-48" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </Card>
          <Card>
            <Skeleton className="h-7 w-52 max-w-full" />
            <div className="grid gap-3">
              {[0, 1, 2].map(index => <Skeleton key={index} className="h-11" />)}
            </div>
            <div className="grid gap-3 border-t pt-4">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-36" />
            </div>
          </Card>
        </div>
        <div className="grid gap-6 @min-[880px]:grid-cols-2">
          {[0, 1].map(index => (
            <Card key={index}>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-16" />
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
