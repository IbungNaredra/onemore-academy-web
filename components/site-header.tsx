"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navClass(active: boolean) {
  return `nav-link${active ? " active" : ""}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isLeaderboard = pathname === "/leaderboard" || pathname.startsWith("/leaderboard/");

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-badge">Shanghai</span>
          <div>
            <h1 className="brand-title">onemore challenge</h1>
            <p className="brand-tagline">Prompt your creativity and get rewards</p>
          </div>
        </div>
        <nav className="nav-tabs" aria-label="Main navigation">
          <Link href="/" className={navClass(isHome)}>
            About &amp; rules
          </Link>
          <Link href="/leaderboard" className={navClass(isLeaderboard)}>
            Weekly winners
          </Link>
        </nav>
      </div>
    </header>
  );
}
