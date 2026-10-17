import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ollama from "ollama/browser";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cpu,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

const DEFAULT_MODEL = "llama3.2:latest";
const SUGGESTIONS = [
  { icon: "✳", text: "Explain AI to a 10 year old" },
  { icon: "✉", text: "Write a polite leave email" },
  { icon: "▶", text: "Give me 5 YouTube video ideas" },
  { icon: "⌘", text: "What is an API, simply?" },
];

const newChat = () => ({
  id: crypto.randomUUID(),
  title: "New chat",
  messages: [],
  updatedAt: Date.now(),
});

function App() {
  const [chats, setChats] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("proitbridge-chats") || "[]",
      );
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [activeId, setActiveId] = useState(() => {
    try {
      return localStorage.getItem("proitbridge-active-chat") || null;
    } catch {
      return null;
    }
  });
  const [activeModel, setActiveModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState("checking");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const modelMenuRef = useRef(null);
  const abortRef = useRef(false);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeId) || null,
    [chats, activeId],
  );
  const messages = activeChat?.messages || [];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    try {
      localStorage.setItem("proitbridge-chats", JSON.stringify(chats));
      if (activeId) localStorage.setItem("proitbridge-active-chat", activeId);
      else localStorage.removeItem("proitbridge-active-chat");
    } catch {
      /* Browser storage can be disabled; chatting still works. */
    }
  }, [chats, activeId]);

  const updateChat = useCallback((id, updater) => {
    setChats((current) =>
      current.map((chat) => (chat.id === id ? updater(chat) : chat)),
    );
  }, []);

  const createChat = useCallback(() => {
    const chat = newChat();
    setChats((current) => [chat, ...current]);
    setActiveId(chat.id);
    setInput("");
    setError("");
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const ensureChat = useCallback(() => {
    if (activeChat) return activeChat;
    const chat = newChat();
    setChats((current) => [chat, ...current]);
    setActiveId(chat.id);
    return chat;
  }, [activeChat]);

  const refreshModels = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setConnection("checking");
    setError("");
    try {
      const result = await ollama.list();
      const list = (result.models || [])
        .map((model) => model.name)
        .filter(Boolean);
      setModels(list);
      setConnection("connected");

      if (list.length > 0) {
        setActiveModel((current) => {
          if (list.includes(current)) return current;
          if (list.includes(DEFAULT_MODEL)) return DEFAULT_MODEL;
          return list[0];
        });
      } else {
        setError(
          `No models found on Ollama. Please run "ollama pull ${DEFAULT_MODEL}" in your terminal to install the model.`,
        );
      }
      return list;
    } catch (err) {
      setConnection("disconnected");
      setModels([]);
      const errMsg = err?.message || "";
      if (errMsg.includes("fetch") || errMsg.includes("Failed to") || errMsg.includes("NetworkError")) {
        setError(
          "Can't reach Ollama at http://localhost:11434. Make sure the Ollama application is running and that CORS allows requests from this browser origin.",
        );
      } else {
        setError(`Unable to connect to Ollama: ${errMsg || "Server unreachable"}`);
      }
      return [];
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    const close = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target))
        setModelMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (!showScrollButton)
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, showScrollButton]);

  const sendMessage = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || loading) return;
      setError("");
      setInput("");
      setShowScrollButton(false);

      let chat = activeChat;
      if (!chat) {
        chat = newChat();
        setChats((current) => [chat, ...current]);
        setActiveId(chat.id);
      }

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        model: activeModel,
      };
      const nextMessages = [
        ...(chat.messages || []),
        userMessage,
        assistantMessage,
      ];
      const title =
        (chat.messages || []).length === 0
          ? text.length > 36
            ? `${text.slice(0, 36).trim()}…`
            : text
          : chat.title;
      updateChat(chat.id, (item) => ({
        ...item,
        title,
        messages: nextMessages,
        updatedAt: Date.now(),
      }));
      setLoading(true);
      abortRef.current = false;

      try {
        const response = await ollama.chat({
          model: activeModel,
          messages: [...(chat.messages || []), userMessage].map(
            ({ role, content }) => ({ role, content }),
          ),
          stream: true,
        });
        for await (const part of response) {
          if (abortRef.current) break;
          const chunk = part.message?.content || "";
          if (!chunk) continue;
          updateChat(chat.id, (item) => ({
            ...item,
            messages: item.messages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: message.content + chunk }
                : message,
            ),
            updatedAt: Date.now(),
          }));
        }
      } catch (err) {
        if (abortRef.current) {
          // Request was stopped by user; preserve current message text without marking as failure
          return;
        }
        const message =
          err?.message || "Something went wrong while talking to Ollama.";
        if (message.includes("not found") || message.includes("does not exist")) {
          setError(`Model "${activeModel}" is not installed or was removed. Please select an installed model from the sidebar.`);
        } else if (message.includes("fetch") || message.includes("Failed to") || message.includes("NetworkError")) {
          setError(
            "Ollama could not be reached at http://localhost:11434. Check that Ollama is running and that CORS allows this origin.",
          );
        } else {
          setError(message);
        }
        updateChat(chat.id, (item) => ({
          ...item,
          messages: item.messages.map((message) =>
            message.id === assistantMessage.id && !message.content
              ? {
                  ...message,
                  content:
                    "I could not get a response. Check the Ollama connection and try again.",
                  failed: true,
                }
              : message,
          ),
        }));
      } finally {
        setLoading(false);
        requestAnimationFrame(() =>
          bottomRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          }),
        );
      }
    },
    [activeChat, activeModel, input, loading, updateChat],
  );

  const stopGeneration = () => {
    abortRef.current = true;
    try {
      ollama.abort();
    } catch {
      /* No active client request */
    }
    setLoading(false);
  };

  const onComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const removeChat = (event, id) => {
    event.stopPropagation();
    const remaining = chats.filter((chat) => chat.id !== id);
    setChats(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id || null);
  };

  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => b.updatedAt - a.updatedAt),
    [chats],
  );

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-name">
            PROITBRIDGE<span className="brand-dot">.</span>
          </div>
          <div className="brand-subtitle">LOCAL AI CHAT</div>
        </div>

        <div className="sidebar-label">MODEL</div>
        <div className="model-select-wrap" ref={modelMenuRef}>
          <button
            className="model-select"
            onClick={() => setModelMenuOpen((open) => !open)}
            aria-expanded={modelMenuOpen}
          >
            <span>{activeModel}</span>
            <ChevronDown size={15} />
          </button>
          {modelMenuOpen && (
            <div className="model-menu">
              <div className="menu-heading">AVAILABLE MODELS</div>
              {models.length ? (
                models.map((model) => (
                  <button
                    key={model}
                    className={`model-option ${model === activeModel ? "selected" : ""}`}
                    onClick={() => {
                      setActiveModel(model);
                      setModelMenuOpen(false);
                    }}
                  >
                    <Cpu size={14} />
                    <span>{model}</span>
                    {model === activeModel && <Check size={14} />}
                  </button>
                ))
              ) : (
                <div className="no-models">
                  No models found. Pull one with <code>ollama pull llama3.2</code>
                  .
                </div>
              )}
              <button
                className="refresh-models"
                onClick={refreshModels}
                disabled={isRefreshing}
              >
                <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />{" "}
                {isRefreshing ? "Refreshing…" : "Refresh models"}
              </button>
            </div>
          )}
        </div>

        <button className="new-chat-button" onClick={createChat}>
          <Plus size={17} strokeWidth={2.6} /> New chat
        </button>

        {sortedChats.length > 0 && (
          <div className="history-section">
            <div className="history-heading">RECENT CHATS</div>
            <div className="history-list">
              {sortedChats.map((chat) => (
                <div
                  key={chat.id}
                  role="button"
                  tabIndex={0}
                  className={`history-item ${chat.id === activeId ? "history-active" : ""}`}
                  onClick={() => {
                    setActiveId(chat.id);
                    setError("");
                    setSidebarOpen(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && setActiveId(chat.id)}
                >
                  <MessageSquare size={15} />
                  <span>{chat.title}</span>
                  <button
                    className="delete-chat"
                    aria-label={`Delete ${chat.title}`}
                    onClick={(e) => removeChat(e, chat.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-bottom">
          <div className={`connection-card ${connection}`}>
            <span className="status-dot" />
            <div className="connection-copy">
              <strong>
                {connection === "connected"
                  ? "Ollama connected"
                  : connection === "checking"
                    ? "Checking Ollama…"
                    : "Ollama offline"}
              </strong>
              <span>localhost:11434</span>
            </div>
            <button
              className="connection-refresh"
              onClick={refreshModels}
              disabled={isRefreshing}
              aria-label="Reconnect to Ollama"
            >
              <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />
            </button>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={14} />
            <span>
              Nothing leaves this machine.
              <br />
              No API key, no internet, no bill.
            </span>
          </div>
          <div className="sidebar-version">
            POWERED BY{" "}
            <a
              href="https://github.com/ollama/ollama-js"
              target="_blank"
              rel="noreferrer"
            >
              OLLAMA JS
            </a>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-title">Ollama Chat</div>
          </div>
          <div className="topbar-status">
            <span className="topbar-status-label">RUNNING ON</span>
            <span className="topbar-status-device">YOUR LAPTOP</span>
            <span className={`topbar-status-dot ${connection}`} />
          </div>
        </header>

        <section
          className={`chat-stage ${hasMessages ? "conversation-stage" : "welcome-stage"}`}
        >
          {!hasMessages ? (
            <div className="welcome-content">
              <div className="welcome-symbol">
                <span className="symbol-glow" />
                <Sparkles size={27} />
              </div>
              <h1>
                Your own AI, <span>running right here.</span>
              </h1>
              <p className="welcome-description">
                This page talks to a model stored on this computer — not to
                anyone’s server.
                <br className="desktop-break" /> Ask it anything to see for
                yourself.
              </p>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.text}
                    className="suggestion-chip"
                    onClick={() => sendMessage(item.text)}
                    disabled={loading}
                  >
                    <span className="suggestion-icon">{item.icon}</span>
                    {item.text}
                  </button>
                ))}
              </div>
              <div className="local-callout">
                <span className="local-callout-icon">
                  <ShieldCheck size={16} />
                </span>
                <span>
                  <strong>Private by design.</strong> Your prompts stay on your
                  device.
                </span>
              </div>
            </div>
          ) : (
            <div className="messages-container">
              <div className="conversation-meta">
                <span className="conversation-model">
                  <Bot size={14} /> {activeModel}
                </span>
                <span>
                  <Clock3 size={13} /> Saved in this browser
                </span>
              </div>
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`message-row ${message.role}`}
                >
                  <div className={`message-avatar ${message.role}`}>
                    {message.role === "user" ? (
                      <span>Y</span>
                    ) : (
                      <Bot size={17} />
                    )}
                  </div>
                  <div className="message-main">
                    <div className="message-author">
                      {message.role === "user" ? "You" : "Proitbridge AI"}
                    </div>
                    {message.content ? (
                      <div
                        className={`message-content ${message.failed ? "message-failed" : ""}`}
                      >
                        {message.content}
                      </div>
                    ) : loading && message.role === "assistant" ? (
                      <div className="thinking-indicator">
                        <span />
                        <span />
                        <span /> <em>Thinking…</em>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <CircleHelp size={16} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
        </section>

        <div
          className={`composer-area ${hasMessages ? "composer-with-messages" : ""}`}
        >
          {hasMessages && (
            <div className="composer-hint">
              AI can make mistakes. Check important information.
            </div>
          )}
          <div className="composer-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Ask anything…"
              rows={1}
              aria-label="Message Ollama"
              disabled={connection === "disconnected" && models.length === 0}
            />
            <div className="composer-controls">
              <div className="composer-left">
                <span className="composer-model-dot" />
                <span>{activeModel}</span>
                <span className="composer-divider">·</span>
                <span className="composer-local">Local model</span>
              </div>
              <div className="composer-right">
                <span className="keyboard-shortcut">
                  <kbd>ENTER</kbd> TO SEND <span>·</span>{" "}
                  <kbd>SHIFT + ENTER</kbd> NEW LINE
                </span>
                {loading ? (
                  <button
                    className="send-button stop-button"
                    onClick={stopGeneration}
                    title="Stop generating"
                  >
                    <span className="stop-square" />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    onClick={() => sendMessage()}
                    disabled={!input.trim()}
                    aria-label="Send message"
                    title="Send message"
                  >
                    <ArrowUp size={19} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
          {!hasMessages && (
            <div className="composer-caption">
              <ShieldCheck size={12} /> Your conversation stays on your
              computer.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
