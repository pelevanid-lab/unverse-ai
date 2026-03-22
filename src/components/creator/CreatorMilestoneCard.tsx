"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Award, Sparkles, TrendingUp, Loader2, Info } from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

export function CreatorMilestoneCard({ user }: { user: UserProfile }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const t = useTranslations('Creator');

    const handleJoin = async () => {
        setLoading(true);
        try {
            const joinFn = httpsCallable(functions, 'joinCreatorProgram');
            await joinFn();
            toast({ title: t('welcomeRewardTitle'), description: "200 ULC granted (60 Promo / 140 Locked)" });
            window.location.reload(); // Refresh to get updated user state
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Join Failed", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (!user.creatorInFirst100Program) {
        return (
            <Card className="glass-card border-pink-500/30 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 blur-[50px] rounded-full -z-10" />
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-pink-500/10">
                            <Award className="text-pink-400 w-5 h-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] text-pink-400 border-pink-500/30">FIRST 100 SPECIAL</Badge>
                    </div>
                    <CardTitle className="text-xl font-headline font-bold mt-2">
                        {t('milestoneProgramTitle')}
                    </CardTitle>
                    <CardDescription>
                        {t('milestoneProgramDesc')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Welcome Reward</p>
                            <p className="text-lg font-bold text-pink-500">200 ULC</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Milestone Bonus</p>
                            <p className="text-lg font-bold text-purple-500">+200 ULC</p>
                        </div>
                    </div>
                    <Button 
                        onClick={handleJoin} 
                        disabled={loading} 
                        className="w-full h-12 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl gap-2 shadow-lg shadow-pink-500/20"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Sparkles className="w-4 h-4" /> {t('joinProgramNow')}</>}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const unlocks = user.totalUniquePremiumUnlocks || 0;
    const rewards = user.totalMilestoneRewardULC || 0;
    const progress = (unlocks % 20) / 20 * 100;
    const nextMilestone = 20 - (unlocks % 20);

    return (
        <Card className="glass-card border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <TrendingUp className="text-primary w-5 h-5" />
                        </div>
                        <CardTitle className="text-lg font-headline font-bold">
                            {t('milestoneProgressTitle')}
                        </CardTitle>
                    </div>
                    <Badge className="bg-primary text-black font-bold">ACTIVE</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Unique Buyers</p>
                        <p className="text-2xl font-headline font-bold">{unlocks}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Rewards Earned</p>
                        <p className="text-2xl font-headline font-bold text-yellow-400">{rewards} <span className="text-xs">ULC</span></p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-end">
                        <p className="text-xs font-medium">{t('nextMilestoneIn', { count: nextMilestone })}</p>
                        <p className="text-[10px] text-muted-foreground">{unlocks % 20} / 20</p>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-white/5 p-2 rounded-lg">
                        <Info className="w-3 h-3" />
                        <p>{t('milestoneRuleHint')}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
