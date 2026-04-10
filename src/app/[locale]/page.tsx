"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { getUniverses, getChestsByUniverse } from '@/lib/game-engine';
import { getDifficultyState, getDifficultyProfile, DifficultyState } from '@/lib/difficulty-engine';
import { Universe, TreasureChest } from '@/lib/types';
import { useWallet } from '@/hooks/use-wallet';
import { motion } from 'framer-motion';
import {
    Scroll, Lock, Unlock, Users, Zap,
    ChevronRight, Trophy, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const RARITY_STYLES: Record<string, { color: string; glow: string; labelKey: string }> = {
    genesis:   { color: 'text-red-400',    glow: 'shadow-red-500/30',    labelKey: 'rarityGenesis' },
    legendary: { color: 'text-yellow-400', glow: 'shadow-yellow-500/30', labelKey: 'rarityLegendary' },
    rare:      { color: 'text-purple-400', glow: 'shadow-purple-500/30', labelKey: 'rarityRare' },
    uncommon:  { color: 'text-blue-400',   glow: 'shadow-blue-500/30',   labelKey: 'rarityUncommon' },
    common:    { color: 'text-gray-400',   glow: 'shadow-gray-500/20',   labelKey: 'rarityCommon' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
    sealed:           <Lock className="w-4 h-4 text-yellow-500" />,
    hunted:           <Flame className="w-4 h-4 text-orange-500 animate-pulse" />,
    first_unlocked:   <Unlock className="w-4 h-4 text-green-500" />,
    permanently_open: <Unlock className="w-4 h-4 text-gray-500" />,
};

export default function UnfoldPage() {
    const t = useTranslations('Game');
    const { user, isConnected, connectWallet } = useWallet();
    const [universes, setUniverses] = useState<Universe[]>([]);
    const [chests, setChests] = useState<Record<string, TreasureChest[]>>({});
    const [difficulty, setDifficulty] = useState<DifficultyState | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeUniverse, setActiveUniverse] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [univs, diff] = await Promise.all([
                    getUniverses(),
                    getDifficultyState(),
                ]);
                setUniverses(univs);
                setDifficulty(diff);

                if (univs.length > 0) {
                    setActiveUniverse(univs[0].id);
                    const firstChests = await getChestsByUniverse(univs[0].id);
                    setChests({ [univs[0].id]: firstChests });
                }
            } catch (e) {
                console.error('Failed to load game data:', e);
            }
            setLoading(false);
        };
        load();
    }, []);

    const handleUniverseSelect = async (universeId: string) => {
        setActiveUniverse(universeId);
        if (!chests[universeId]) {
            const c = await getChestsByUniverse(universeId);
            setChests(prev => ({ ...prev, [universeId]: c }));
        }
    };

    const diffProfile = difficulty ? getDifficultyProfile(difficulty.currentDifficulty) : null;
    const activeChests = activeUniverse ? (chests[activeUniverse] || []) : [];
    const activeUniv = universes.find(u => u.id === activeUniverse);

    return (
        <div className="min-h-screen bg-background">
            {/* ── HERO ── */}
            <div
                className="relative w-full overflow-hidden"
                style={{
                    background: 'linear-gradient(180deg, #1a1000 0%, #0d0900 40%, transparent 100%)',
                    minHeight: '320px',
                }}
            >
                {/* Ambient particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 rounded-full bg-yellow-400/20"
                            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                            animate={{ opacity: [0.1, 0.6, 0.1], scale: [1, 1.5, 1] }}
                            transition={{ duration: 3 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3 }}
                        />
                    ))}
                </div>

                <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Scroll className="w-5 h-5 text-yellow-500" />
                            <span className="text-xs font-bold tracking-[0.3em] text-yellow-500/80 uppercase">
                                {t('heroTagline')}
                            </span>
                            <Scroll className="w-5 h-5 text-yellow-500" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black font-headline tracking-tighter mb-3"
                            style={{ textShadow: '0 0 60px rgba(251,191,36,0.3)' }}>
                            {t('heroTitle')}
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                            {t('heroSubtitle')}
                        </p>
                    </motion.div>

                    {/* Difficulty Badge */}
                    {diffProfile && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex items-center justify-center gap-4 mt-6"
                        >
                            <div
                                className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold"
                                style={{ borderColor: diffProfile.color + '50', color: diffProfile.color }}
                            >
                                <Zap className="w-4 h-4" />
                                {t('difficultyLabel')}: {diffProfile.label} ({difficulty?.currentDifficulty.toFixed(1)}x)
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-sm text-muted-foreground">
                                <Users className="w-4 h-4" />
                                {difficulty?.activeHunters || 0} {t('activeHunters')}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ── UNIVERSE SELECTOR ── */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Universe tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
                            {universes.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => handleUniverseSelect(u.id)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                        activeUniverse === u.id
                                            ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                                            : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {u.name}
                                </button>
                            ))}
                        </div>

                        {/* Active Universe Details */}
                        {activeUniv && (
                            <motion.div
                                key={activeUniv.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-8"
                            >
                                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-xl font-black font-headline tracking-tight text-yellow-400">
                                                🏛️ {activeUniv.name}
                                            </h2>
                                            <p className="text-muted-foreground text-sm mt-1">{activeUniv.tagline}</p>
                                            <p className="text-foreground/70 text-sm mt-3 max-w-xl leading-relaxed">
                                                {activeUniv.description}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-2xl font-black text-yellow-400">
                                                {activeUniv.chestsOpened}/{activeUniv.totalChests}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{t('chestsOpened')}</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Chest Grid */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-4">
                                {t('chests')}
                            </h3>
                            {activeChests.map((chest, i) => {
                                const rarity = RARITY_STYLES[chest.rarity] || RARITY_STYLES.common;
                                const isSealed = chest.status === 'sealed' || chest.status === 'hunted';

                                return (
                                    <motion.div
                                        key={chest.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.07 }}
                                    >
                                        <Link href={`/game/alexandria/chest/${chest.id}`}>
                                            <div className={`group relative rounded-2xl border bg-card/50 p-5 hover:bg-card transition-all duration-300 cursor-pointer ${
                                                chest.status === 'permanently_open'
                                                    ? 'border-white/10 opacity-70'
                                                    : `border-white/10 hover:border-yellow-500/30 hover:shadow-xl hover:${rarity.glow}`
                                            }`}>
                                                <div className="flex items-center gap-4">
                                                    {/* Rank */}
                                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-black text-muted-foreground flex-shrink-0">
                                                        {chest.sortOrder}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-black tracking-widest ${rarity.color}`}>
                                                                {t(rarity.labelKey as any)}
                                                            </span>
                                                            {STATUS_ICON[chest.status]}
                                                            {chest.status === 'hunted' && (
                                                                <span className="text-[9px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full border border-orange-500/20 font-bold animate-pulse">
                                                                    {t('activeHunt')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="font-bold text-foreground truncate">{chest.name}</div>
                                                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{chest.description}</div>
                                                    </div>

                                                    {/* Reward */}
                                                    <div className="text-right flex-shrink-0">
                                                        {isSealed ? (
                                                            <>
                                                                <div className="text-lg font-black text-yellow-400">
                                                                    {chest.baseRewardULC.toLocaleString()}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground font-bold">{t('rewardLabel')}</div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="text-sm font-bold text-green-500">{t('openLabel')}</div>
                                                                <div className="text-[10px] text-muted-foreground">{t('explorerBonus', { amount: chest.explorerBonusULC })}</div>
                                                            </>
                                                        )}
                                                        <div className="flex items-center gap-1 mt-1 justify-end text-[10px] text-muted-foreground">
                                                            <Users className="w-3 h-3" />
                                                            {chest.totalExplorers}
                                                        </div>
                                                    </div>

                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                                </div>

                                                {/* Clue count indicator */}
                                                <div className="flex gap-1 mt-3 ml-12">
                                                    {chest.clues.map((clue) => (
                                                        <div
                                                            key={clue.order}
                                                            className={`h-1 flex-1 rounded-full ${
                                                                clue.costULC === 0
                                                                    ? 'bg-green-500/40'
                                                                    : 'bg-yellow-500/30'
                                                            }`}
                                                            title={clue.costULC === 0 ? t('freeClue') : `${clue.costULC} ULC`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* No chests */}
                        {activeChests.length === 0 && !loading && (
                            <div className="text-center py-20 text-muted-foreground">
                                <Scroll className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>{t('noChests')}</p>
                            </div>
                        )}

                        {/* CTA for unconnected */}
                        {!isConnected && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="mt-10 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-8 text-center"
                            >
                                <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                                <h3 className="text-xl font-black mb-2">{t('ctaTitle')}</h3>
                                <p className="text-muted-foreground text-sm mb-5">
                                    {t('ctaSubtitle')}
                                </p>
                                <Button
                                    onClick={connectWallet}
                                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl px-8 py-3"
                                >
                                    {t('ctaButton')}
                                </Button>
                            </motion.div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
