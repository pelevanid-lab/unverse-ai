"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lock, Unlock, Scroll, Zap, Users, ChevronLeft,
    Eye, EyeOff, Send, Trophy, Flame, Star, CheckCircle2, XCircle, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';
import { getChest, getOrCreateSession, submitAnswer, unlockClueClient } from '@/lib/game-engine';
import { getPlayerAlliance } from '@/lib/alliance-engine';
import { getDifficultyState, getDifficultyProfile } from '@/lib/difficulty-engine';
import { TreasureChest, GameSession, Clue } from '@/lib/types';

const RARITY_CONFIG: Record<string, { color: string; glow: string; bg: string; label: string }> = {
    genesis:   { color: 'text-red-400',    glow: 'shadow-red-500/40',    bg: 'bg-red-500/10',    label: 'GENESIS' },
    legendary: { color: 'text-yellow-400', glow: 'shadow-yellow-500/30', bg: 'bg-yellow-500/10', label: 'LEGENDARY' },
    rare:      { color: 'text-purple-400', glow: 'shadow-purple-500/30', bg: 'bg-purple-500/10', label: 'RARE' },
    uncommon:  { color: 'text-blue-400',   glow: 'shadow-blue-500/20',   bg: 'bg-blue-500/10',   label: 'UNCOMMON' },
    common:    { color: 'text-gray-400',   glow: 'shadow-gray-500/20',   bg: 'bg-gray-500/10',   label: 'COMMON' },
};

export default function ChestPage() {
    const t = useTranslations('Game');
    const params = useParams();
    const router = useRouter();
    const chestId = params.chestId as string;
    const universeId = params.universeId as string;

    const { user, isConnected, connectWallet } = useWallet();

    const [chest, setChest] = useState<TreasureChest | null>(null);
    const [session, setSession] = useState<GameSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [answer, setAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [subStep, setSubStep] = useState<'idle' | 'analyzing' | 'decrypting' | 'authenticated'>('idle');
    const [result, setResult] = useState<{ correct: boolean; isFirstHunter?: boolean; rewardULC?: number; nftName?: string; penaltyApplied?: boolean; error?: string } | null>(null);
    const [unlockedClues, setUnlockedClues] = useState<Map<number, string>>(new Map());
    const [unlockingClue, setUnlockingClue] = useState<number | null>(null);
    const [difficultyLabel, setDifficultyLabel] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [c, diff] = await Promise.all([
                    getChest(chestId),
                    getDifficultyState(),
                ]);
                setChest(c);
                const prof = getDifficultyProfile(diff.currentDifficulty);
                setDifficultyLabel(prof.label);

                // First clue is always free — reveal it immediately
                if (c && c.clues.length > 0) {
                    const freeClue = c.clues.find(cl => cl.costULC === 0);
                    if (freeClue) {
                        setUnlockedClues(prev => new Map(prev).set(freeClue.order, freeClue.text));
                    }
                }
            } catch (e) {
                console.error('Failed to load chest:', e);
            }
            setLoading(false);
        };
        load();
    }, [chestId]);

    useEffect(() => {
        if (!isConnected || !user || !chest) return;
        
        const initSession = async () => {
            try {
                // Determine if hunter is in an alliance
                const alliance = await getPlayerAlliance(user.walletAddress || user.uid || '');
                const allianceId = alliance?.id;
                
                const s = await getOrCreateSession(
                    user.walletAddress || user.uid || '', 
                    chestId, 
                    universeId, 
                    allianceId
                );
                
                setSession(s);
                
                // Restore previously unlocked clues from session
                if (s.cluesUnlocked?.length && chest) {
                    const newMap = new Map();
                    for (const order of s.cluesUnlocked) {
                        const clue = chest.clues.find(c => c.order === order);
                        if (clue) newMap.set(order, clue.text);
                    }
                    setUnlockedClues(newMap);
                }
            } catch (err) {
                console.error('Session initialization error:', err);
            }
        };

        initSession();
    }, [isConnected, user, chest]);

    const handleUnlockClue = async (clue: Clue) => {
        if (!session) return;
        setUnlockingClue(clue.order);
        try {
            const res = await unlockClueClient(session.id, clue.order);
            if (res.success && res.clueText) {
                setUnlockedClues(prev => new Map(prev).set(clue.order, res.clueText!));
            }
        } catch (e) {
            console.error('Unlock error:', e);
        }
        setUnlockingClue(null);
    };

    const handleSubmit = async () => {
        if (!session || !answer.trim()) return;
        
        setSubmitting(true);
        setResult(null);
        
        // ── PHASE 1: ANALYZING ──
        setSubStep('analyzing');
        await new Promise(r => setTimeout(r, 1200));
        
        try {
            const res = await submitAnswer(session.id, chestId, answer);
            
            if (res.correct) {
                // ── PHASE 2: DECRYPTING ──
                setSubStep('decrypting');
                await new Promise(r => setTimeout(r, 1000));
                
                // ── PHASE 3: AUTHENTICATED ──
                setSubStep('authenticated');
                await new Promise(r => setTimeout(r, 800));
                
                setResult(res);
                // Refresh chest status
                const updated = await getChest(chestId);
                setChest(updated);
            } else {
                setResult(res);
            }
        } catch (e) {
            console.error('Submit error:', e);
            setResult({ correct: false, error: 'Network disruption. Link failed.' });
        }
        
        setSubmitting(false);
        setSubStep('idle');
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
        </div>
    );

    if (!chest) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Scroll className="w-12 h-12 opacity-20" />
            <p className="text-muted-foreground">Chest not found.</p>
            <Link href="/"><Button variant="ghost">← Back to Hub</Button></Link>
        </div>
    );

    const rarity = RARITY_CONFIG[chest.rarity] || RARITY_CONFIG.common;
    const isOpen = chest.status === 'permanently_open' || chest.status === 'first_unlocked';
    const isSealedOrHunted = chest.status === 'sealed' || chest.status === 'hunted';
    const alreadySolved = result?.correct || session?.status === 'solved';

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* ── TOP BACK BAR ── */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
                <Link href={`/`}>
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:block">Hub</span>
                    </Button>
                </Link>
                <div className="flex-1 flex items-center gap-2">
                    <span className={`text-[10px] font-black tracking-widest ${rarity.color}`}>{rarity.label}</span>
                    <span className="text-sm font-bold truncate">{chest.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {chest.totalExplorers}
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

                {/* ── CHEST HERO ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-3xl border p-8 text-center ${rarity.bg} border-white/10 shadow-2xl ${rarity.glow}`}
                >
                    {/* Icon */}
                    <motion.div
                        animate={isSealedOrHunted ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center"
                    >
                        {isOpen
                            ? <Unlock className="w-10 h-10 text-green-400" />
                            : <Lock className={`w-10 h-10 ${rarity.color}`} />
                        }
                    </motion.div>

                    <h1 className={`text-2xl font-black mb-2 ${rarity.color}`}>{chest.name}</h1>
                    <p className="text-muted-foreground text-sm mb-5">{chest.description}</p>

                    {chest.lore && (
                        <div className="text-xs text-muted-foreground/70 italic border border-white/5 rounded-xl p-4 bg-black/20 text-left leading-relaxed">
                            {chest.lore}
                        </div>
                    )}

                    {/* Reward display */}
                    {isSealedOrHunted && (
                        <div className="mt-5 flex items-center justify-center gap-6">
                            <div>
                                <div className={`text-3xl font-black ${rarity.color}`}>
                                    {chest.baseRewardULC.toLocaleString()}
                                </div>
                                <div className="text-[10px] font-bold text-muted-foreground tracking-wider">ULC REWARD</div>
                            </div>
                            {chest.nftRewardId && (
                                <div className="text-center">
                                    <div className="text-lg font-black text-purple-400">+ NFT</div>
                                    <div className="text-[10px] font-bold text-muted-foreground tracking-wider">EXCLUSIVE</div>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* ── CRACKING OVERLAY ── */}
                <AnimatePresence>
                    {subStep !== 'idle' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center"
                        >
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.1, 1],
                                    rotate: [0, 5, -5, 0]
                                }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="relative mb-12"
                            >
                                <div className={`w-32 h-32 rounded-3xl border-2 flex items-center justify-center bg-black/40 ${
                                    subStep === 'analyzing' ? 'border-blue-500/40' :
                                    subStep === 'decrypting' ? 'border-yellow-500/40' :
                                    'border-green-500/40'
                                } shadow-[0_0_50px_rgba(0,0,0,0.5)]`}>
                                    {subStep === 'analyzing' && <Star className="w-16 h-16 text-blue-400 animate-pulse" />}
                                    {subStep === 'decrypting' && <Zap className="w-16 h-16 text-yellow-400 animate-bounce" />}
                                    {subStep === 'authenticated' && <ShieldCheck className="w-16 h-16 text-green-400" />}
                                </div>
                                <div className="absolute -inset-4 rounded-[40px] border border-white/5 animate-spin-slow opacity-20" />
                            </motion.div>

                            <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 font-headline">
                                {subStep === 'analyzing' && t('crackingAnalyz')}
                                {subStep === 'decrypting' && t('crackingDecrypt')}
                                {subStep === 'authenticated' && t('crackingAccess')}
                            </h2>
                            
                            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                                <span className={subStep === 'analyzing' ? 'text-blue-400 transition-colors' : 'text-green-500'}>
                                    {subStep === 'analyzing' ? '●' : '✓'} {t('crackingSignal')}
                                </span>
                                <span className="opacity-20">—</span>
                                <span className={subStep === 'decrypting' ? 'text-yellow-400 transition-colors' : subStep === 'authenticated' ? 'text-green-500' : 'opacity-40'}>
                                    {subStep === 'decrypting' ? '●' : subStep === 'authenticated' ? '✓' : '○'} {t('crackingAlgebra')}
                                </span>
                                <span className="opacity-20">—</span>
                                <span className={subStep === 'authenticated' ? 'text-green-500' : 'opacity-40'}>
                                    {subStep === 'authenticated' ? '●' : '○'} {t('crackingSoul')}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── SOLVED BANNER ── */}
                <AnimatePresence>
                    {alreadySolved && result && result.correct && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-3xl border bg-gradient-to-b from-green-500/10 to-transparent border-green-500/30 p-1 bg-black/20"
                        >
                            <div className="p-8 text-center bg-black/40 rounded-[22px] border border-white/5">
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-6" />
                                    <h2 className="text-4xl font-black font-headline uppercase tracking-tighter text-white mb-2">
                                        {result.isFirstHunter ? t('firstHunterTitle') : t('archiveSolvedTitle')}
                                    </h2>
                                    <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8">
                                        {t('sealBrokenDesc')}
                                    </p>
                                </motion.div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <div className="text-2xl font-black text-green-400">+{result.rewardULC?.toLocaleString()}</div>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{t('ulcBounty')}</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                                        <div className="text-lg font-black text-purple-400 truncate">
                                            {result.nftName || 'Genesis Seal #112'}
                                        </div>
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{t('artifactSecured')}</div>
                                    </div>
                                </div>

                                <Link href="/inventory">
                                    <Button className="w-full bg-white text-black hover:bg-white/90 font-black rounded-xl h-14 uppercase tracking-wider text-sm">
                                        {t('viewAssetVault')}
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── WRONG / PENALTY BANNER ── */}
                <AnimatePresence>
                    {result && !result.correct && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className={`rounded-2xl border p-5 flex items-start gap-4 ${
                                result.error ? 'bg-orange-500/10 border-orange-500/30' : 'bg-red-500/10 border-red-500/30'
                            }`}
                        >
                            <div className={`p-2 rounded-xl flex-shrink-0 ${
                                result.error ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                                {result.error ? <Zap className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            </div>
                            <div>
                                <h4 className={`text-sm font-black uppercase tracking-tight mb-1 ${
                                    result.error ? 'text-orange-400' : 'text-red-400'
                                }`}>
                                    {result.error ? t('securityAccessDenied') : t('securityIncorrect')}
                                </h4>
                                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                                    {result.error === 'Network disruption. Link failed.' 
                                        ? t('securityNetworkErr') 
                                        : (result.error || (result.penaltyApplied 
                                            ? t('securityBruteWarn') 
                                            : t('incorrectAnswerDesc')))}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── CLUE CHAIN ── */}
                <div>
                    <h2 className="text-xs font-black tracking-widest text-muted-foreground/60 uppercase mb-4">
                        {t('clueChain')}
                    </h2>
                    <div className="space-y-3">
                        {chest.clues.map((clue, i) => {
                            const revealed = unlockedClues.has(clue.order);
                            const isLoading = unlockingClue === clue.order;

                            return (
                                <motion.div
                                    key={clue.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="rounded-xl border border-white/10 bg-card/50 overflow-hidden"
                                >
                                    {/* Clue header */}
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                                            revealed ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-muted-foreground'
                                        }`}>
                                            {clue.order}
                                        </div>
                                        <span className="text-xs font-bold text-muted-foreground flex-1">
                                            {clue.costULC === 0 ? (
                                                <span className="text-green-500/80">Free Clue</span>
                                            ) : (
                                                <span className="text-yellow-500/80">{clue.costULC} ULC</span>
                                            )}
                                        </span>
                                        {revealed && <CheckCircle2 className="w-4 h-4 text-green-500/60" />}
                                    </div>

                                    {/* Clue body */}
                                    <div className="px-4 py-4">
                                        {revealed ? (
                                            <p className="text-sm text-foreground leading-relaxed">{unlockedClues.get(clue.order)}</p>
                                        ) : (
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-sm text-muted-foreground/50 italic">
                                                    This clue costs {clue.costULC} ULC to unlock.
                                                </p>
                                                {isConnected ? (
                                                    <Button
                                                        size="sm"
                                                        disabled={isLoading}
                                                        onClick={() => handleUnlockClue(clue)}
                                                        className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 font-bold text-xs flex-shrink-0"
                                                    >
                                                        {isLoading ? (
                                                            <div className="w-4 h-4 border border-yellow-400/50 border-t-yellow-400 rounded-full animate-spin" />
                                                        ) : (
                                                            `Unlock (${clue.costULC} ULC)`
                                                        )}
                                                    </Button>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* ── ANSWER FORM ── */}
                {!alreadySolved && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="rounded-2xl border border-white/10 bg-card/50 p-5"
                    >
                        <h2 className="text-xs font-black tracking-widest text-muted-foreground/60 uppercase mb-4">
                            Your Answer
                        </h2>

                        {!isConnected ? (
                            <div className="text-center py-4">
                                <p className="text-sm text-muted-foreground mb-4">Connect your wallet to submit an answer.</p>
                                <Button onClick={connectWallet} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl">
                                    Connect & Hunt
                                </Button>
                            </div>
                        ) : isOpen ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                <Unlock className="w-8 h-8 text-green-400 mx-auto mb-2" />
                                This chest has already been opened. You can explore it for a smaller bonus reward.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={answer}
                                    onChange={e => setAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    placeholder="Type your answer..."
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-yellow-500/40 transition-colors"
                                />
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting || !answer.trim()}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl py-3 gap-2"
                                >
                                    {submitting ? (
                                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Submit Answer
                                        </>
                                    )}
                                </Button>
                                <p className="text-[10px] text-muted-foreground/40 text-center">
                                    Answers are case-insensitive. Max 10 attempts per hour.
                                </p>
                            </div>
                        )}
                    </motion.div>
                )}

            </div>
        </div>
    );
}
