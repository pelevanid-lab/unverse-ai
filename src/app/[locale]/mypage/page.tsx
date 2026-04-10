"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { 
    Trophy, Wallet, Settings, LogOut, Shield, Zap, 
    ChevronRight, Box, Users, History, Cpu, Star
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getHunterStats, getPlayerChestHistory } from '@/lib/game-engine';
import { ChestAttempt } from '@/lib/types';
import { Link } from '@/i18n/routing';

export default function MyPage() {
    const t = useTranslations('Game');
    const { user, isConnected, connectWallet, disconnectWallet } = useWallet();
    const [stats, setStats] = useState({ chestsFound: 0, totalEarned: 0, rank: 0 });
    const [history, setHistory] = useState<ChestAttempt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isConnected || !user) return;
        
        const wallet = user.walletAddress || user.uid;
        Promise.all([
            getHunterStats(wallet),
            getPlayerChestHistory(wallet)
        ]).then(([s, h]) => {
            setStats(s);
            setHistory(h);
        }).finally(() => setLoading(false));
    }, [isConnected, user]);

    if (!isConnected || !user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <Shield className="w-16 h-16 text-yellow-500/20 mb-6" />
                <h1 className="text-2xl font-black mb-2">Hunter Identification Required</h1>
                <p className="text-muted-foreground text-center max-w-xs mb-8">
                    Please transmit your credentials via wallet connection to access your core profile.
                </p>
                <Button onClick={connectWallet} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-8 py-6 rounded-2xl">
                    Identify Hunter
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* ── HUNTER ID HERO ── */}
            <div className="relative pt-12 pb-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />
                
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        {/* Avatar / Rank */}
                        <div className="relative">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-40 h-40 rounded-3xl border-4 border-yellow-500/20 bg-black/40 p-1 shadow-2xl overflow-hidden"
                            >
                                <Avatar className="w-full h-full rounded-2xl border border-white/10">
                                    <AvatarImage src={user.avatar || ''} className="object-cover" />
                                    <AvatarFallback className="bg-yellow-500/10 text-4xl font-black text-yellow-500">
                                        {user.username?.charAt(0) || 'H'}
                                    </AvatarFallback>
                                </Avatar>
                            </motion.div>
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-4 py-1 rounded-full border-4 border-background whitespace-nowrap uppercase tracking-widest">
                                Rank #{stats.rank || 'N/A'}
                            </div>
                        </div>

                        {/* Text Info */}
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter mb-2">
                                {user.username || 'Anonymous Hunter'}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-muted-foreground">
                                <span className="text-xs font-mono bg-white/5 border border-white/5 px-3 py-1 rounded-lg">
                                    {user.walletAddress?.slice(0, 8)}...{user.walletAddress?.slice(-8)}
                                </span>
                                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-yellow-500/70">
                                    <Shield className="w-3 h-3" />
                                    Active Operative
                                </div>
                            </div>
                            
                            <p className="mt-4 text-sm text-foreground/60 max-w-xl">
                                {user.bio || "No hunter clearance bio provided. Update your profile in management settings."}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            <Link href="/userprofilemanagement">
                                <Button variant="outline" className="w-full border-white/10 rounded-xl px-8 h-12 font-bold gap-2">
                                    <Settings className="w-4 h-4" /> Edit Profile
                                </Button>
                            </Link>
                            <Button onClick={disconnectWallet} variant="ghost" className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl px-8 h-12 font-bold gap-2">
                                <LogOut className="w-4 h-4" /> Disconnect
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── STATS GRID ── */}
            <div className="max-w-4xl mx-auto px-6 -mt-10 mb-12 relative z-20">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                                <Box className="w-3 h-3 text-yellow-500" /> Chests Found
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black font-headline text-yellow-400">{stats.chestsFound}</div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Global Universe Sync</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                                <Zap className="w-3 h-3 text-yellow-500" /> Hunting Credits
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black font-headline text-foreground">
                                {(user.ulcBalance?.available || 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Available ULC</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                                <Users className="w-3 h-3 text-yellow-500" /> Alliance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-black font-headline text-muted-foreground/40">NONE</div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase mt-1 animate-pulse text-yellow-500/60">Recruitment Open</div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── CONTENT TABS ── */}
            <div className="max-w-4xl mx-auto px-6 space-y-8">
                {/* Recent Unlocks */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                            <History className="w-4 h-4" /> Mission History
                        </h2>
                        <Link href="/inventory" className="text-xs font-bold text-yellow-500 hover:underline">View All Assets →</Link>
                    </div>
                    
                    <div className="space-y-2">
                        {loading ? (
                            <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
                        ) : history.length === 0 ? (
                            <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 text-muted-foreground italic text-sm">
                                No mission logs detected. Your career starts with the first chest.
                            </div>
                        ) : (
                            history.map((log, i) => (
                                <motion.div 
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                        <Trophy className="w-5 h-5 text-yellow-500/60" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold">{log.chestId}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                            Universe: {log.universeId} • {new Date(log.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-green-400">+{log.rewardULC?.toLocaleString()} ULC</div>
                                        {log.isFirstHunter && <div className="text-[9px] font-black text-yellow-500 uppercase tracking-tighter">FIRST HUNTER</div>}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Account Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Link href="/inventory" className="group">
                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] group-hover:bg-white/[0.05] group-hover:border-yellow-500/30 transition-all flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-yellow-500/10 p-2 rounded-lg"><Box className="w-5 h-5 text-yellow-500" /></div>
                                <span className="font-bold">Asset Vault</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                     </Link>
                     <Link href="/wallet" className="group">
                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] group-hover:bg-white/[0.05] group-hover:border-yellow-500/30 transition-all flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-yellow-500/10 p-2 rounded-lg"><Wallet className="w-5 h-5 text-yellow-500" /></div>
                                <span className="font-bold">Financial Terminal</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                     </Link>
                </div>
            </div>

            {/* Support Watermark */}
            <div className="max-w-4xl mx-auto px-6 mt-16 text-center opacity-20 pointer-events-none">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Cpu className="w-4 h-4" />
                    <span className="text-[10px] font-black tracking-[0.5em] uppercase">Unverse Tactical Systems</span>
                </div>
                <div className="text-[8px] font-bold uppercase tracking-widest">Identification Paper #{(user.uid||'').slice(0,16)}</div>
            </div>
        </div>
    );
}
