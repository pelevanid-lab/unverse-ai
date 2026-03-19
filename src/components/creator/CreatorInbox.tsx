
"use client";

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, setDoc, limit } from 'firebase/firestore';
import { Chat, Message, UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, Search } from 'lucide-react';

export function CreatorInbox() {
  const { user } = useWallet();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Chats for this Creator
  useEffect(() => {
    if (!user?.uid) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
        chatsRef, 
        where('creatorId', '==', user.uid),
        orderBy('lastTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(fetchedChats);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Fetch Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat) {
        setMessages([]);
        return;
    }

    const messagesRef = collection(db, 'chats', selectedChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });

    return () => unsubscribe();
  }, [selectedChat]);

  // 3. Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user || sending) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
        const chatRef = doc(db, 'chats', selectedChat.id);
        const messagesRef = collection(db, 'chats', selectedChat.id, 'messages');

        // Add message
        await addDoc(messagesRef, {
            senderId: user.uid,
            content,
            timestamp: Date.now()
        });

        // Update chat metadata
        await updateDoc(chatRef, {
            lastMessage: content,
            lastTimestamp: Date.now(),
            unreadCount: 0 // Reset unread when creator responds
        });

    } catch (error) {
        console.error("Failed to send message:", error);
    } finally {
        setSending(false);
    }
  };

  if (loadingChats) {
      return <div className="flex items-center justify-center h-[500px]"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 h-[600px] glass-card border-white/10 overflow-hidden rounded-[2rem]">
      {/* Sidebar: Chat List */}
      <div className="md:col-span-4 border-r border-white/5 flex flex-col bg-white/[0.02]">
        <div className="p-4 border-b border-white/5">
            <h3 className="font-headline font-bold text-lg px-2">Supporters</h3>
        </div>
        <ScrollArea className="flex-1">
            {chats.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No active conversations yet.</div>
            ) : (
                <div className="p-2 space-y-1">
                    {chats.map(chat => (
                        <div 
                            key={chat.id} 
                            onClick={() => setSelectedChat(chat)}
                            className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${selectedChat?.id === chat.id ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5'}`}
                        >
                            <Avatar className="h-10 w-10 border border-white/10">
                                <AvatarImage src={chat.subscriberAvatar} />
                                <AvatarFallback>{chat.subscriberName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{chat.subscriberName}</p>
                                <p className={`text-xs truncate ${selectedChat?.id === chat.id ? 'text-white/70' : 'text-muted-foreground'}`}>{chat.lastMessage}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="md:col-span-8 flex flex-col bg-black/20">
        {selectedChat ? (
            <>
                {/* Chat Header */}
                <header className="p-4 border-b border-white/5 flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarImage src={selectedChat.subscriberAvatar} />
                        <AvatarFallback>{selectedChat.subscriberName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{selectedChat.subscriberName}</span>
                </header>

                {/* Messages */}
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 px-4 rounded-2xl text-sm ${msg.senderId === user?.uid ? 'bg-primary text-white rounded-tr-none' : 'bg-muted/50 border border-white/5 rounded-tl-none'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/20 flex gap-2">
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="bg-background/50 border-white/10 h-12 rounded-xl"
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending} className="h-12 w-12 rounded-xl">
                        {sending ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                    </Button>
                </form>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Select a supporter</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">Click on a conversation to start chatting with your supporters.</p>
            </div>
        )}
      </div>
    </div>
  );
}
