// src/pages/DataManagement.jsx
import { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import AIAnalysisPanel from "../components/AIAnalysisPanel";

// Data management page for uploading files, running ETL, and syncing OpDB to DWH
const STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  RUNNING: "running",
  SYNCING: "syncing",
  DONE: "done",
};

export default function DataManagement() {
  const [rawFiles, setRawFiles] = useState([]);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [report, setReport] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  // ── Fetch file lists ─────────────────────────────────────
  const fetchFiles = async () => {
    try {
      const [rawRes, procRes] = await Promise.all([
        api.get("/admin/data/files"),
        api.get("/admin/data/processed"),
      ]);
      setRawFiles(rawRes.data.files);
      setProcessedFiles(procRes.data.files);
    } catch (e) {
      setError("Failed to fetch file list.");
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // ── Upload ───────────────────────────────────────────────
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setStatus(STATUS.UPLOADING);
    setError(null);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try {
      await api.post("/admin/data/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchFiles();
    } catch (e) {
      setError("Upload failed. Make sure files are .xlsx format.");
    } finally {
      setStatus(STATUS.IDLE);
    }
  };

  // ── Run Excel ETL ────────────────────────────────────────
  const handleRunETL = async () => {
    if (rawFiles.length === 0) return;
    setStatus(STATUS.RUNNING);
    setReport(null);
    setError(null);
    try {
      const res = await api.post("/admin/data/run");
      setReport(res.data);
      await fetchFiles();
    } catch (e) {
      setError(e.response?.data?.detail || "ETL run failed.");
    } finally {
      setStatus(STATUS.DONE);
    }
  };

  // ── Sync OpDB → DWH ─────────────────────────────────────
  const handleSyncOpDB = async () => {
    setStatus(STATUS.SYNCING);
    setSyncResult(null);
    setError(null);
    try {
      const res = await api.post("/admin/opdb/sync");
      setSyncResult(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || "OpDB sync failed.");
    } finally {
      setStatus(STATUS.IDLE);
    }
  };

  // ── Drag and drop ────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const isLoading =
    status === STATUS.UPLOADING ||
    status === STATUS.RUNNING ||
    status === STATUS.SYNCING;

  return (
    <Layout style={{ background: "#f8fafc" }}>
      <div style={styles.page}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Data Management</h1>
            <p style={styles.subtitle}>
              Upload CRM files or sync from the main agency database
            </p>
          </div>
          <div style={styles.headerActions}>
            {/* Sync OpDB button */}
            <button
              style={{
                ...styles.syncBtn,
                ...(isLoading ? styles.btnDisabled : {}),
              }}
              onClick={handleSyncOpDB}
              disabled={isLoading}
            >
              {status === STATUS.SYNCING ? (
                <>
                  <Spinner /> Syncing...
                </>
              ) : (
                <>⟳ Sync Main Agency DB</>
              )}
            </button>

            {/* Run Excel ETL button */}
            <button
              style={{
                ...styles.runBtn,
                ...(rawFiles.length === 0 || isLoading
                  ? styles.btnDisabled
                  : {}),
              }}
              onClick={handleRunETL}
              disabled={rawFiles.length === 0 || isLoading}
            >
              {status === STATUS.RUNNING ? (
                <>
                  <Spinner /> Processing...
                </>
              ) : (
                <>▶ Launch ETL Treatment</>
              )}
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* ── Sync result banner ── */}
        {syncResult && (
          <div style={styles.syncBanner}>
            <span style={styles.syncBannerTitle}>
              {syncResult.total_inserted === 0
                ? "✓ Sync complete — no new data found"
                : `✓ Sync complete — ${syncResult.total_inserted} rows inserted`}
            </span>
            <span style={styles.syncBannerMeta}>
              Last synced at{" "}
              {new Date(syncResult.synced_at).toLocaleTimeString()}
            </span>
            <div style={styles.syncTableGrid}>
              {Object.entries(syncResult.tables || {}).map(
                ([table, counts]) => (
                  <div key={table} style={styles.syncTableCell}>
                    <span style={styles.syncTableName}>{table}</span>
                    <span style={styles.syncTableCount}>
                      {counts.error ? (
                        <span style={{ color: "#ef4444" }}>error</span>
                      ) : (
                        `+${counts.inserted}`
                      )}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* ── File grid ── */}
        <div style={styles.grid}>
          {/* Upload zone */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              <span style={styles.dot} />
              Upload Files
            </h2>
            <div
              style={{
                ...styles.dropzone,
                ...(dragOver ? styles.dropzoneActive : {}),
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <div style={styles.dropIcon}>📂</div>
              <p style={styles.dropText}>
                {status === STATUS.UPLOADING
                  ? "Uploading..."
                  : "Drop .xlsx files here or click to browse"}
              </p>
              <p style={styles.dropHint}>Multiple files supported</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                multiple
                style={{ display: "none" }}
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Pending */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              <span style={{ ...styles.dot, background: "#f59e0b" }} />
              Pending Treatment
              <span style={styles.badge}>{rawFiles.length}</span>
            </h2>
            {rawFiles.length === 0 ? (
              <p style={styles.empty}>No files in queue</p>
            ) : (
              <FileTable files={rawFiles} styles={styles} />
            )}
          </div>

          {/* Processed */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              <span style={{ ...styles.dot, background: "#10b981" }} />
              Processed Files
              <span
                style={{
                  ...styles.badge,
                  background: "#d1fae5",
                  color: "#065f46",
                }}
              >
                {processedFiles.length}
              </span>
            </h2>
            {processedFiles.length === 0 ? (
              <p style={styles.empty}>No processed files yet</p>
            ) : (
              <FileTable files={processedFiles} styles={styles} />
            )}
          </div>
        </div>

        {/* ── ETL Report ── */}
        {report && (
          <div style={styles.reportCard}>
            <h2 style={styles.cardTitle}>
              <span style={{ ...styles.dot, background: "#6366f1" }} />
              Treatment Report
            </h2>
            <div style={styles.summaryRow}>
              {[
                {
                  label: "Files Processed",
                  value: report.files_processed,
                  color: "#6366f1",
                },
                {
                  label: "Files Failed",
                  value: report.files_failed,
                  color: "#ef4444",
                },
                {
                  label: "Rows Inserted",
                  value: report.total_inserted,
                  color: "#10b981",
                },
                {
                  label: "Rows Skipped",
                  value: report.total_skipped,
                  color: "#f59e0b",
                },
              ].map((s) => (
                <div key={s.label} style={styles.summaryCard}>
                  <span style={{ ...styles.summaryValue, color: s.color }}>
                    {s.value}
                  </span>
                  <span style={styles.summaryLabel}>{s.label}</span>
                </div>
              ))}
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>File</th>
                  <th style={styles.th}>Agency</th>
                  <th style={styles.th}>Users</th>
                  <th style={styles.th}>Vehicles</th>
                  <th style={styles.th}>Opportunities</th>
                  <th style={styles.th}>Quotes</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.reports.map((r) => (
                  <tr key={r.file} style={styles.tr}>
                    <td style={styles.td}>{r.file}</td>
                    <td style={styles.td}>
                      <span style={styles.agencyTag}>{r.agency || "—"}</span>
                    </td>
                    <td style={styles.td}>
                      {r.users?.inserted} / {r.users?.total}
                    </td>
                    <td style={styles.td}>
                      {r.vehicles?.inserted} / {r.vehicles?.total}
                    </td>
                    <td style={styles.td}>
                      {r.opportunities?.inserted} / {r.opportunities?.total}
                    </td>
                    <td style={styles.td}>
                      {r.quotes?.inserted} / {r.quotes?.total}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background:
                            r.status === "success" ? "#d1fae5" : "#fee2e2",
                          color: r.status === "success" ? "#065f46" : "#991b1b",
                        }}
                      >
                        {r.status === "success" ? "✓ Done" : "✗ Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── AI Analysis Panel ── */}
        <AIAnalysisPanel />
      </div>
    </Layout>
  );
}

function FileTable({ files, styles }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>File</th>
          <th style={styles.th}>Agency</th>
          <th style={styles.th}>Size</th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => (
          <tr key={f.filename} style={styles.tr}>
            <td style={styles.td}>{f.filename}</td>
            <td style={styles.td}>
              <span style={styles.agencyTag}>{f.agency}</span>
            </td>
            <td style={styles.td}>{f.size_kb} KB</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid #ffffff44",
        borderTop: "2px solid #fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        marginRight: 8,
      }}
    />
  );
}

const styles = {
  page: {
    padding: "32px",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    background: "#f8fafc",
    minHeight: "100vh",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: "4px 0 0",
  },
  syncBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  runBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  btnDisabled: {
    background: "#cbd5e1",
    cursor: "not-allowed",
  },
  errorBanner: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px 16px",
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 14,
  },
  syncBanner: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "16px 20px",
    marginBottom: 24,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  syncBannerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#065f46",
  },
  syncBannerMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  syncTableGrid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 4,
  },
  syncTableCell: {
    background: "#dcfce7",
    borderRadius: 6,
    padding: "4px 10px",
    display: "flex",
    gap: 6,
    alignItems: "center",
    fontSize: 12,
  },
  syncTableName: {
    color: "#14532d",
    fontWeight: 500,
  },
  syncTableCount: {
    color: "#16a34a",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 20,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 24,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  reportCard: {
    background: "#fff",
    borderRadius: 14,
    padding: 24,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: "1px solid #e2e8f0",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#0f172a",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#6366f1",
    display: "inline-block",
  },
  badge: {
    marginLeft: "auto",
    background: "#ede9fe",
    color: "#5b21b6",
    borderRadius: 99,
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  dropzone: {
    border: "2px dashed #cbd5e1",
    borderRadius: 10,
    padding: "32px 16px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    background: "#f8fafc",
  },
  dropzoneActive: {
    borderColor: "#6366f1",
    background: "#eef2ff",
  },
  dropIcon: { fontSize: 32, marginBottom: 8 },
  dropText: {
    fontSize: 14,
    color: "#475569",
    margin: "0 0 4px",
    fontWeight: 500,
  },
  dropHint: {
    fontSize: 12,
    color: "#94a3b8",
    margin: 0,
  },
  empty: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    padding: "24px 0",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    color: "#64748b",
    fontWeight: 600,
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tr: { borderBottom: "1px solid #f1f5f9" },
  td: { padding: "10px 10px", color: "#334155", verticalAlign: "middle" },
  agencyTag: {
    background: "#ede9fe",
    color: "#5b21b6",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 600,
  },
  summaryRow: { display: "flex", gap: 16, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    background: "#f8fafc",
    borderRadius: 10,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    border: "1px solid #e2e8f0",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 500,
  },
  statusBadge: {
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
  },
};
