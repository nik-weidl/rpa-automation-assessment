"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ProcessLog } from "@/types/models";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedLogs, setUploadedLogs] = useState<ProcessLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files) {
      handleFiles(files);
    }
  };

  const handleFiles = async (files: FileList) => {
    const file = files[0];

    if (!file.name.endsWith(".xes")) {
      setError("Only .xes files are allowed");
      return;
    }

    // just to be safe, check file size
    if (file.size > 100 * 1024 * 1024) {
      setError("File too large (max 100MB)");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("processName", file.name.replace(".xes", ""));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setSuccess(`Process "${result.data.name}" uploaded successfully!`);
      setUploadedLogs([result.data, ...uploadedLogs]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh list
      fetchUploadedLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchUploadedLogs = async () => {
    try {
      const response = await fetch("/api/upload");
      const result = await response.json();

      if (result.success) {
        setUploadedLogs(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  return (
    <div className="space-y-8 p-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold">Import XES Event Logs</h1>
        <p className="text-muted-foreground mt-2">Upload process mining event logs in XES format</p>
      </div>

      {/* Drag-and-Drop Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload XES File</CardTitle>
          <CardDescription>Drag and drop or click to select</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
              isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".xes"
              className="hidden"
              disabled={isUploading}
            />

            <div onClick={() => fileInputRef.current?.click()} className="space-y-4">
              <div className="text-5xl">📁</div>
              <div>
                <p className="text-lg font-semibold">Drop XES file here</p>
                <p className="text-sm text-muted-foreground">or click to browse (max 100MB)</p>
              </div>

              {isUploading && <p className="text-sm text-blue-600">Uploading...</p>}
            </div>
          </div>

          {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">{success}</div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Logs List */}
      {uploadedLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Processes</CardTitle>
            <CardDescription>{uploadedLogs.length} process log(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadedLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                  <div>
                    <p className="font-semibold">{log.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.fileName} • {(log.fileSize / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Link href={`/dashboard?processId=${log.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
