
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile, ContentPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, CheckCircle, Calendar, Loader2, ChevronLeft } from 'lucide-react';
import { ProfileContentFeed } from '@/components/profile/ProfileContentFeed';


export default function PublicProfilePage() {
  const { uid } = useParams();
  const { user: currentUser } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    const userDocRef = doc(db, 'users', uid as string);
    const unsubUser = onSnapshot(userDocRef, (userSnap) => {
      if (userSnap.exists()) {
        setProfile(userSnap.data() as UserProfile);
      } else {
        router.push('/'); // Redirect if user not found
      }
      setLoading(false);
    });

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('creatorId', '==', uid), orderBy('createdAt', 'desc')),
      Snap => {
        setPosts(Snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost)));
      }
    );

    return () => {
      unsubUser();
      unsubPosts();
    };
  }, [uid, router]);

  useEffect(() => {
    // Update subscription status whenever the current user's subscriptions change
    setIsSubscribed(currentUser?.activeSubscriptionIds?.includes(uid as string) ?? false);
  }, [currentUser, uid]);

  const handleSubscribeClick = () => {
    if (!uid) return;
    router.push(`/subscribe/${uid}`);
  };

  if (loading || !profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  const isSelf = currentUser?.uid === uid;
  const { username, bio, avatar, isCreator, creatorData, createdAt } = profile;
  const { coverImage, subscriptionPriceMonthly } = creatorData || {};

  return (
    <div className="relative pb-12 px-4 max-w-5xl mx-auto">
      <header className="relative pt-32 pb-12 px-8 rounded-[2.5rem] overflow-hidden glass-card border-white/10 mt-6 shadow-2xl">
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="absolute top-6 left-6 z-20 h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/10"
        >
            <ChevronLeft className="w-6 h-6" />
        </Button>

        {coverImage && 
          <img src={coverImage} alt="Cover image" className="absolute inset-0 w-full h-full object-cover -z-10" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent -z-10" />
        
        <div className="flex flex-col md:flex-row items-center gap-10 w-full">
          <Avatar className="w-40 h-40 border-4 border-white/10 shadow-2xl shrink-0">
            <AvatarImage src={avatar} className="object-cover"/>
            <AvatarFallback className="text-4xl">{username?.[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="space-y-1">
                <h1 className="text-5xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">
                {username}
                {isCreator && <CheckCircle className="w-8 h-8 text-primary fill-primary/10" />}
                </h1>
                <p className="text-xl text-muted-foreground/90 font-medium leading-relaxed max-w-2xl">{bio}</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
              <Badge variant="outline" className="gap-2 px-4 py-1.5 rounded-full bg-white/5 border-white/10 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Calendar className="w-4 h-4" /> 
                Joined {createdAt ? new Date(createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-4 min-w-[240px] shrink-0">
            {isSubscribed ? (
              <Button disabled className="bg-green-500/10 text-green-400 border border-green-500/20 gap-2 h-16 rounded-2xl w-full text-lg font-bold shadow-xl shadow-green-500/5">
                <Crown className="w-6 h-6" /> Active Subscriber
              </Button>
            ) : (
              <Button 
                onClick={handleSubscribeClick} 
                disabled={isSelf || !isCreator}
                className="bg-primary hover:bg-primary/90 gap-3 h-16 rounded-2xl w-full text-xl font-bold shadow-2xl shadow-primary/30"
              >
                <Crown className="w-6 h-6" />
                Subscribe ({subscriptionPriceMonthly ?? 0} USDT)
              </Button>
            )}
            
            {!isSelf && isCreator && (
                 <p className="text-[10px] text-center text-muted-foreground/60 font-medium uppercase tracking-[0.2em]">
                    Unlock Premium Content
                 </p>
            )}
          </div>
        </div>
      </header>

      <div className="mt-10">
        <main className="space-y-8">
            <ProfileContentFeed posts={posts} creator={profile} isSubscribed={isSubscribed}/>
        </main>
      </div>
    </div>
  );
}
