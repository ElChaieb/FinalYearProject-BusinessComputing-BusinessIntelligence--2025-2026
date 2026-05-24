// app_frontend/src/pages/Directors/DirectorChat.jsx
// Director chat page exposes the AI data assistant for natural language queries
import DWChatPanel from "../../components/DWChatPanel";
import Layout from "../../components/Layout";

export default function DirectorChat() {
  return (
    <Layout>
      <div style={{ padding: "24px" }}>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: "20px",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          Data Assistant
        </h2>
        <p style={{ margin: "0 0 0", fontSize: "14px", color: "#6b7280" }}>
          Ask questions about your sales data in plain language.
        </p>
        <DWChatPanel />
      </div>
    </Layout>
  );
}
