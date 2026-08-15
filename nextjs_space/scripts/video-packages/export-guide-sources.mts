import { GUIDES } from "../../lib/documents/registry";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "./video-sources-out";
mkdirSync(OUT, { recursive: true });

for (const g of GUIDES) {
  if (g.status !== "published") continue;
  const lines: string[] = [];
  lines.push(`# ${g.title} — BudStacks Guide, Part ${g.part}`);
  lines.push(`\n${g.summary}\n\nAdmin location: ${g.adminPath}\n`);
  for (const s of g.sections) {
    lines.push(`\n## ${s.title}${s.pro ? " (Pro plan feature)" : ""}`);
    lines.push(`\nWhat it's for: ${s.whatFor}\n`);
    lines.push(`What it does:`);
    for (const d of s.does) lines.push(`- ${d}`);
    for (const w of s.walkthroughs ?? []) {
      lines.push(`\nStep-by-step: ${w.title}`);
      w.steps.forEach((st, i) => {
        lines.push(`${i + 1}. ${st.text}${st.note ? ` (${st.note})` : ""}`);
      });
    }
    lines.push(`\nWhy it matters: ${s.why}`);
    if (s.notes?.length) {
      lines.push(`Honest notes:`);
      for (const n of s.notes) lines.push(`- ${n}`);
    }
  }
  writeFileSync(`${OUT}/part-${String(g.part).padStart(2, "0")}-${g.slug}.md`, lines.join("\n"));
}
console.log("exported", GUIDES.filter(g => g.status === "published").length, "guide sources to", OUT);
