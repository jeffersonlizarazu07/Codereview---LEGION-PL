import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Types ───────────────────────────────────────────────────────
type Role = "user" | "assistant";
type Mode = "qa" | "review" | "unknown";

interface Message {
  id: string;
  role: Role;
  content: string;
  mode?: Mode;
  isStreaming?: boolean;
}

interface Branch {
  name: string;
  pr: string;
}

// ─── Constantes ──────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  router: "🔀 Clasificando intención...",
  fetch_diff_qa: "📡 Obteniendo diff de GitHub...",
  fetch_diff_review: "📡 Obteniendo diff de GitHub...",
  qa_node: "🤔 Analizando código...",
  review_node: "🔬 Ejecutando code review...",
};

const QUICK_PROMPTS = [
  {
    label: "🔍 Code Review completo",
    text: "Realiza un code review completo de esta rama",
  },
  {
    label: "⚠️ Vulnerabilidades",
    text: "¿Qué vulnerabilidades de seguridad existen en estos cambios?",
  },
  {
    label: "🏗️ Arquitectura",
    text: "Explica la arquitectura general de los cambios",
  },
  {
    label: "📈 Complejidad",
    text: "¿Qué funciones tienen alta complejidad ciclomática?",
  },
  {
    label: "🧪 Tests faltantes",
    text: "¿Hay tests faltantes para la nueva funcionalidad?",
  },
  {
    label: "🔗 Imports nuevos",
    text: "¿Qué nuevas dependencias o imports se agregaron?",
  },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Spinner ─────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid var(--border)",
        borderTop: "2px solid var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

// ─── Message Bubble ───────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: "1.5rem",
        animation: "fadeUp 0.25s ease",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: "0.65rem",
          fontFamily: "var(--mono)",
          color: "var(--text-muted)",
          marginBottom: "0.35rem",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {isUser ? (
          "▸ you"
        ) : (
          <>
            ▸ agent
            {message.mode && message.mode !== "unknown" && (
              <span
                style={{
                  background: "var(--accent-glow)",
                  border: "1px solid var(--accent-dim)",
                  color: "var(--accent)",
                  padding: "0 5px",
                  borderRadius: 3,
                  fontSize: "0.6rem",
                }}
              >
                {message.mode}
              </span>
            )}
          </>
        )}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "85%",
          background: isUser ? "var(--accent-glow)" : "var(--bg-2)",
          border: `1px solid ${isUser ? "var(--accent-dim)" : "var(--border)"}`,
          borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          padding: "0.85rem 1rem",
          fontSize: "0.875rem",
          lineHeight: 1.6,
        }}
      >
        {isUser ? (
          <span style={{ color: "var(--text)" }}>{message.content}</span>
        ) : (
          <div className="markdown-body" style={{ color: "var(--text)" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: "1em",
                  background: "var(--accent)",
                  marginLeft: 2,
                  animation: "blink 1s step-end infinite",
                  verticalAlign: "text-bottom",
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar branches al iniciar
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches);
        if (data.branches.length > 0) setBranch(data.branches[0].name);
      })
      .catch(() => {
        const fallback = [
          { name: 'feat/partiql-support', pr: 'PR #1 - PartiQL support' },
          { name: 'feat/support-batch-read-ops', pr: 'PR #3 - Batch read ops' },
          { name: 'feat/support-streaming', pr: 'PR #2 - DynamoDB Streams' },
        ];
        setBranches(fallback);
        setBranch(fallback[0].name);
      });
  }, []);

  // Auto scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !branch || isLoading) return;

      setError("");
      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
      };
      const assistantId = generateId();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsLoading(true);
      setStatusText("Conectando...");

      // Historial sin los mensajes que acabamos de agregar
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, branch, history }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accum = "";
        let detectedMode: Mode = "unknown";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const lines = decoder.decode(value, { stream: true }).split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "token") {
                accum += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accum } : m,
                  ),
                );
              } else if (data.type === "status") {
                setStatusText(STATUS_LABELS[data.node] || data.node);
                if (data.node === "review_node") detectedMode = "review";
                else if (data.node === "qa_node") detectedMode = "qa";
              } else if (data.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, isStreaming: false, mode: detectedMode }
                      : m,
                  ),
                );
              } else if (data.type === "error") {
                throw new Error(data.message);
              }
            } catch (err) {
              console.error("Stream parse error:", err);
              setError(
                err instanceof Error ? err.message : "Esrror procesando stream",
              );
              reader.cancel();
              break;
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo salió mal");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
        setStatusText("");
      }
    },
    [branch, isLoading, messages],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        style={{
          width: 260,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-2)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "1.25rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 800,
              fontSize: "1.1rem",
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--accent)" }}>⬡</span> ReviewAgent
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              marginTop: 3,
              fontFamily: "var(--mono)",
            }}
          >
            powered by LangGraph
          </div>
        </div>

        {/* Branch selector */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <label
            style={{
              fontSize: "0.65rem",
              fontFamily: "var(--mono)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              display: "block",
              marginBottom: 8,
            }}
          >
            Target Branch
          </label>
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setMessages([]);
            }}
            style={{
              width: "100%",
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "0.5rem 0.75rem",
              borderRadius: 6,
              fontSize: "0.78rem",
              fontFamily: "var(--mono)",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          {branch && (
            <div
              style={{
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                marginTop: 6,
                fontFamily: "var(--mono)",
              }}
            >
              {branches.find((b) => b.name === branch)?.pr}
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div style={{ padding: "1rem 1.25rem", flex: 1, overflowY: "auto" }}>
          <div
            style={{
              fontSize: "0.65rem",
              fontFamily: "var(--mono)",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            Quick Prompts
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.text}
                onClick={() => sendMessage(p.text)}
                disabled={isLoading || !branch}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-dim)",
                  padding: "0.45rem 0.75rem",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontFamily: "var(--sans)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  opacity: isLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-glow)";
                  e.currentTarget.style.borderColor = "var(--accent-dim)";
                  e.currentTarget.style.color = "var(--text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-dim)";
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={() => setMessages([])}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              padding: "0.5rem",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontFamily: "var(--mono)",
              cursor: "pointer",
            }}
          >
            clear chat
          </button>
        </div>
      </aside>

      {/* ── Chat area ────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1rem 2rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-2)",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontFamily: "var(--mono)" }}>
            <span style={{ color: "var(--text-muted)" }}>repo: </span>
            <span style={{ color: "var(--accent)" }}>
              juanhenaoparra/minidyn
            </span>
            {branch && (
              <>
                <span style={{ color: "var(--text-muted)", margin: "0 8px" }}>
                  ·
                </span>
                <span>{branch}</span>
              </>
            )}
          </div>
          {isLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                fontFamily: "var(--mono)",
              }}
            >
              <Spinner />
              {statusText}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
          {messages.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⬡</div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1.25rem",
                  color: "var(--text)",
                  marginBottom: 8,
                }}
              >
                Code Review Agent
              </div>
              <div
                style={{ fontSize: "0.85rem", maxWidth: 400, lineHeight: 1.6 }}
              >
                Selecciona una rama y haz una pregunta sobre los cambios, o usa
                los quick prompts para empezar.
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}

          {error && (
            <div
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "var(--red)",
                padding: "0.75rem 1rem",
                borderRadius: 8,
                fontSize: "0.82rem",
                fontFamily: "var(--mono)",
                marginBottom: "1rem",
              }}
            >
              ✗ {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "1rem 2rem 1.5rem",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-2)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 10,
              background: "var(--bg-3)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "0.5rem 0.5rem 0.5rem 1rem",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !branch}
              placeholder={
                branch
                  ? `Pregunta sobre ${branch}... (Enter para enviar)`
                  : "Selecciona una rama primero"
              }
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: "0.875rem",
                fontFamily: "var(--sans)",
                resize: "none",
                lineHeight: 1.6,
                maxHeight: 150,
                overflowY: "auto",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim() || !branch}
              style={{
                background:
                  isLoading || !input.trim() ? "var(--bg)" : "var(--accent)",
                border: "none",
                color:
                  isLoading || !input.trim() ? "var(--text-muted)" : "white",
                width: 38,
                height: 38,
                borderRadius: 8,
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              {isLoading ? <Spinner /> : "↑"}
            </button>
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              fontFamily: "var(--mono)",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            juanhenaoparra/minidyn · gemini-flash-2.0 via openrouter
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
