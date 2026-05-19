// app_frontend/src/pages/Directors/DirectorChat.jsx
import DWChatPanel from "../../components/DWChatPanel";

export default function DirectorChat() {
  return (
    <div style={{ padding: "24px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 600, color: "#111827" }}>
        Data Assistant
      </h2>
      <p style={{ margin: "0 0 0", fontSize: "14px", color: "#6b7280" }}>
        Ask questions about your sales data in plain language.
      </p>
      <DWChatPanel />
    </div>
  );
}
