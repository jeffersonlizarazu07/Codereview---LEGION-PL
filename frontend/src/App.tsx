import Sidebar from "./components/Sidebar";
import MessageBubble from "./components/MessageBubble";
import Spinner from "./components/Spinner";
import { useChat } from "./hooks/useChat";

export default function App() {

  // Toda la lógica del chat está centralizada en useChat, App solo se encarga de ensamblar los componentes y pasar props
  const {
    messages,
    input,
    setInput,
    branch,
    setBranch,
    branches,
    isLoading,
    statusText,
    error,
    messagesEndRef,
    sendMessage,
    clearMessages,
  } = useChat();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleBranchChange = (newBranch: string) => {
    setBranch(newBranch);
    clearMessages();
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
      <Sidebar
        branch={branch}
        branches={branches}
        isLoading={isLoading}
        onBranchChange={handleBranchChange}
        onPromptClick={sendMessage}
        onClear={clearMessages}
      />

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
