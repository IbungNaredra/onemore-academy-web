"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

function navClass(active: boolean) {
  return `nav-link${active ? " active" : ""}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [signOutPending, setSignOutPending] = useState(false);
  const isInfo = pathname === "/info" || pathname === "/";
  const isLeaderboard = pathname === "/leaderboard";
  const isFinalist = pathname === "/finalist";
  const isVoteQueue = pathname === "/vote" || pathname.startsWith("/vote/");
  const isSubmitUgc = pathname === "/submit";
  const role = session?.user?.role;
  const isAdmin = role === "admin";
  const showFinalistNav = isAdmin || role === "internal_team";
  /** Participants + fallback voters + internal team (not admins). */
  const showVoteQueue = Boolean(session && !isAdmin);
  /** Participants + fallback voters only — not admin or internal team. */
  const showSubmitUgc = Boolean(session && !isAdmin && role !== "internal_team");

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <Link href="/info" className="brand-logo-link" aria-label="onemore challenge — Challenge info">
            <Image
              src="/onemore-logo.png"
              alt=""
              width={80}
              height={100}
              className="brand-logo-img"
              priority
            />
          </Link>
          <div className="brand-text">
            <h1 className="brand-title">onemore challenge</h1>
            <p className="brand-tagline">Prompt your creativity and get rewards</p>
          </div>
        </div>
        <nav className="nav-tabs" aria-label="Main navigation">
          <Link href="/info" className={navClass(isInfo)}>
            Challenge info
          </Link>
          <Link href="/leaderboard" className={navClass(isLeaderboard)}>
            Leaderboard
          </Link>
          {showFinalistNav && (
            <Link href="/finalist" className={navClass(isFinalist)}>
              Finalist pool
            </Link>
          )}
          {showVoteQueue && (
            <Link href="/vote" className={navClass(isVoteQueue)}>
              Vote queue
            </Link>
          )}
          {showSubmitUgc && (
            <Link href="/submit" className={navClass(isSubmitUgc)}>
              Submit UGC
            </Link>
          )}
          {isAdmin && (
            <>
              <Link href="/admin/users" className={navClass(pathname === "/admin/users")}>
                Users
              </Link>
              <Link href="/admin/batch" className={navClass(pathname === "/admin/batch")}>
                Batches
              </Link>
              <Link href="/admin/submissions" className={navClass(pathname === "/admin/submissions")}>
                Submissions
              </Link>
              <Link href="/admin/winners" className={navClass(pathname === "/admin/winners")}>
                Winners
              </Link>
            </>
          )}
          {status === "loading" ? (
            <span className="nav-link nav-link--pending" aria-busy="true">
              …
            </span>
          ) : session ? (
            <button
              type="button"
              className={`nav-link${signOutPending ? " form-submit-btn--pending" : ""}`}
              disabled={signOutPending}
              aria-busy={signOutPending}
              onClick={() => {
                setSignOutPending(true);
                void signOut({ callbackUrl: "/" });
              }}
            >
              {signOutPending ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link href="/auth" className={navClass(pathname === "/auth")}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
