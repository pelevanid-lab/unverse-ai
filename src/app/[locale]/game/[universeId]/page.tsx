"use client"

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Scroll, Lock, Unlock, Users, Zap, ChevronRight, Trophy, Flame, Map as MapIcon, Info } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getUniverse, getChestsByUniverse } from '@/lib/game-engine';
import { Universe, TreasureChest } from '@/lib/types';
import { Button } from '@/components/ui/button';

const RARITY_STYLES: Record<string, { color: string; glow: string; label: string }> = {
    genesis:   { color: 'text-red-400',    glow: 'shadow-red-500/30',    label: 'GENESIS' },
    legendary: { color: 'text-yellow-400', glow: 'shadow-yellow-500/30', label: 'LEGENDARY' },
    rare:      { color: 'text-purple-400', glow: 'shadow-purple-500/30', label: 'RARE' },
    uncommon:  { color: 'text-blue-400',   glow: 'shadow-blue-500/30',   label: 'UNCOMMON' },
    common:    { color: 'text-gray-400',   glow: 'shadow-gray-500/20',   label: 'COMMON' },
};

export default function UniversePage() {
    const params = useParams();
    const universeId = params.universeId as string;
    const t = useTranslations('Game');

    const [universe, setUniverse] = useState<Universe | null>(null);
    const [chests, setChests] = useState<TreasureChest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [u, c] = await Promise.all([
                    getUniverse(universeId),
                    getChestsByUniverse(universeId)
                ]);
                setUniverse(u);
                setChests(c);
            } catch (e) {
                console.error('Failed to load universe:', e);
            }
            setLoading(false);
        };
        load();
    }, [universeId]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
        </div>
    );

    if (!universe) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <MapIcon className="w-16 h-16 opacity-10 mb-6" />
            <h1 className="text-2xl font-black mb-2">Universe Not Found</h1>
            <p className="text-muted-foreground text-center mb-8">This dimensional fold does not exist or has collapsed.</p>
            <Link href="/"><Button variant="outline">Back to Hub</Button></Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* ── UNIVERSE HERO ── */}
            <div className="relative h-[60vh] min-h-[400px] overflow-hidden flex items-end">
                {/* Background Image/Gradient */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
                    {universe.coverImageUrl ? (
                        <img src={universe.coverImageUrl} className="w-full h-full object-cover" alt={universe.name} />
                    ) : (
                        <div className="w-full h-full bg-neutral-900" style={{ backgroundColor: universe.ambientTheme || '#111' }} />
                    )}
                </div>

                <div className="relative z-20 max-w-5xl mx-auto px-6 pb-12 w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-black/40 border border-yellow-500/30 flex items-center justify-center">
                                <Scroll className="w-5 h-5 text-yellow-500" />
                            </div>
                            <span className="text-xs font-black tracking-[0.4em] text-yellow-500/80 uppercase">{universe.tagline}</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black font-headline tracking-tighter mb-4 uppercase leading-none">
                            {universe.name}
                        </h1>
                        <p className="max-w-2xl text-lg text-foreground/80 leading-relaxed">
                            {universe.description}
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* ── CONTENT GRID ── */}
            <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
                
                {/* Left: Lore & Meta */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="p-6 rounded-2xl bg-card/20 border border-white/5 space-y-4">
                        <h2 className="text-xs font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                            <Info className="w-4 h-4 text-yellow-500/60" /> Dimensional Lore
                        </h2>
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {universe.lore || "No detailed records exist for this timeline yet."}
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-card/20 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">Atmosphere</span>
                            <span className="text-[10px] font-black text-yellow-500 uppercase">{universe.atmosphereType}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">Exploration</span>
                            <span className="text-lg font-black text-foreground">{universe.chestsOpened} / {universe.totalChests}</span>
                        </div>
                        <div className="mt-4 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-yellow-500 transition-all duration-1000" 
                                style={{ width: `${(universe.chestsOpened / universe.totalChests) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Chest List */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-sm font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                        <Box className="w-4 h-4" /> Available Seals
                    </h2>
                    
                    <div className="grid gap-3">
                        {chests.map((chest, i) => {
                            const rarity = RARITY_STYLES[chest.rarity] || RARITY_STYLES.common;
                            const isSolved = chest.status === 'first_unlocked' || chest.status === 'permanently_open';

                            return (
                                <motion.div
                                    key={chest.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Link href={`/game/${universeId}/chest/${chest.id}`}>
                                        <div className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 ${
                                            isSolved 
                                                ? 'bg-white/5 border-white/5 opacity-60' 
                                                : 'bg-card/40 border-white/10 hover:border-yellow-500/30 hover:bg-card shadow-lg hover:shadow-yellow-500/5'
                                        }`}>
                                            <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                {isSolved ? <Unlock className="w-6 h-6 text-green-500/40" /> : <Lock className={`w-6 h-6 ${rarity.color}`} />}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-[10px] font-black tracking-widest mb-0.5 ${rarity.color}`}>
                                                    {rarity.label}
                                                </div>
                                                <div className="font-bold truncate text-foreground group-hover:text-yellow-400 transition-colors uppercase">
                                                    {chest.name}
                                                </div>
                                            </div>

                                            <div className="text-right flex-shrink-0 pr-2">
                                                {!isSolved ? (
                                                    <div className="text-lg font-black text-yellow-400">
                                                        {chest.baseRewardULC.toLocaleString()}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm font-bold text-green-500">SOLVED</div>
                                                )}
                                                <div className="text-[10px] text-muted-foreground font-bold tracking-tighter uppercase">Reward</div>
                                            </div>
                                            
                                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
