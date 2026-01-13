"use client";

interface GooglePreviewProps {
  title: string;
  description: string;
  url: string;
}

export function GooglePreview({ title, description, url }: GooglePreviewProps) {
  // Truncate title to ~60 chars and description to ~160 chars
  const displayTitle =
    title.length > 60 ? title.substring(0, 57) + "..." : title;
  const displayDescription =
    description.length > 160
      ? description.substring(0, 157) + "..."
      : description;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-xs text-slate-500 mb-2">Search Preview</p>
      <div className="space-y-1">
        {/* URL */}
        <p className="text-sm text-green-700 truncate">{url}</p>
        {/* Title */}
        <h3 className="text-xl text-blue-800 hover:underline cursor-pointer leading-tight">
          {displayTitle || "Page Title"}
        </h3>
        {/* Description */}
        <p className="text-sm text-slate-600 leading-relaxed">
          {displayDescription || "Page description will appear here..."}
        </p>
      </div>

      {/* Character counters */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs">
        <span
          className={title.length > 60 ? "text-orange-600" : "text-slate-500"}
        >
          Title: {title.length}/60
        </span>
        <span
          className={
            description.length > 160 ? "text-orange-600" : "text-slate-500"
          }
        >
          Description: {description.length}/160
        </span>
      </div>
    </div>
  );
}
