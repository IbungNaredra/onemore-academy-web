import Link from "next/link";

export type JudgeLaneNavActive = "hub" | "mini" | "interactive";

export function JudgeLaneNav({ active }: { active: JudgeLaneNavActive }) {
  return (
    <nav className="judge-lane-nav" aria-label="Voting by content type">
      <Link href="/judge" className={`judge-lane-link${active === "hub" ? " judge-lane-link-active" : ""}`}>
        Overview
      </Link>
      <Link
        href="/judge/mini-games"
        className={`judge-lane-link${active === "mini" ? " judge-lane-link-active" : ""}`}
      >
        Mini Games
      </Link>
      <Link
        href="/judge/interactive"
        className={`judge-lane-link${active === "interactive" ? " judge-lane-link-active" : ""}`}
      >
        Interactive
      </Link>
    </nav>
  );
}
