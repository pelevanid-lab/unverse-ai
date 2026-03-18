
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile, ContentPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, CheckCircle, Coins, Calendar, Loader2, ArrowLeft, Gift } from 'lucide-react';
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
      (snap) => {
        setPosts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost)));
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
  const { coverImage, category, subscriptionPriceMonthly } = creatorData || {};

  return (
    <div className="relative pb-12">
      <Button variant="ghost" onClick={() => router.back()} className="absolute top-6 left-6 z-20 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm rounded-full p-2 h-auto">
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <header className="relative pt-24 pb-12 px-6 rounded-3xl overflow-hidden glass-card border-white/10 flex items-end">
        {coverImage && 
          <img src={coverImage} alt="Cover image" className="absolute inset-0 w-full h-full object-cover -z-10" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent -z-10" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 w-full">
          <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-2xl shrink-0">
            <AvatarImage src={avatar} className="object-cover"/>
            <AvatarFallback>{username?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h1 className="text-4xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">
              {username}
              {isCreator && <CheckCircle className="w-6 h-6 text-primary fill-primary/10" />}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">{bio}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
              {category && <Badge variant="secondary" className="gap-1"><Coins className="w-3 h-3" /> {category}</Badge>}
              <Badge variant="outline" className="gap-1"><Calendar className="w-3 h-3" /> Joined {createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}</Badge>
            </div>
          </div>
          <div className="flex flex-col gap-3 min-w-[200px] shrink-0">
            {isSubscribed ? (
              <Button disabled className="bg-green-500/20 text-green-400 border border-green-500/30 gap-2 h-14 rounded-2xl w-full">
                <Crown className="w-5 h-5" /> Active Subscriber
              </Button>
            ) : (
              <Button 
                onClick={handleSubscribeClick} 
                disabled={isSelf || !isCreator}
                className="bg-primary hover:bg-primary/90 gap-2 h-14 rounded-2xl w-full font-bold shadow-lg shadow-primary/20"
              >
                <Crown className="w-5 h-5" />
                Subscribe ({subscriptionPriceMonthly ?? 0} ULC)
              </Button>
            )}

            {/* Tip button can remain as a dialog, or be moved to its own page later if desired */}
            <Button variant="outline" disabled={isSelf || !isCreator} className="h-12 rounded-2xl border-white/10 hover:bg-white/5 gap-2">
                <Gift className="w-4 h-4" /> Tip Creator
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-4">
        <main className="space-y-6">
            <ProfileContentFeed posts={posts} creator={profile} isSubscribed={isSubscribed}/>
        </main>
      </div>
    </div>
  );
}
