import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminLoading() {
  return (
    <div className="bg-[#0a0a0b] min-h-screen">
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 bg-white/[0.04] rounded-md mb-2" />
          <Skeleton className="h-4 w-64 bg-white/[0.04] rounded-md" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[52px] bg-white/[0.04] rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[52px] bg-white/[0.04] rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <Skeleton className="col-span-12 lg:col-span-7 h-64 bg-white/[0.04] rounded-md" />
          <Skeleton className="col-span-12 lg:col-span-5 h-64 bg-white/[0.04] rounded-md" />
        </div>
      </div>
    </div>
  );
}
