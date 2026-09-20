import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminLoading() {
  return (
    <div className="bg-zinc-50 dark:bg-[#0a0a0b] min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 rounded-md mb-2 bg-zinc-300 dark:bg-white/[0.06]" />
          <Skeleton className="h-4 w-64 rounded-md bg-zinc-300 dark:bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[52px] rounded-md bg-zinc-200 dark:bg-white/[0.04]" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[52px] rounded-md bg-zinc-200 dark:bg-white/[0.04]" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 lg:col-span-7 h-64 rounded-md bg-zinc-200 dark:bg-white/[0.04]" />
          <Skeleton className="col-span-12 lg:col-span-5 h-64 rounded-md bg-zinc-200 dark:bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}
