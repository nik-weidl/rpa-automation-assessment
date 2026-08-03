"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="teal darken-1 z-depth-1 font-sans">
      <div className="nav-wrapper container flex items-center justify-start gap-6 h-full">
        {/* Title (far left) */}
        <Link 
          href="/" 
          className="uppercase font-bold tracking-wide flex items-center text-white" 
          style={{ fontSize: "18px", height: "64px", margin: 0, fontWeight: "bold" }}
        >
          <i className="material-icons left text-teal-200" style={{ margin: "0 6px 0 0" }}>flash_on</i>
          RPA Assessment
        </Link>

        {/* Navigation buttons (right of title) */}
        <ul className="flex items-center gap-4 m-0 h-full">
          <li className={pathname === "/upload" ? "active" : ""}>
            <Link 
              href="/upload" 
              className="valign-wrapper uppercase tracking-wider font-semibold text-xs px-4 hover:bg-black/10 transition-colors" 
              style={{ display: "flex", gap: "6px", alignItems: "center", height: "64px" }}
            >
              <i className="material-icons" style={{ margin: 0 }}>cloud_upload</i>
              Upload
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
