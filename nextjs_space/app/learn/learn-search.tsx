"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function LearnSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/learn?q=${encodeURIComponent(query.trim())}`);
      } else {
        router.push("/learn");
      }
    },
    [query, router],
  );

  return (
    <form onSubmit={handleSearch} className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search docs and guides..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-11 h-12 rounded-xl bg-bs-input border-bs-border text-bs-fg placeholder:text-bs-fg-muted shadow-sm focus:border-bs-green/30 focus:ring-2 focus:ring-bs-green/10"
      />
    </form>
  );
}
