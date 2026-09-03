"use client";

import Link from "next/link";

export function Navigation() {
  return (
    <nav className="teal darken-1 z-depth-1 font-sans">
      <div className="nav-wrapper container flex items-center justify-center h-full text-center">
        {/* Centered Title */}
        <Link 
          href="/" 
          className="uppercase font-bold tracking-wide flex items-center justify-center text-white hover:text-teal-100 transition-colors" 
          style={{ fontSize: "18px", height: "64px", margin: 0, fontWeight: "bold" }}
          title="Click to return to main landing page"
        >
          RPA Assessment Tool
        </Link>
      </div>
    </nav>
  );
}
