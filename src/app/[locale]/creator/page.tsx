
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ExternalLink, Settings, ChevronLeft, ChevronRight, Globe, MessageSquare, Megaphone, Package, Wand2, CreditCard, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { Link } from '@/i18n/routing';
import { CreatorTabs } from '@/components/creator/CreatorTabs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CreatorMilestoneCard } from '@/components/creator/CreatorMilestoneCard';

function BecomeCreator({ onBecomeCreator, loading }: { onBecomeCreator: () => void, loading: boolean }) {
  const router = useRouter();
  const t = useTranslations('Creator');
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center relative max-w-2xl mx-auto px-4">
       <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/mypage')} 
            className="absolute top-0 left-4 h-10 w-10 rounded-full bg-white/5"
        >
            <ChevronLeft className="w-6 h-6" />
        </Button>
       <Card className="glass-card w-full p-8 border-primary/20 shadow-2xl shadow-primary/10 mt-12">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 mx-auto">
            <DollarSign className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-3xl font-headline font-bold">{t('becomeCreatorTitle')}</CardTitle>
        <CardDescription className="mt-2 mb-8 text-base">{t('becomeCreatorDesc')}</CardDescription>
        <Button onClick={onBecomeCreator} disabled={loading} size="lg" className='w-full h-14 text-lg font-bold rounded-2xl'>
            {loading ? t('activating') : t('activateProfile')}
        </Button>
       </Card>
    </div>
  );
}

export default function CreatorPanel() {
  const t = useTranslations('Creator');
  const { user, isConnected } = useWallet();
  const router = useRouter();
  const [activationLoading, setActivationLoading] = useState(false);

  const handleBecomeCreator = async () => {
      if (!user?.uid) return;
      setActivationLoading(true);
      try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
              isCreator: true,
              bio: t('defaultBio'),
              creatorData: {
                  category: 'General',
                  coverImage: '',
                  subscriptionPriceMonthly: 10,
                  creatorStatus: 'active',
                  visibility: 'public',
              }
          });
      } catch (error: any) {
          console.error("Failed to activate creator profile:", error);
      } finally {
          setActivationLoading(false);
      }
  };

  if (!isConnected || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <DollarSign className="w-16 h-16 text-primary" />
        <h1 className="text-3xl font-headline font-bold">{t('portalTitle')}</h1>
        <p className="text-muted-foreground">{t('connectToManage')}</p>
        <Link href="/"><Button className="rounded-xl">{t('backToHome')}</Button></Link>
      </div>
    );
  }

  if (!user.isCreator) {
    return <BecomeCreator onBecomeCreator={handleBecomeCreator} loading={activationLoading} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-10 border-white/10">
        <div className="flex items-start gap-4">
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.push('/mypage')} 
                className="h-10 w-10 rounded-full bg-white/5 shrink-0"
            >
                <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
                <h1 className="text-5xl font-headline font-bold gradient-text tracking-tighter">{t('panelTitle')}</h1>
                <div className='mt-2'>
                    <Link href="/creator/settings" className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                        <span className="text-sm font-medium">{t('manageEmpire')}</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <Link href="/wallet" className='w-full'>
                <Card className="glass-card border-white/10 bg-white/5 flex items-center justify-center text-center px-8 py-4 rounded-[2rem] h-full hover:bg-primary/10 transition-colors cursor-pointer group min-w-[200px]">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t('totalBalance')}</p>
                        <p className="text-3xl font-bold font-headline group-hover:text-primary transition-colors">
                            {user?.ulcBalance?.available.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ULC</span>
                        </p>
                    </div>
                </Card>
            </Link>
            <div className="flex flex-col gap-2">
                <Link href={`/profile/${user?.uid}`} className="w-full">
                    <Button variant="outline" className="h-12 w-full rounded-2xl gap-2 px-6 border-white/10 hover:bg-white/5 font-bold">
                        <Globe className="w-4 h-4" /> {t('viewProfile')}
                    </Button>
                </Link>
                <Link href="/creator/settings" className="w-full">
                    <Button variant="secondary" className="h-12 w-full rounded-2xl gap-2 px-6 font-bold">
                        <Settings className="w-4 h-4" /> {t('settings')}
                    </Button>
                </Link>
            </div>
        </div>
      </header>

        <div className="flex flex-col gap-6 max-w-2xl mx-auto pt-8">
            <CreatorMilestoneCard user={user} />
            {/* 1. Havuz (Container) - Moved to top as requested */}
            <Link href="/creator/container" className="group">
                <Card className="glass-card border-white/10 group-hover:border-primary/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors"><Package className="w-6 h-6 text-primary" /></div>
                            <div>
                                <p className="font-bold">{t('containerTab')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('containerDesc')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                </Card>
            </Link>

            {/* 2. Copilot Studio (Renamed from AI Studio) */}
            <Link href="/creator/studio" className="group">
                <Card className="glass-card border-white/10 group-hover:border-fuchsia-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-fuchsia-500/10 rounded-xl group-hover:bg-fuchsia-500/20 transition-colors"><Wand2 className="w-6 h-6 text-fuchsia-400" /></div>
                            <div>
                                <p className="font-bold">{t('copilotStudioTab')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('copilotStudioDesc')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-fuchsia-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>


            <Link href="/creator/published" className="group">
                <Card className="glass-card border-white/10 group-hover:border-green-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-green-500/10 rounded-xl group-hover:bg-green-500/20 transition-colors"><Globe className="w-6 h-6 text-green-400" /></div>
                            <div>
                                <p className="font-bold">{t('publishedTab')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('publishedDesc')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-green-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>

            <Link href="/creator/promo-card" className="group">
                <Card className="glass-card border-white/10 group-hover:border-yellow-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:bg-yellow-500/20 transition-colors"><CreditCard className="w-6 h-6 text-yellow-400" /></div>
                            <div>
                                <p className="font-bold">{t('promoCardTab')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('promoCardDesc')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>

            <Link href="/creator/messages" className="group">
                <Card className="glass-card border-white/10 group-hover:border-blue-500/40 transition-all h-full bg-white/[0.02]">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className='flex items-center gap-4'>
                            <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors"><MessageSquare className="w-6 h-6 text-blue-400" /></div>
                            <div>
                                <p className="font-bold">{t('messagesTab')}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('messagesDesc')}</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                    </CardContent>
                </Card>
            </Link>
        </div>
    </div>
  );
}
