"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-lg">
            RPA Assessment
          </Link>
          <div className="flex gap-4">
            <Link href="/upload">
              <Button variant={pathname === "/upload" ? "default" : "ghost"} size="sm">
                Upload
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
