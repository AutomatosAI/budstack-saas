export const parseToArray = (str?: string): string[] => {
  if (!str) return [];
  return str
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};
