"use client";

import dynamic from "next/dynamic";

const AutomatosWidgetWrapper = dynamic(
  () =>
    import("@/components/admin/AutomatosWidgetWrapper").then(
      (mod) => mod.AutomatosWidgetWrapper,
    ),
  { ssr: false },
);

export function LearnChatbot({
  apiKey,
  agentId,
}: {
  apiKey: string;
  agentId?: number;
}) {
  return (
    <AutomatosWidgetWrapper
      apiKey={apiKey}
      agentId={agentId}
      position="bottom-right"
      theme="light"
      title="BudStacks Docs Assistant"
      greeting="Hi! I can help you find answers in our documentation. What are you looking for?"
    />
  );
}
