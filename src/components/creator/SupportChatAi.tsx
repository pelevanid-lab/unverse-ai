"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Send, X, Bot, User, Loader2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export function SupportChatAi({ onClose }: { onClose: () => void }) {
  const t = useTranslations('SupportChat');
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{ role: 'ai', content: t('initialAiMessage') }]);
    }
  }, [t]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          systemPrompt: t('systemPrompt', { locale: locale === 'en' ? 'English' : 'Turkish' })
        })
      });

      if (!res.ok) throw new Error("Connection lost");
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: t('errorMsg') }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed bottom-6 right-6 w-[400px] h-[600px] z-[100] flex flex-col shadow-2xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0A0A0B]/90 backdrop-blur-2xl"
    >
      <div className="p-6 bg-primary/20 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <Sparkles className="text-primary w-5 h-5" />
            </div>
            <div>
                <CardTitle className="text-lg font-black italic uppercase tracking-tighter">Support <span className="text-primary">Center</span></CardTitle>
                <div className="flex items-center gap-1 text-[8px] font-black uppercase text-primary/60 tracking-widest">
                    <div className="w-1 h-1 bg-green-500 rounded-full" />
                    {t('statusOnline')}
                </div>
            </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
            <X size={18} />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex flex-col gap-2 max-w-[85%]",
            m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
          )}>
            <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed",
                m.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
            )}>
              {m.content}
            </div>
            <div className="flex items-center gap-1.5 opacity-30">
                {m.role === 'ai' ? <Bot size={10} /> : <User size={10} />}
                <span className="text-[10px] font-black uppercase tracking-tighter">{m.role === 'ai' ? t('botName') : t('userName')}</span>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex items-center gap-2 opacity-50 px-2">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span className="text-[10px] uppercase font-bold tracking-widest">{t('thinking')}</span>
            </div>
        )}
      </div>

      <div className="p-6 bg-black/40 border-t border-white/5">
        <div className="flex gap-2">
            <Input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={t('inputPlaceholder')}
                className="bg-white/5 border-white/10 rounded-xl h-12 focus:border-primary/50 transition-all font-medium"
            />
            <Button onClick={handleSend} disabled={isLoading} className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/80 transition-all shrink-0">
                <Send size={18} />
            </Button>
        </div>
      </div>
    </motion.div>
  );
}
