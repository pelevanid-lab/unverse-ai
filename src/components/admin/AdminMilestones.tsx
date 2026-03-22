"use client"

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { UserProfile, SystemConfig } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Users, Award, TrendingUp } from 'lucide-react';

export function AdminMilestones() {
    const [participants, setParticipants] = useState<UserProfile[]>([]);
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubParticipants = onSnapshot(
            query(collection(db, 'users'), where('creatorInFirst100Program', '==', true)),
            (snap) => {
                setParticipants(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
                setLoading(false);
            }
        );

        const unsubConfig = onSnapshot(doc(db, 'config', 'system'), (snap) => {
            if (snap.exists()) setConfig(snap.data() as SystemConfig);
        });

        return () => { unsubParticipants(); unsubConfig(); };
    }, []);

    const totalDistributed = config?.totalCreatorRewardsULC || 0;
    const participantCount = config?.creatorProgramCount || 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card border-primary/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-primary/10">
                                <Users className="text-primary w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground font-bold uppercase">Participants</p>
                                <p className="text-2xl font-headline font-bold">{participantCount} / 100</p>
                            </div>
                        </div>
                        <Progress value={participantCount} className="h-1.5 mt-4" />
                    </CardContent>
                </Card>

                <Card className="glass-card border-yellow-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-yellow-500/10">
                                <Award className="text-yellow-500 w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground font-bold uppercase">Total Rewards</p>
                                <p className="text-2xl font-headline font-bold">{totalDistributed.toLocaleString()} ULC</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-green-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-green-500/10">
                                <TrendingUp className="text-green-500 w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground font-bold uppercase">Avg. Unlocks</p>
                                <p className="text-2xl font-headline font-bold">
                                    {participantCount > 0 
                                        ? (participants.reduce((acc, p) => acc + (p.totalUniquePremiumUnlocks || 0), 0) / participantCount).toFixed(1)
                                        : "0"
                                    }
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="text-yellow-400 w-5 h-5" />
                        First 100 Program Leaderboard
                    </CardTitle>
                    <CardDescription>Track individual creator performance and reward milestones.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Creator</TableHead>
                                <TableHead>Index</TableHead>
                                <TableHead>Unique Unlocks</TableHead>
                                <TableHead>Rewards Earned</TableHead>
                                <TableHead>Next Milestone</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {participants.sort((a, b) => (b.totalUniquePremiumUnlocks || 0) - (a.totalUniquePremiumUnlocks || 0)).map((p) => {
                                const unlocks = p.totalUniquePremiumUnlocks || 0;
                                const rewards = p.totalMilestoneRewardULC || 0;
                                const progress = (unlocks % 20) / 20 * 100;
                                
                                return (
                                    <TableRow key={p.uid}>
                                        <TableCell className="font-bold">
                                            {p.displayName || p.walletAddress?.slice(0, 6) + '...'}
                                        </TableCell>
                                        <TableCell>#{p.creatorProgramIndex}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {unlocks}
                                                <Badge variant="outline" className="text-[10px]">
                                                    {p.uniquePremiumUnlockBuyerIds?.length || 0} Buyers
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-yellow-500 font-bold">{rewards} ULC</TableCell>
                                        <TableCell className="min-w-[150px]">
                                            <div className="space-y-1">
                                                <Progress value={progress} className="h-1" />
                                                <p className="text-[10px] text-muted-foreground">{unlocks % 20} / 20</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {rewards >= 1000 ? (
                                                <Badge className="bg-green-500 text-black">MAXED</Badge>
                                            ) : (
                                                <Badge variant="secondary">ACTIVE</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {participants.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                                        No participants yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
