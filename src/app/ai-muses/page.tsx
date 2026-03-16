
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Loader2, Bot } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Muse } from '@/lib/types';

export default function AiMusesPage() {
  const { user, isConnected } = useWallet();
  const [ownedMuses, setOwnedMuses] = useState<Muse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const unsubMuses = onSnapshot(query(collection(db, 'muses'), where('ownerId', '==', user.uid)), (snap) => {
        setOwnedMuses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Muse)));
        setLoading(false);
    });

    return () => unsubMuses();
  }, [user]);


  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full"><Sparkles className="w-12 h-12 text-primary" /></div>
        <h1 className="text-3xl font-headline font-bold">Access Your Muses</h1>
        <p className="text-muted-foreground max-w-sm">Connect your wallet to view your owned AI Muses.</p>
        <Link href="/"><Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">Connect Now</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                <Bot className="w-8 h-8 text-teal-400" /> Owned AI Muses
            </h1>
            <Link href="/mypage">
                <Button variant="outline">Back to Dashboard</Button>
            </Link>
        </div>

       {loading ? 
         <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div> : 
         (ownedMuses.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {ownedMuses.map((muse) => (
                <Link key={muse.id} href={`/muses/${muse.id}/chat`} passHref>
                    <Card className="glass-card aspect-square flex flex-col items-center justify-center text-center p-4 hover:border-primary/50 transition-colors h-full">
                        <Avatar className="w-20 h-20 mb-3"><AvatarImage src={muse.avatar} /><AvatarFallback>{muse.name[0]}</AvatarFallback></Avatar>
                        <p className="font-bold text-lg">{muse.name}</p>
                        <p className="text-xs text-muted-foreground">{muse.personality}</p>
                    </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center space-y-4">
                    <p className="text-muted-foreground text-sm">You don't own any Muses yet.</p>
                    <Link href="/muses"><Button variant="outline" className="rounded-xl px-8 border-white/10">Explore Muses</Button></Link>
                </CardContent>
            </Card>
          ))}
    </div>
  );
}
