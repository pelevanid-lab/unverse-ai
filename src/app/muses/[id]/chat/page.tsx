"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { AIMuse, ChatMessage } from '@/lib/types';
import { museChat } from '@/ai/flows/muse-chat-flow';
import { processChatFee } from '@/lib/ledger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, ArrowLeft, Coins, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function MuseChatPage() {
  const { id } = useParams();
  const { user, isConnected } = useWallet();
  const router = useRouter();
  const { toast } = useToast();
  const [muse, setMuse] = useState<AIMuse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMuse = async () => {
      const docRef = doc(db, 'muses', id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setMuse(snap.data() as AIMuse);
      } else {
        router.push('/muses');
      }
    };
    fetchMuse();
  }, [id, router]);

  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, 'users', user.uid, 'muses', id as string, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
    });
    return () => unsub();
  }, [user, id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !muse || loading) return;

    setLoading(true);
    const userMessage = input.trim();
    setInput('');

    try {
      // 1. Process economic fee for AI interaction
      await processChatFee(user);

      // 2. Save user message to Firestore
      const messagesRef = collection(db, 'users', user.uid, 'muses', id as string, 'messages');
      await addDoc(messagesRef, {
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      });

      // 3. Call Genkit Flow for AI Response
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await museChat({
        museId: muse.id,
        museName: muse.name,
        musePersonality: muse.personality,
        museTone: muse.tone,
        history,
        userMessage
      });

      // 4. Save AI message to Firestore
      await addDoc(messagesRef, {
        role: 'model',
        content: response.reply,
        timestamp: Date.now()
      });

    } catch (err: any) {
      toast({ 
        variant: 'destructive', 
        title: "Communication Error", 
        description: err.message || "Failed to send message." 
      });
      setInput(userMessage); // Restore input on error
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <h1 className="text-3xl font-headline font-bold">Please Connect</h1>
      <p className="text-muted-foreground">You must connect your wallet to chat with AI Muses.</p>
      <Button onClick={() => router.push('/')}>Go Back</Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col gap-4">
      <header className="flex items-center justify-between bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/muses')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Avatar className="w-10 h-10 border border-primary/20">
            <AvatarImage src={muse?.avatar} />
            <AvatarFallback>{muse?.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-headline font-bold flex items-center gap-2">
              {muse?.name} <Sparkles className="w-3 h-3 text-primary" />
            </h2>
            <p className="text-[10px] text-muted-foreground font-mono">{muse?.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full border border-white/5">
          <Coins className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold">0.5 ULC / msg</span>
        </div>
      </header>

      <Card className="flex-1 flex flex-col glass-card border-white/10 overflow-hidden">
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <p className="text-muted-foreground">Start a conversation with {muse?.name}.</p>
                <p className="text-[10px] text-muted-foreground italic">"I've been waiting for someone like you to bridge the gap."</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                  m.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-muted/50 border border-white/5 rounded-tl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-muted/20">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${muse?.name}...`}
              className="bg-background/50 border-white/10 h-12 rounded-xl"
              disabled={loading}
            />
            <Button 
              type="submit" 
              disabled={loading || !input.trim()} 
              className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
