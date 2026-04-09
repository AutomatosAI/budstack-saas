import { Skeleton } from "@/components/ui/skeleton";

export default function StoreLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero skeleton */}
      <Skeleton className="w-full h-[60vh]" />

      {/* Content sections */}
      <div className="container mx-auto px-4 py-12 space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
