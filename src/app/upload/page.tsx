"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import Link from "next/link";
import { ProcessLog } from "@/types/models";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedLogs, setUploadedLogs] = useState<ProcessLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [renamingIds, setRenamingIds] = useState<string[]>([]);
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

  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsingMessage, setParsingMessage] = useState("Preparing upload...");
  const [uploadDetails, setUploadDetails] = useState<{
    loadedBytes: number;
    totalBytes: number;
    uploadSpeedMb: number;
    stage: "UPLOADING" | "PARSING";
  } | null>(null);

  const uploadWithXhr = (formData: FormData, fileSize: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.min(99, Math.round((event.loaded / event.total) * 100));
          const elapsedTimeSecs = (Date.now() - startTime) / 1000;
          const loadedMb = event.loaded / (1024 * 1024);
          const uploadSpeedMb = elapsedTimeSecs > 0 ? loadedMb / elapsedTimeSecs : 0;

          setUploadProgress(percentComplete);
          setParsingMessage(`Uploading file: ${(event.loaded / (1024 * 1024)).toFixed(1)} MB / ${(event.total / (1024 * 1024)).toFixed(1)} MB`);
          setUploadDetails({
            loadedBytes: event.loaded,
            totalBytes: event.total,
            uploadSpeedMb,
            stage: "UPLOADING",
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res);
          } catch (e) {
            reject(new Error("Failed to parse server response"));
          }
        } else {
          try {
            const res = JSON.parse(xhr.responseText);
            reject(new Error(res.error || `Upload failed (Status ${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (Status ${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error during file upload"));
      xhr.ontimeout = () => reject(new Error("Upload request timed out (10 min limit exceeded)"));

      xhr.open("POST", "/api/upload/stream");
      xhr.timeout = 600000; // 10 minutes timeout for huge 200MB+ file uploads
      xhr.send(formData);
    });
  };

  const uploadWithStream = async (file: File, processName: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("processName", processName);

    setParsingMessage("Initiating streaming upload...");

    const response = await fetch("/api/upload/stream", {
      method: "POST",
      body: formData,
    });

    if (!response.ok || !response.body) {
      throw new Error("Failed to initiate processing stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completedData: any = null;

    setUploadDetails({
      loadedBytes: file.size,
      totalBytes: file.size,
      uploadSpeedMb: 0,
      stage: "PARSING",
    });

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
              completedData = event.data;
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes("JSON")) {
              throw parseErr;
            }
          }
        }
      }
    }

    if (!completedData) {
      throw new Error("Upload processing completed without log data");
    }

    return completedData;
  };

  const handleFiles = async (files: FileList) => {
    const file = files[0];

    if (!file.name.endsWith(".xes")) {
      setError("Only .xes files are allowed");
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setError("File too large (max 500MB)");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadDetails(null);

    try {
      const processName = file.name.replace(".xes", "");
      const resultData = await uploadWithStream(file, processName);

      setSuccess(`Process "${resultData.name}" uploaded and parsed successfully!`);
      setUploadedLogs([resultData, ...uploadedLogs]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchUploadedLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadDetails(null);
    }
  };

  const fetchUploadedLogs = async () => {
    try {
      const response = await fetch("/api/process-logs");
      const result = await response.json();

      if (result.success) {
        setUploadedLogs(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  useEffect(() => {
    fetchUploadedLogs();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this uploaded log and its file?")) {
      return;
    }

    setDeletingIds((prev) => [...prev, id]);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/process-logs", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Delete failed");
      }

      setSuccess("Uploaded log deleted successfully.");
      setUploadedLogs((prev) => prev.filter((log) => log.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingIds((prev) => prev.filter((current) => current !== id));
    }
  };

  const handleRename = async (log: ProcessLog) => {
    const currentName = log.fileName || "";
    const newNameInput = prompt("Enter the new file name", currentName);
    if (!newNameInput || newNameInput.trim() === currentName) {
      return;
    }

    let newFileName = newNameInput.trim();
    if (!newFileName.toLowerCase().endsWith(".xes")) {
      newFileName += ".xes";
    }

    setRenamingIds((prev) => [...prev, log.id]);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/process-logs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: log.id, fileName: newFileName }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Rename failed");
      }

      setSuccess("Uploaded file renamed successfully.");
      setUploadedLogs((prev) => prev.map((item) => (item.id === log.id ? result.data : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setRenamingIds((prev) => prev.filter((current) => current !== log.id));
    }
  };

  return (
    <div className="container section font-sans grey-text text-darken-3">
      <div className="row">
        <div className="col s12">
          <h4 className="grey-text text-darken-3 font-light uppercase tracking-wide flex items-center gap-2">
            <i className="material-icons medium teal-text text-darken-1">cloud_upload</i>
            Import XES Event Logs
          </h4>
          <p className="grey-text text-darken-1 font-light" style={{ fontSize: "14px", marginTop: "5px" }}>
            Ingest and store event transaction traces to evaluate candidate activities for RPA.
          </p>
        </div>
      </div>

      {/* Drag-and-Drop Area Card */}
      <div className="row">
        <div className="col s12">
          <div className="card hoverable">
            <div className="card-content">
              <span className="card-title font-semibold uppercase text-slate-800" style={{ fontSize: "16px" }}>Upload XES File</span>
              <p className="grey-text text-darken-1 font-light text-xs" style={{ marginBottom: "20px" }}>Drag and drop files directly or select them manually.</p>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="center-align cursor-pointer"
                style={{
                  border: "2px dashed #00897b",
                  backgroundColor: isDragging ? "rgba(0, 137, 123, 0.05)" : "#fafafa",
                  padding: "50px 20px",
                  borderRadius: "2px",
                  transition: "all 0.2s"
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                  accept=".xes"
                  className="hidden"
                  disabled={isUploading}
                />

                <div 
                  className="btn-floating btn-large white teal-text text-darken-1 z-depth-1"
                  style={{ marginBottom: "15px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <i className="material-icons teal-text text-darken-1" style={{ fontSize: "30px", lineHeight: "56px" }}>insert_drive_file</i>
                </div>

                <p className="font-semibold uppercase tracking-wider text-slate-850 text-xs" style={{ margin: "5px 0" }}>Drop XES log file here</p>
                <p className="grey-text text-darken-1 font-light text-xs" style={{ margin: 0 }}>or click to browse local files (max 500MB)</p>

                {isUploading && (
                  <div className="mt-5 w-full max-w-lg mx-auto text-left bg-white border border-teal-200 p-4 rounded-sm shadow-sm space-y-2.5 cursor-default" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span className="flex items-center gap-2">
                        <div className="preloader-wrapper small active" style={{ width: "16px", height: "16px" }}>
                          <div className="spinner-layer stroke-teal">
                            <div className="circle-clipper left"><div className="circle"></div></div>
                          </div>
                        </div>
                        <span className="text-teal-800 font-bold uppercase tracking-wider text-[11px]">
                          {uploadProgress < 100 ? `Processing Log (${uploadProgress}%)` : "Finalizing..."}
                        </span>
                      </span>
                      <span className="font-mono text-teal-700 text-[11px] font-bold">
                        {uploadProgress}%
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 shadow-inner">
                      <div
                        className="h-full bg-teal-600 transition-all duration-300 shadow-xs"
                        style={{ width: `${Math.max(3, uploadProgress)}%` }}
                      ></div>
                    </div>

                    {/* Live Server Parsing Status Message */}
                    <div className="flex items-center justify-between text-[11px] text-slate-700 font-mono pt-0.5">
                      <span className="font-medium text-slate-750">{parsingMessage}</span>
                      <span className="text-slate-400 font-semibold">{uploadProgress === 100 ? "Done!" : "In Progress..."}</span>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="card-panel red lighten-5 red-text text-darken-4 font-semibold text-xs" style={{ marginTop: "20px", padding: "12px" }}>
                  <span>⚠️ {error}</span>
                </div>
              )}

              {success && (
                <div className="card-panel green lighten-5 green-text text-darken-4 font-semibold text-xs" style={{ marginTop: "20px", padding: "12px" }}>
                  <span>✓ {success}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Logs List Card */}
      {uploadedLogs.length > 0 && (
        <div className="row">
          <div className="col s12">
            <div className="card hoverable">
              <div className="card-content">
                <span className="card-title font-semibold uppercase text-slate-800" style={{ fontSize: "16px" }}>Uploaded Processes</span>
                <p className="grey-text text-darken-1 font-light text-xs" style={{ marginBottom: "15px" }}>{uploadedLogs.length} active process event log(s)</p>

                <ul className="collection" style={{ border: "1px solid #e0e0e0" }}>
                  {uploadedLogs.map((log) => (
                    <li
                      key={log.id}
                      className="collection-item flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4"
                      style={{ borderBottom: "1px solid #e0e0e0" }}
                    >
                      <div className="space-y-1 text-left">
                        <p className="font-semibold text-slate-850 text-sm" style={{ margin: 0 }}>{log.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs grey-text text-darken-1 font-light">
                          <span>{log.fileName}</span>
                          <span>•</span>
                          <span>{(log.fileSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span 
                            className={`badge white-text left font-semibold text-xs uppercase`}
                            style={{
                              position: "relative",
                              float: "none",
                              margin: 0,
                              padding: "2px 6px",
                              borderRadius: "2px",
                              backgroundColor: log.status === "READY" ? "#00897b" : "#fb8c00"
                            }}
                          >
                            {log.status}
                          </span>
                        </div>
                        <p className="grey-text text-lighten-1 font-light" style={{ fontSize: "10px", margin: "2px 0 0 0" }}>
                          Uploaded {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center self-end sm:self-center">
                        <Link href={`/process-log/${log.id}`} className={log.status !== "READY" ? "pointer-events-none" : ""}>
                          <button
                            disabled={log.status !== "READY"}
                            className="btn waves-effect waves-light teal darken-1 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:pointer-events-none disabled:shadow-none"
                            style={{ height: "32px", lineHeight: "32px", fontSize: "11px", display: "inline-flex", alignItems: "center" }}
                          >
                            <i className="material-icons left text-sm" style={{ margin: "0 4px 0 0", fontSize: "16px" }}>play_arrow</i>
                            <span>Explorer</span>
                          </button>
                        </Link>

                        <button
                          onClick={() => handleRename(log)}
                          disabled={renamingIds.includes(log.id)}
                          className="btn-flat waves-effect text-slate-700 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                          style={{ height: "32px", lineHeight: "32px", fontSize: "11px", display: "inline-flex", alignItems: "center", border: "1px solid #e0e0e0" }}
                        >
                          <i className="material-icons left text-sm" style={{ margin: "0 4px 0 0", fontSize: "16px" }}>edit</i>
                          <span>{renamingIds.includes(log.id) ? "Renaming..." : "Rename"}</span>
                        </button>

                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingIds.includes(log.id)}
                          className="btn-flat waves-effect text-red-600 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:bg-red-50"
                          style={{ height: "32px", lineHeight: "32px", fontSize: "11px", display: "inline-flex", alignItems: "center", border: "1px solid #ffcdd2" }}
                        >
                          <i className="material-icons left text-sm text-red-600" style={{ margin: "0 4px 0 0", fontSize: "16px" }}>delete</i>
                          <span>{deletingIds.includes(log.id) ? "Deleting..." : "Delete"}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
