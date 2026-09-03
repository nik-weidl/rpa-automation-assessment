"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UploadPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="container section center-align font-sans py-20 text-slate-500 text-sm">
      Redirecting to unified home dashboard...
    </div>
  );
}
