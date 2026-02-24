import { useState, useEffect, useRef, useCallback } from "react";
import type { Message, Branch, Mode } from "../types";
import { STATUS_LABELS, generateId } from "../constants";

export function useChat() {
  // Estado del chat y control de UI
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carga las ramas disponibles desde el backend al montar el componente. Usa valores de fallback hardcodeados
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches);
        if (data.branches.length > 0) setBranch(data.branches[0].name);
      })
      .catch(() => {
        const fallback = [
          { name: "feat/partiql-support", pr: "PR #1 - PartiQL support" },
          { name: "feat/support-batch-read-ops", pr: "PR #3 - Batch read ops" },
          { name: "feat/support-streaming", pr: "PR #2 - DynamoDB Streams" },
        ];
        setBranches(fallback);
        setBranch(fallback[0].name);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // useCallback evita que sendMessage se recree en cada render, solo se recrea cuando cambian branch, isLoading o messages
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

      // Construimos el historial previo para enviarlo al backend ya que el agente necesita el contexto completo de la conversación
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

          // Procesamos las líneas del SSE — cada línea es un evento del agente
          const lines = decoder.decode(value, { stream: true }).split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                // Acumulamos tokens progresivamente para construir la respuesta en tiempo real durante el streaming SSE
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
              if (err instanceof Error) setError(err.message);
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

  return {
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
    clearMessages: () => setMessages([]),
  };
}
