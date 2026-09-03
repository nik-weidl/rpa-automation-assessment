"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import Link from "next/link";

interface AssessmentSummary {
  id: string;
  type: string;
  model?: string;
  costUsd?: number | null;
  score: number;
}

interface ProcessLogSummary {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  _count?: {
    activities: number;
    traces: number;
    assessments: number;
  };
  assessments?: AssessmentSummary[];
  activities?: Array<{ id: string; name: string }>;
}

export default function Home() {
  const [logs, setLogs] = useState<ProcessLogSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsingMessage, setParsingMessage] = useState("Preparing upload...");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [renamingIds, setRenamingIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/process-logs");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch process logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute aggregate stats across dataset
  const totalLogs = logs.length;
  const totalTraces = logs.reduce((sum, l) => sum + (l._count?.traces || 0), 0);
  const totalEvaluations = logs.reduce((sum, l) => sum + (l._count?.assessments || (l.assessments?.length || 0)), 0);

  // Compute total money burned ($ USD)
  const allAssessments = logs.flatMap((l) => l.assessments || []);
  const totalMoneyBurnedUsd = allAssessments.reduce((sum, a) => sum + (a.costUsd || 0), 0);

  // Helper to format cost in standard USD format
  const formatUsd = (val: number) => {
    if (val === 0) return "$0.0000";
    if (val < 0.01) return `$${val.toFixed(4)} (${(val * 100).toFixed(2)}¢)`;
    return `$${val.toFixed(4)}`;
  };

  // Drag and Drop handlers
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
    if (!file) return;

    const processName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim() || file.name;

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setParsingMessage("Initiating log ingestion...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("processName", processName.trim());

      const res = await fetch("/api/upload/stream", {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to start processing stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event = JSON.parse(trimmed.replace(/^data:\s*/, ""));
              if (event.type === "progress") {
                setUploadProgress(event.percent);
                setParsingMessage(event.message);
              } else if (event.type === "complete") {
                setSuccess(`Successfully ingested process log "${processName}"!`);
                await fetchLogs();
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (pErr: any) {
              if (pErr.message && !pErr.message.includes("Unexpected token")) {
                throw pErr;
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload process log");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (id: string) => {
    const logToDelete = logs.find((l) => l.id === id);
    if (!confirm(`Are you sure you want to delete "${logToDelete?.name || "this process log"}"?`)) {
      return;
    }

    setDeletingIds((prev) => [...prev, id]);
    try {
      const res = await fetch("/api/process-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete log");
      }
      setSuccess("Process log deleted successfully.");
      setLogs((prev) => prev.filter((log) => log.id !== id));
    } catch (err: any) {
      setError(err.message || "Delete failed");
    } finally {
      setDeletingIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleRename = async (log: ProcessLogSummary) => {
    const newFileName = prompt("Enter a new file display name:", log.fileName);
    if (!newFileName || newFileName.trim() === "" || newFileName === log.fileName) return;

    setRenamingIds((prev) => [...prev, log.id]);
    try {
      const res = await fetch("/api/process-logs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, fileName: newFileName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rename log");
      }
      setSuccess("Process log renamed successfully.");
      setLogs((prev) =>
        prev.map((item) => (item.id === log.id ? { ...item, fileName: newFileName.trim() } : item))
      );
    } catch (err: any) {
      setError(err.message || "Rename failed");
    } finally {
      setRenamingIds((prev) => prev.filter((i) => i !== log.id));
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container section font-sans" style={{ marginTop: "20px", marginBottom: "60px" }}>
      {/* Title & Brief Tool Description */}
      <div className="row center-align" style={{ marginBottom: "25px" }}>
        <div className="col s12">
          <h1 className="text-2xl md:text-4xl font-light grey-text text-darken-3 uppercase tracking-wide" style={{ margin: 0 }}>
            Agentic <span className="teal-text text-darken-1 font-bold">RPA Assessment Tool</span>
          </h1>
          <p className="grey-text text-darken-1 font-light max-w-2xl mx-auto text-sm leading-relaxed" style={{ fontSize: "15px", marginTop: "10px" }}>
            Ingest process mining event logs (IEEE XES), model transition pathways in custom graphics, and assess automation potential with advanced agentic thought flows.
          </p>
        </div>
      </div>

      {/* 1. Global Summary Metrics Strip */}
      <div className="row">
        <div className="col s12 m3">
          <div className="card-panel center-align" style={{ padding: "18px", borderTop: "4px solid #e53935" }}>
            <i className="material-icons red-text text-darken-1 text-2xl">attach_money</i>
            <h5 className="font-bold grey-text text-darken-3" style={{ margin: "4px 0 0 0" }}>
              {isLoading ? "..." : formatUsd(totalMoneyBurnedUsd)}
            </h5>
            <span className="text-xs uppercase font-semibold text-slate-500">Money Burned (LLM Cost)</span>
          </div>
        </div>

        <div className="col s12 m3">
          <div className="card-panel center-align" style={{ padding: "18px", borderTop: "4px solid #7e22ce" }}>
            <i className="material-icons purple-text text-darken-1 text-2xl">psychology</i>
            <h5 className="font-bold grey-text text-darken-3" style={{ margin: "4px 0 0 0" }}>
              {isLoading ? "..." : totalEvaluations}
            </h5>
            <span className="text-xs uppercase font-semibold text-slate-500">Evaluations Run</span>
          </div>
        </div>

        <div className="col s12 m3">
          <div className="card-panel center-align" style={{ padding: "18px", borderTop: "4px solid #00897b" }}>
            <i className="material-icons teal-text text-darken-1 text-2xl">folder</i>
            <h5 className="font-bold grey-text text-darken-3" style={{ margin: "4px 0 0 0" }}>
              {isLoading ? "..." : totalLogs}
            </h5>
            <span className="text-xs uppercase font-semibold text-slate-500">Process Logs</span>
          </div>
        </div>

        <div className="col s12 m3">
          <div className="card-panel center-align" style={{ padding: "18px", borderTop: "4px solid #ef6c00" }}>
            <i className="material-icons orange-text text-darken-3 text-2xl">alt_route</i>
            <h5 className="font-bold grey-text text-darken-3" style={{ margin: "4px 0 0 0" }}>
              {isLoading ? "..." : totalTraces.toLocaleString()}
            </h5>
            <span className="text-xs uppercase font-semibold text-slate-500">Process Traces</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="card-panel red lighten-5 red-text text-darken-4 font-semibold text-xs flex justify-between items-center" style={{ padding: "12px 20px" }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="btn-flat red-text text-darken-4 font-black">✕</button>
        </div>
      )}

      {success && (
        <div className="card-panel green lighten-5 green-text text-darken-4 font-semibold text-xs flex justify-between items-center" style={{ padding: "12px 20px" }}>
          <span>✓ {success}</span>
          <button onClick={() => setSuccess(null)} className="btn-flat green-text text-darken-4 font-black">✕</button>
        </div>
      )}

      {/* 2. Upload New Process Log Card */}
      <div className="row">
        <div className="col s12">
          <div className="card hoverable border border-slate-200" style={{ borderRadius: "4px" }}>
            <div className="card-content" style={{ padding: "20px" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <i className="material-icons teal-text text-darken-1" style={{ float: "none", margin: 0, fontSize: "22px" }}>cloud_upload</i>
                  <span className="card-title font-bold uppercase tracking-wider text-slate-800" style={{ fontSize: "15px", margin: 0, lineHeight: 1.2 }}>
                    Ingest Process Log File
                  </span>
                </div>
                <span className="text-xs grey-text text-darken-1 font-light">Max file size: 500MB</span>
              </div>

              <div
                className={`card-panel ${isDragging ? "teal lighten-5 border-2 border-dashed border-teal-500" : "grey lighten-5"} cursor-pointer hover:bg-teal-50/40 transition-all`}
                style={{ padding: "28px 20px", margin: 0, border: "2px dashed #b2dfdb", borderRadius: "4px" }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 rounded-full teal lighten-5 text-teal-700 flex items-center justify-center mb-2 border border-teal-200">
                    <i className="material-icons" style={{ float: "none", margin: 0, fontSize: "22px" }}>file_upload</i>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    accept=".xes,.gz,.xml,.json"
                    style={{ display: "none" }}
                  />

                  <p className="font-bold text-slate-800 uppercase tracking-wider text-xs" style={{ margin: "4px 0 4px 0" }}>
                    {isDragging ? "Drop your XES file here" : "Drag & Drop XES File Here (or click anywhere to browse)"}
                  </p>

                  <p className="text-xs grey-text text-darken-1 font-light" style={{ margin: 0 }}>
                    Supports IEEE XES (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.xes</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.xes.gz</code>), <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.xml</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.json</code>
                  </p>
                </div>

                {isUploading && (
                  <div className="mt-5 w-full max-w-lg mx-auto text-left bg-white border border-teal-200 p-4 rounded-sm shadow-sm space-y-2.5 cursor-default" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="text-teal-800 font-bold uppercase tracking-wider text-[11px]">
                        {uploadProgress < 100 ? `Processing Log (${uploadProgress}%)` : "Finalizing..."}
                      </span>
                      <span className="font-mono text-teal-700 text-[11px] font-bold">
                        {uploadProgress}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 shadow-inner">
                      <div
                        className="h-full bg-teal-600 transition-all duration-300 shadow-xs"
                        style={{ width: `${Math.max(3, uploadProgress)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-700 font-mono pt-0.5">
                      <span className="font-medium text-slate-750">{parsingMessage}</span>
                      <span className="text-slate-400 font-semibold">{uploadProgress === 100 ? "Done!" : "In Progress..."}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Ingested Process Logs Database UI (Clean Structured Table View) */}
      <div className="row">
        <div className="col s12">
          <div className="card hoverable border border-slate-200" style={{ borderRadius: "4px" }}>
            <div className="card-content" style={{ padding: "20px" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <i className="material-icons teal-text text-darken-1" style={{ float: "none", margin: 0, fontSize: "22px" }}>inventory_2</i>
                    <span className="card-title font-bold uppercase text-slate-800" style={{ fontSize: "15px", margin: 0, lineHeight: 1.2 }}>
                      Ingested Process Logs Database ({filteredLogs.length})
                    </span>
                  </div>
                  <p className="grey-text text-darken-1 font-light text-xs" style={{ margin: "4px 0 0 0" }}>
                    Manage process logs, view activity counts, evaluation status, and money burned.
                  </p>
                </div>

                {/* Quick Search Bar */}
                {logs.length > 0 && (
                  <div className="relative flex items-center" style={{ width: "240px" }}>
                    <input
                      type="text"
                      placeholder="Search process logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-1 bg-white border border-slate-300 rounded text-xs grey-text text-darken-3 focus:outline-none focus:border-teal-500"
                      style={{ height: "34px", margin: 0, borderBottom: "1px solid #cbd5e1", outline: "none", boxShadow: "none" }}
                    />
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="center-align py-8 text-slate-400 font-light text-sm">
                  Loading process log database...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="center-align py-8 grey-text text-darken-1">
                  <i className="material-icons medium grey-text">find_in_page</i>
                  <p className="font-semibold uppercase text-sm" style={{ marginTop: "10px" }}>No Process Logs Found</p>
                  <p className="text-xs font-light">Upload an XES file above to start analyzing process logs.</p>
                </div>
              ) : (
                <div className="responsive-table">
                  <table className="highlight stripe border-collapse" style={{ width: "100%", fontSize: "13px" }}>
                    <thead>
                      <tr className="grey lighten-4 border-b border-slate-200 text-xs text-slate-600 uppercase font-bold tracking-wider">
                        <th style={{ padding: "12px 16px" }}>Process Log Name</th>
                        <th style={{ padding: "12px 16px" }}>Structure</th>
                        <th style={{ padding: "12px 16px" }}>Evaluations</th>
                        <th style={{ padding: "12px 16px" }}>Money Burned</th>
                        <th style={{ padding: "12px 16px" }}>Status</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const logAssessments = log.assessments || [];
                        const logEvaluationsCount = log._count?.assessments || logAssessments.length;
                        const logCost = logAssessments.reduce((sum, a) => sum + (a.costUsd || 0), 0);
                        const logNodeCount = log._count?.activities || log.activities?.length || 0;
                        const logTraceCount = log._count?.traces || 0;
                        const isDeleting = deletingIds.includes(log.id);
                        const isRenaming = renamingIds.includes(log.id);

                        return (
                          <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            {/* 1. Name & File */}
                            <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                              <div className="font-semibold text-slate-800 text-sm">{log.name}</div>
                              <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                <span>{log.fileName}</span>
                                <span>•</span>
                                <span>{(log.fileSize / 1024).toFixed(1)} KB</span>
                              </div>
                            </td>

                            {/* 2. Structure Metrics */}
                            <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {logNodeCount} Activities
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {logTraceCount} Traces
                                </span>
                              </div>
                            </td>

                            {/* 3. Evaluations Count */}
                            <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                              <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold text-xs">
                                {logEvaluationsCount} Run(s)
                              </span>
                            </td>

                            {/* 4. Money Burned */}
                            <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                              <span className="px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 font-bold text-xs">
                                {formatUsd(logCost)}
                              </span>
                            </td>

                            {/* 5. Status Badge */}
                            <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                              <span
                                className="badge white-text font-semibold text-xs uppercase"
                                style={{
                                  position: "relative",
                                  float: "none",
                                  margin: 0,
                                  padding: "2px 8px",
                                  borderRadius: "2px",
                                  backgroundColor: log.status === "READY" ? "#00897b" : "#fb8c00",
                                }}
                              >
                                {log.status}
                              </span>
                            </td>

                            {/* 6. Action Toolbar */}
                            <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right" }}>
                              <div className="flex items-center justify-end gap-2">
                                <Link href={`/process-log/${log.id}`} className={log.status !== "READY" ? "pointer-events-none" : ""}>
                                  <button
                                    disabled={log.status !== "READY"}
                                    className="btn waves-effect waves-light teal darken-1 text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:pointer-events-none disabled:shadow-none"
                                    style={{ height: "30px", lineHeight: "30px", fontSize: "11px", display: "inline-flex", alignItems: "center", padding: "0 12px" }}
                                  >
                                    <i className="material-icons left text-sm" style={{ margin: "0 2px 0 0", fontSize: "15px" }}>play_arrow</i>
                                    <span>Explorer</span>
                                  </button>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() => handleRename(log)}
                                  disabled={isRenaming}
                                  className="btn-flat waves-effect text-slate-700 text-xs font-semibold uppercase tracking-wider cursor-pointer"
                                  style={{ height: "30px", lineHeight: "30px", fontSize: "11px", padding: "0 8px", border: "1px solid #e0e0e0" }}
                                  title="Rename Process Log"
                                >
                                  <i className="material-icons text-sm">edit</i>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(log.id)}
                                  disabled={isDeleting}
                                  className="btn-flat waves-effect text-red-600 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-red-50"
                                  style={{ height: "30px", lineHeight: "30px", fontSize: "11px", padding: "0 8px", border: "1px solid #ffcdd2" }}
                                  title="Delete Process Log"
                                >
                                  {isDeleting ? "..." : <i className="material-icons text-sm text-red-600">delete</i>}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Master Thesis Attribution */}
      <div className="row center-align" style={{ marginTop: "40px", marginBottom: "10px" }}>
        <div className="col s12">
          <p className="grey-text text-darken-1 font-light text-xs" style={{ margin: 0 }}>
            Developed by <strong className="teal-text text-darken-2 font-semibold">Niklas Weidl</strong> for Master Thesis Research @ Ulm University in 2026
          </p>
        </div>
      </div>
    </div>
  );
}
