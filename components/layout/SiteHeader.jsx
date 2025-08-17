"use client";
import { useState } from "react";
import Link from "next/link";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[radial-gradient(1200px_400px_at_50%_-10%,rgba(59,130,246,.25),transparent)] backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link href="/" className="group">
          <span className="block text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400">
            Smart Freight &amp; Storage Planner
          </span>
          <span className="block h-px w-full bg-gradient-to-r from-transparent via-sky-400/50 to-transparent scale-x-100 group-hover:scale-x-105 transition-transform" />
        </Link>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/login"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/5 transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-sky-400 transition shadow-sm"
          >
            Sign up
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:text-white hover:bg-white/10 transition"
          aria-label="Toggle menu"
        >
          {/* simple hamburger / close */}
          <svg
            className={`h-6 w-6 ${open ? "hidden" : "block"}`}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
          <svg
            className={`h-6 w-6 ${open ? "block" : "hidden"}`}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`sm:hidden overflow-hidden transition-[max-height] ${open ? "max-h-40" : "max-h-0"}`}>
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/90 hover:bg-white/5 transition"
              onClick={() => setOpen(false)}
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400 transition shadow-sm"
              onClick={() => setOpen(false)}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
