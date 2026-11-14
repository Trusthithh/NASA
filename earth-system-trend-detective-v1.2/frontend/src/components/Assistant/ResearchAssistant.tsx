import React, { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { askAssistant, getErrorMessage } from "../../services/api";
import { AnalysisParams } from "../../types/science";
import { card } from "../../styles/ui";

interface ResearchAssistantProps {
  params: AnalysisParams;
  locationName: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  source?: string;
}

export const ResearchAssistant: React.FC<ResearchAssistantProps> = ({ params, locationName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // A new investigation resets the conversation.
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          `Hello! I have the analysis for ${locationName}. Ask me about the statistical ` +
          "significance, trend magnitude, or limitations of these findings.",
      },
    ]);
  }, [params, locationName]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (question.length < 3 || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await askAssistant(question, params);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, source: res.sources_cited[0] },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: getErrorMessage(err, "The assistant is unavailable right now.") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${card} flex h-[550px] flex-col`}>
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600">
          <Bot className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <span>Research Assistant</span>
            <Sparkles className="h-4 w-4 text-cyan-400" />
          </h3>
          <p className="text-xs text-slate-400">Answers use only backend-computed statistics</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-cyan-700 px-4 py-3 text-sm text-white"
                  : "max-w-[85%] rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200"
              }
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.source && <p className="mt-2 text-xs text-slate-500">{m.source}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-800 pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="Is this trend statistically significant?"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || input.trim().length < 3}
          className="rounded-xl bg-cyan-600 p-2.5 text-white hover:bg-cyan-500 disabled:opacity-50"
          aria-label="Send question"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
};
