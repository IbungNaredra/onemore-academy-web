/** PRD v2.2 — fixed division dropdown (display strings). */
export const DIVISIONS = [
  "中台-安全",
  "中台-服務器",
  "中台-數分",
  "中台-運營",
  "中台-GRE",
  "中台-QA",
  "中台-Roblox",
  "中台-Sound",
  "中台-TA",
  "中台-UED",
  "中台-Web",
  "Admin",
  "AOV研發",
  "FF Ops",
  "FF研發",
  "GI",
  "GNG Ops",
  "GNG研發",
  "KTD",
  "Product Strategy",
  "THS",
  "Others",
] as const;

export type Division = (typeof DIVISIONS)[number];

export function isValidDivision(d: string): d is Division {
  return (DIVISIONS as readonly string[]).includes(d);
}
