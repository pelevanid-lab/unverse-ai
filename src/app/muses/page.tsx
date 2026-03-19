
"use client"

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AIMuse } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
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
            <Link href={`/profile/${muse.id}`} key={muse.id} className="block">
              <Card className="glass-card overflow-hidden group cursor-pointer h-full flex flex-col">
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
                      {muse.name}
                    </h2>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4 flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2">{muse.personality}</p>
                </CardContent>
              </Card>
            </Link>
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
