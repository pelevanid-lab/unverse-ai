"use client"

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AIMuse } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageCircle, Heart, Star } from 'lucide-react';

const SEED_MUSES: AIMuse[] = [
  {
    id: 'isabella',
    name: 'Isabella',
    category: 'Cyberpunk Artiste',
    personality: 'Mysterious, artistic, and deeply philosophical about the digital void.',
    tone: 'Dreamy & Sarcastic',
    flirtingLevel: 'medium',
    avatar: 'https://picsum.photos/seed/isabella/400/400'
  },
  {
    id: 'elena',
    name: 'Elena',
    category: 'Fitness Mentor',
    personality: 'High-energy, supportive, and obsessed with the intersection of code and physical health.',
    tone: 'Motivational & Direct',
    flirtingLevel: 'low',
    avatar: 'https://picsum.photos/seed/elena/400/400'
  },
  {
    id: 'chloe',
    name: 'Chloe',
    category: 'Tech Enthusiast',
    personality: 'Gamer girl vibes, rapid-fire speech, and a genius-level understanding of decentralized protocols.',
    tone: 'Playful & Hyper',
    flirtingLevel: 'high',
    avatar: 'https://picsum.photos/seed/chloe/400/400'
  }
];

export default function AIMusesPage() {
  const [muses, setMuses] = useState<AIMuse[]>(SEED_MUSES);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-headline font-bold gradient-text flex items-center gap-3">
          <Sparkles className="w-10 h-10" /> AI Muses
        </h1>
        <p className="text-muted-foreground">Interact with our platform-owned digital influencers.</p>
      </header>

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
                <h2 className="text-2xl font-headline font-bold">{muse.name}</h2>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase text-muted-foreground">Personality</p>
                <p className="text-sm text-muted-foreground">{muse.personality}</p>
              </div>
              <div className="flex gap-4">
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Tone</p>
                  <p className="text-sm font-medium">{muse.tone}</p>
                </div>
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Vibe</p>
                  <div className="flex gap-1">
                    {Array(muse.flirtingLevel === 'high' ? 3 : muse.flirtingLevel === 'medium' ? 2 : 1).fill(0).map((_, i) => (
                      <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 gap-3">
              <Button className="flex-1 bg-primary hover:bg-primary/90 gap-2">
                <MessageCircle className="w-4 h-4" /> Chat
              </Button>
              <Button variant="outline" className="flex-1 gap-2">
                <Heart className="w-4 h-4" /> Support
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}