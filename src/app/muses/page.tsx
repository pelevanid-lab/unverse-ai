
"use client"

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AIMuse } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageCircle, Heart, Star, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function AIMusesPage() {
  const [muses, setMuses] = useState<AIMuse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'ai_muses'));
    const unsub = onSnapshot(q, (snap) => {
      setMuses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AIMuse)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-headline font-bold gradient-text flex items-center gap-3">
          <Sparkles className="w-10 h-10" /> AI Muses
        </h1>
        <p className="text-muted-foreground">Interact with our platform-owned digital influencers.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1,2,3].map(i => <Card key={i} className="glass-card aspect-[3/5] animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {muses.map(muse => (
            <Card key={muse.id} className="glass-card overflow-hidden group">
              <div className="relative aspect-[3/4]">
                <img 
                  src={muse.avatar} 
                  alt={muse.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 space-y-2">
                  <Badge className="bg-primary/80 backdrop-blur-sm">{muse.category}</Badge>
                  <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
                    {muse.name} {muse.isOfficial && <CheckCircle className="w-4 h-4 text-primary" />}
                  </h2>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{muse.personality}</p>
              </CardContent>
              <CardFooter className="p-6 pt-0 gap-3">
                <Link href={`/muses/${muse.id}/chat`} className="flex-1">
                  <Button className="w-full bg-primary hover:bg-primary/90 gap-2">
                    <MessageCircle className="w-4 h-4" /> Chat
                  </Button>
                </Link>
                <Button variant="outline" className="flex-1 gap-2">
                  <Heart className="w-4 h-4" /> Support
                </Button>
              </CardFooter>
            </Card>
          ))}
          {muses.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed rounded-3xl border-white/5">
              <p className="text-muted-foreground">No Muses available. Visit Admin Panel to seed.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
