export function AnalyticsLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-bs-border rounded-full"></div>
          <div className="absolute inset-0 border-4 border-bs-green-soft border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-bs-fg-muted font-medium">
          Loading your garden of insights...
        </p>
      </div>
    </div>
  );
}
