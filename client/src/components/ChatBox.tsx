import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { MessageCircle, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export function ChatBox() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createSessionMutation = trpc.chat.createSession.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && isAuthenticated && !currentSessionId) {
      createAndStartSession();
    } else if (isOpen && !isAuthenticated) {
      toast.error("Please log in to use the chat");
      navigate("/auth");
      setIsOpen(false);
    }
  }, [isOpen, isAuthenticated, currentSessionId, navigate]);

  const createAndStartSession = async () => {
    try {
      const session = await createSessionMutation.mutateAsync({
        title: `Chat ${new Date().toLocaleDateString()}`,
      });
      if (session?.id) {
        setCurrentSessionId(session.id);
        setMessages([
          {
            id: Date.now(),
            role: "assistant",
            content: "👋 Hi! I'm your AI Learning Assistant. Ask me anything about finding the perfect course!\n\n💡 Try asking:\n• \"Recommend courses for beginners\"\n• \"What's the best course for web development?\"\n• \"Show me courses for Python\"\n• \"Compare React and Vue courses\"",
            createdAt: new Date(),
          }
        ]);
      }
    } catch (error) {
      toast.error("Failed to start chat");
      console.error(error);
      setIsOpen(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentSessionId || isLoading) return;

    const userMessage = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      const newUserMessage: Message = {
        id: Date.now(),
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, newUserMessage]);

      const response = await sendMessageMutation.mutateAsync({
        sessionId: currentSessionId,
        message: userMessage,
      });

      if (response) {
        const assistantMessage: Message = {
          id: response.id,
          role: "assistant",
          content: response.content,
          createdAt: new Date(response.createdAt),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }

      scrollToBottom();
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
      console.error(error);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated && !isOpen) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => navigate("/auth")}
        className="fixed bottom-6 right-6 bg-gradient-to-b from-blue-600 via-slate-800 to-teal-600 text-white p-4 shadow-xl hover:shadow-2xl transition-all z-40 flex items-center gap-2"
        title="Sign in to chat with AI"
      >
        <MessageCircle size={24} />
        <span className="text-sm font-bold">Chat with AI</span>
      </motion.button>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-gradient-to-b from-blue-600 via-slate-800 to-teal-600 text-white p-4 shadow-xl hover:shadow-2xl transition-all z-40 group"
        title="Open chat with AI assistant"
      >
        <div className="relative">
          <MessageCircle size={24} className={isOpen ? "hidden" : "block"} />
          <X size={24} className={isOpen ? "block" : "hidden"} />
          {!isOpen && (
            <motion.span
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full"
            />
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-full sm:w-96 h-[32rem] flex flex-col bg-white dark:bg-slate-950 border-4 border-slate-700 shadow-2xl z-40 overflow-hidden rounded-lg"
          >
            <div className="bg-gradient-to-r from-blue-700 via-slate-800 to-teal-700 text-white p-4 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-lg">🤖 AI Learning Assistant</h2>
                <p className="text-xs opacity-90">Smart course recommendations</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-100 to-white dark:from-slate-900 dark:to-slate-950">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-lg shadow-md"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg shadow-sm border-2 border-slate-400 dark:border-slate-600"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs ${msg.role === "user" ? "text-blue-100" : "text-slate-600 dark:text-slate-400"} mt-1`}>
                        {msg.createdAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-slate-200 dark:bg-slate-700 px-4 py-3 rounded-lg">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.6, repeat: Infinity }}
                        className="flex gap-1"
                      >
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        <div className="w-2 h-2 bg-slate-700 rounded-full" />
                        <div className="w-2 h-2 bg-teal-600 rounded-full" />
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="border-t-4 border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-950"
            >
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask me about courses..."
                  disabled={isLoading}
                  className="text-sm dark:bg-slate-800 dark:text-white dark:border-slate-600 border-2 border-slate-400 rounded-lg"
                />
                <Button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  size="sm"
                  className="bg-gradient-to-b from-blue-700 to-teal-700 hover:from-blue-800 hover:to-teal-800 text-white rounded-lg"
                >
                  <Send size={18} />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
