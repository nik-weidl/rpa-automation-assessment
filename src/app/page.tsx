"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900">
            Agentic RPA Assessment Tool
          </h1>
          <p className="text-xl text-gray-600">
            Analyze process mining event logs and evaluate automation potential with AI-powered insights
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/upload">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
