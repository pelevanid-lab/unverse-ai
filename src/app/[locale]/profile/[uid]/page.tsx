
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { UserProfile, ContentPost } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, CheckCircle, Calendar, Loader2, ChevronLeft, Lock, Globe, Clock, MessageSquare } from 'lucide-react';
import { PostGrid } from '@/components/profile/PostGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { checkSubscription } from '@/lib/access';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

function LockedStateUI({ creatorName, onSubscribe }: { creatorName: string, onSubscribe: () => void }) {
    const t = useTranslations('PublicProfile');
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 glass-card rounded-[2.5rem] border-white/5 bg-white/[0.02] animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <Lock className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
                <h2 className="text-3xl font-headline font-bold">{t('subscribersOnly')}</h2>
                <p className="text-muted-foreground max-w-sm mx-auto">{t('subscribeDesc', { creatorName })}</p>
            </div>
            <Button onClick={onSubscribe} size="lg" className="rounded-2xl px-10 h-14 text-lg font-bold shadow-xl shadow-primary/20">
                <Crown className="w-5 h-5 mr-2" /> {t('subscribe')}
            </Button>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">{t('premiumLimitedNote')}</p>
        </div>
    );
}

export default function PublicProfilePage() {
  const t = useTranslations('PublicProfile');
  const { uid } = useParams();
  const { user: currentUser } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('public');
  
  const [premiumAccess, setPremiumAccess] = useState<boolean>(false);
  const [limitedAccess, setLimitedAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!uid) return;

    setLoading(true);
    const fetchProfile = async () => {
        const id = uid as string;
        const userDocRef = doc(db, 'users', id);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            setProfile(userSnap.data() as UserProfile);
        } else {
            router.push('/');
        }
        setLoading(false);
    };

    fetchProfile();

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('creatorId', '==', uid), orderBy('createdAt', 'desc')),
      Snap => {
        setPosts(Snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost)));
      }
    );

    return () => {
      unsubPosts();
    };
  }, [uid, router]);

  useEffect(() => {
      const verifyAccess = async () => {
          if (!uid) return;
          setCheckingAccess(true);
          const isSelf = currentUser?.uid === uid;
          if (isSelf) {
              setPremiumAccess(true);
              setLimitedAccess(true);
              setIsSubscribed(true);
          } else if (currentUser?.uid) {
              const active = await checkSubscription(currentUser.uid, uid as string);
              setIsSubscribed(active);
              setPremiumAccess(active);
              setLimitedAccess(active);
          } else {
              setIsSubscribed(false);
              setPremiumAccess(false);
              setLimitedAccess(false);
          }
          setCheckingAccess(false);
      };
      verifyAccess();
  }, [currentUser, uid]);

  const handleSubscribeClick = () => {
    if (!uid) return;
    router.push(`/subscribe/${uid}`);
  };

  const handleMessageClick = async () => {
    if (!currentUser?.uid || !uid) return;
    
    try {
        const chatsRef = collection(db, 'chats');
        const q = query(
            chatsRef, 
            where('creatorId', '==', uid),
            where('subscriberId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            router.push(`/messages?chatId=${querySnapshot.docs[0].id}`);
        } else {
            const newChatDoc = await addDoc(chatsRef, {
                participants: [currentUser.uid, uid],
                creatorId: uid,
                creatorName: username || 'Creator',
                creatorAvatar: avatar || '',
                subscriberId: currentUser.uid,
                subscriberName: currentUser.username || 'User',
                subscriberAvatar: currentUser.avatar || '',
                lastMessage: '',
                lastTimestamp: Date.now(),
                unreadCount: 0,
                createdAt: Date.now()
            });
            router.push(`/messages?chatId=${newChatDoc.id}`);
        }
    } catch (error) {
        console.error("Failed to initiate chat:", error);
        toast({
            title: "Error",
            description: "Failed to open chat.",
            variant: "destructive"
        });
    }
  };

  if (loading || !profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  const isSelf = currentUser?.uid === uid;
  const { username, bio, avatar, isCreator, creatorData, createdAt } = profile;
  const { coverImage, subscriptionPriceMonthly } = creatorData || {};

  const publicPosts = posts.filter(p => p.contentType === 'public');
  const premiumPosts = posts.filter(p => p.contentType === 'premium');
  const limitedPosts = posts.filter(p => p.contentType === 'limited');

  return (
    <div className="relative pb-12 px-4 max-w-5xl mx-auto">
      <header className="relative pt-32 pb-12 px-8 rounded-[2.5rem] overflow-hidden glass-card border-white/10 mt-6 shadow-2xl">
        <Link href="/" className="absolute top-6 left-6 z-20">
            <Button 
                variant="outline"
                className="bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/10"
            >
                {t('backToDiscover')}
            </Button>
        </Link>

        {coverImage && <img src={coverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover -z-10" />}
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
                    <Calendar className="w-4 h-4" /> {t('joined', { date: createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A' })}
                </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px] shrink-0">
            {isSubscribed && !isSelf ? (
              <div className="flex flex-col gap-2">
                <Button disabled className="bg-green-500/10 text-green-400 border border-green-500/20 gap-2 h-16 rounded-2xl w-full text-lg font-bold">
                  <Crown className="w-6 h-6" /> {t('activeSubscriber')}
                </Button>
                <Button onClick={handleMessageClick} variant="outline" className="border-primary/20 hover:bg-primary/5 gap-3 h-14 rounded-2xl w-full font-bold">
                  <MessageSquare className="w-5 h-5" /> {t('message')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button onClick={handleSubscribeClick} disabled={isSelf || !isCreator} className="bg-primary hover:bg-primary/90 gap-3 h-16 rounded-2xl w-full text-xl font-bold shadow-2xl shadow-primary/30">
                  <Crown className="w-6 h-6" /> {t('subscribePrice', { price: subscriptionPriceMonthly ?? 0 })}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mt-10 space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-16 bg-muted/20 p-1.5 rounded-[2rem] border border-white/5 mb-10">
                <TabsTrigger value="public" className="rounded-2xl text-base font-headline font-bold gap-2 data-[state=active]:bg-white/10">
                    <Globe className="w-4 h-4" /> {t('publicTab')}
                </TabsTrigger>
                <TabsTrigger value="premium" className="rounded-2xl text-base font-headline font-bold gap-2 data-[state=active]:bg-primary">
                    <Lock className="w-4 h-4" /> {t('premiumTab')}
                </TabsTrigger>
                <TabsTrigger value="limited" className="rounded-2xl text-base font-headline font-bold gap-2 data-[state=active]:bg-yellow-500/80 data-[state=active]:text-black">
                    <Clock className="w-4 h-4" /> {t('limitedTab')}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="public" className="mt-0">
                <PostGrid postsToShow={publicPosts} unlockedPostIds={currentUser?.unlockedPostIds || []} onPostUnlocked={() => {}} />
            </TabsContent>

            <TabsContent value="premium" className="mt-0">
                {checkingAccess ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
                ) : premiumAccess ? (
                    <PostGrid postsToShow={premiumPosts} unlockedPostIds={currentUser?.unlockedPostIds || []} onPostUnlocked={() => {}} />
                ) : (
                    <LockedStateUI creatorName={username} onSubscribe={handleSubscribeClick} />
                )}
            </TabsContent>

            <TabsContent value="limited" className="mt-0">
                {checkingAccess ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
                ) : limitedAccess ? (
                    <PostGrid postsToShow={limitedPosts} unlockedPostIds={currentUser?.unlockedPostIds || []} onPostUnlocked={() => {}} />
                ) : (
                    <LockedStateUI creatorName={username} onSubscribe={handleSubscribeClick} />
                )}
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
