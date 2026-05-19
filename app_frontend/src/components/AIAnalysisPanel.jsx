// app_frontend/src/components/AIAnalysisPanel.jsx
import { useState } from "react";
import axiosInstance from "../api/axios";

export default function AIAnalysisPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axiosInstance.get("/ai/analyze-rejected");
      setResult(res.data);
    } catch (err) {
      setError("Failed to reach the AI service. Make sure Ollama is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <span className="ai-icon">🤖</span>
          <div>
            <h3>AI Data Quality Assistant</h3>
            <p>Analyzes rejected files and explains what went wrong in plain language.</p>
          </div>
        </div>
        <button
          className={`ai-btn ${loading ? "ai-btn--loading" : ""}`}
          onClick={analyze}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="ai-spinner" />
              Analyzing...
            </>
          ) : (
            <>
              <span>✦</span> Analyze Rejected Files
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="ai-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {result && (
        <div className="ai-result">
          {result.total_rejected === 0 ? (
            <div className="ai-empty">
              <span>✅</span> No rejected files found — everything looks clean!
            </div>
          ) : (
            <>
              <div className="ai-result-meta">
                <span className="ai-badge">{result.total_rejected}</span>
                rejected file{result.total_rejected !== 1 ? "s" : ""} analyzed
              </div>
              <div className="ai-analysis-text">
                {result.analysis.split("\n").map((line, i) =>
                  line.trim() === "" ? (
                    <br key={i} />
                  ) : (
                    <p key={i}>{line}</p>
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .ai-panel {
          background: #ffffff;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
          font-family: inherit;
        }
        .ai-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ai-panel-title {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .ai-icon {
          font-size: 28px;
          line-height: 1;
          margin-top: 2px;
        }
        .ai-panel-title h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }
        .ai-panel-title p {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }
        .ai-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #111827;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, opacity 0.15s;
        }
        .ai-btn:hover:not(:disabled) { background: #1f2937; }
        .ai-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ai-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-error {
          margin-top: 16px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #991b1b;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ai-result {
          margin-top: 20px;
          border-top: 1px solid #f3f4f6;
          padding-top: 20px;
        }
        .ai-empty {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ai-result-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #374151;
        }
        .ai-badge {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
          border-radius: 20px;
          padding: 2px 10px;
          font-weight: 600;
          font-size: 13px;
        }
        .ai-analysis-text {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px 20px;
          font-size: 14px;
          line-height: 1.7;
          color: #1f2937;
          max-height: 400px;
          overflow-y: auto;
        }
        .ai-analysis-text p { margin: 0 0 4px 0; }
      `}</style>
    </div>
  );
}
