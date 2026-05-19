// app_frontend/src/components/DWChatPanel.jsx
import { useState, useRef, useEffect } from "react";
import axiosInstance from "../api/axios";

// ── A single message bubble ────────────────────────────────────────────────────
function Message({ msg }) {
  const [showSQL, setShowSQL] = useState(false);
  const isUser = msg.role === "user";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      marginBottom: "16px",
    }}>
      <div style={{
        maxWidth: "88%",
        background: isUser ? "#111827" : "#f9fafb",
        color: isUser ? "#fff" : "#1f2937",
        border: isUser ? "none" : "1px solid #e5e7eb",
        borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
        padding: "12px 16px",
        fontSize: "14px",
        lineHeight: "1.6",
      }}>
        {msg.text}
      </div>

      {/* Assistant messages with data get extra UI */}
      {!isUser && msg.data && (
        <div style={{ maxWidth: "88%", marginTop: "8px" }}>
          {/* Toggle SQL */}
          <button
            onClick={() => setShowSQL(v => !v)}
            style={{
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              color: "#6b7280",
              cursor: "pointer",
              marginBottom: "6px",
            }}
          >
            {showSQL ? "Hide SQL" : "Show SQL"} ↗
          </button>

          {showSQL && (
            <pre style={{
              background: "#1e1e2e",
              color: "#cdd6f4",
              borderRadius: "8px",
              padding: "12px 16px",
              fontSize: "12px",
              overflowX: "auto",
              margin: "0 0 8px 0",
            }}>
              {msg.data.sql}
            </pre>
          )}

          {/* Results table */}
          {msg.data.rows && msg.data.rows.length > 0 && (
            <div style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              overflow: "hidden",
              maxHeight: "260px",
              overflowY: "auto",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                    {msg.data.columns.map(col => (
                      <th key={col} style={{
                        padding: "6px 10px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {msg.data.rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      {row.map((cell, j) => (
                        <td key={j} style={{
                          padding: "5px 10px",
                          color: "#374151",
                          borderBottom: "1px solid #f3f4f6",
                          whiteSpace: "nowrap",
                          maxWidth: "220px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {cell === null ? <span style={{ color: "#9ca3af" }}>null</span> : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {msg.data.total_rows > msg.data.rows.length && (
                <div style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  color: "#9ca3af",
                  background: "#f9fafb",
                  borderTop: "1px solid #e5e7eb",
                }}>
                  Showing first {msg.data.rows.length} of {msg.data.total_rows} rows
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Suggested prompts ──────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What were total sales last month?",
  "Show me the top 10 clients by revenue",
  "Which salesperson closed the most deals this quarter?",
  "How many opportunities are currently open?",
];

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function DWChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (question) => {
    if (!question.trim() || loading) return;
    const userMsg = { role: "user", text: question };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axiosInstance.post("/ai/query-dw", { question });
      const d = res.data;
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          text: d.explanation,
          data: d.sql ? d : null,
        },
      ]);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to reach the AI service.";
      setMessages(prev => [
        ...prev,
        { role: "assistant", text: `⚠️ ${detail}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #e5e7eb",
      borderRadius: "12px",
      marginTop: "24px",
      fontFamily: "inherit",
      display: "flex",
      flexDirection: "column",
      height: "520px",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #f3f4f6",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: "22px", lineHeight: 1 }}>🗄️</span>
        <div>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>
            Ask your data warehouse
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
            Ask questions in plain English — SQL is generated and run automatically.
          </p>
        </div>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px",
      }}>
        {isEmpty && (
          <div style={{ textAlign: "center", color: "#9ca3af", paddingTop: "20px" }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>💬</div>
            <p style={{ fontSize: "14px", margin: "0 0 20px" }}>
              Try asking something like:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#9ca3af", fontSize: "13px" }}>
            <span style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              border: "2px solid #e5e7eb",
              borderTopColor: "#6b7280",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }} />
            Thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid #f3f4f6",
        display: "flex",
        gap: "8px",
        flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask a question about your data…"
          rows={1}
          disabled={loading}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "14px",
            fontFamily: "inherit",
            outline: "none",
            color: "#1f2937",
            background: loading ? "#f9fafb" : "#fff",
          }}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 18px",
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          Ask
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
