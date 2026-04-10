"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Search, Filter, Box, Star, Info, ChevronRight, Grid, List as ListIcon, Trophy } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { NFTAsset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

const RARITY_COLORS: Record<string, string> = {
    genesis:   'text-red-400 border-red-500/30 bg-red-500/5',
    legendary: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
    rare:      'text-purple-400 border-purple-500/30 bg-purple-500/5',
    uncommon:  'text-blue-400 border-blue-500/30 bg-blue-500/5',
    common:    'text-gray-400 border-white/10 bg-white/5',
};

export default function InventoryPage() {
    const t = useTranslations('Game');
    const { user, isConnected, connectWallet } = useWallet();
    const [assets, setAssets] = useState<NFTAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        if (!isConnected || !user) {
            setLoading(false);
            return;
        }

        const fetchAssets = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'nft_assets'),
                    where('ownerAddress', '==', user.walletAddress || user.uid),
                    orderBy('mintedAt', 'desc')
                );
                const snap = await getDocs(q);
                setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as NFTAsset)));
            } catch (e) {
                console.error('Failed to fetch inventory:', e);
            }
            setLoading(false);
        };

        fetchAssets();
    }, [isConnected, user]);

    if (!isConnected) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <Box className="w-16 h-16 text-yellow-500/20 mb-6" />
                <h1 className="text-2xl font-black mb-2">{t('navInventory')}</h1>
                <p className="text-muted-foreground text-center max-w-xs mb-8">
                    {t('invVaultDesc')}
                </p>
                <Button onClick={connectWallet} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-8 py-6 rounded-2xl shadow-xl shadow-yellow-500/20">
                    {t('invAccessVault')}
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* ── HEADER ── */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-6 lg:py-8">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Box className="w-8 h-8 text-yellow-500" />
                            <h1 className="text-3xl font-black tracking-tighter uppercase">{t('navInventory')}</h1>
                        </div>
                        <p className="text-muted-foreground text-sm font-bold tracking-widest uppercase opacity-60">
                            {t('invItemsFound', { count: assets.length })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-yellow-400' : 'text-muted-foreground hover:text-white'}`}
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-yellow-400' : 'text-muted-foreground hover:text-white'}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl border-white/5 bg-white/5 font-bold gap-2">
                            <Filter className="w-4 h-4" /> {t('filterLabel')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── CONTENT ── */}
            <div className="max-w-6xl mx-auto px-6 py-10">
                {loading ? (
                    <div className="flex items-center justify-center py-40">
                        <div className="w-8 h-8 border-2 border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" />
                    </div>
                ) : assets.length === 0 ? (
                    <div className="text-center py-32 space-y-6">
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                            <Package className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <div className="max-w-xs mx-auto">
                            <h3 className="text-xl font-bold mb-2">{t('invEmptyTitle')}</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {t('invEmptyDesc')}
                            </p>
                        </div>
                        <Link href="/">
                            <Button className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-8 rounded-xl mt-4 focus:ring-4 ring-yellow-500/20">
                                {t('ctaTitle')}
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <motion.div
                        layout
                        className={viewMode === 'grid'
                            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            : "space-y-3"
                        }
                    >
                        {assets.map((asset, i) => (
                            <motion.div
                                key={asset.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${
                                    viewMode === 'grid'
                                        ? 'bg-card/40 hover:bg-card hover:border-white/20 hover:shadow-2xl hover:shadow-yellow-500/5'
                                        : 'bg-card/20 flex items-center gap-4 px-5 py-4 hover:bg-card/40 border-white/5'
                                }`}
                            >
                                {/* Media / Icon Placeholder */}
                                <div className={viewMode === 'grid'
                                    ? "aspect-square bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center relative border-b border-white/5"
                                    : "w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0"
                                }>
                                    {asset.imageUrl ? (
                                        <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Box className="w-1/3 h-1/3 text-muted-foreground/40 group-hover:scale-110 transition-transform duration-500" />
                                    )}

                                    {/* Rarity badge (grid only) */}
                                    {viewMode === 'grid' && (
                                        <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[9px] font-black border backdrop-blur-md uppercase tracking-widest ${RARITY_COLORS[asset.rarity] || RARITY_COLORS.common}`}>
                                            {t(`rarity${asset.rarity.charAt(0).toUpperCase() + asset.rarity.slice(1)}` as any)}
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className={viewMode === 'grid' ? "p-5" : "flex-1 min-w-0"}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            {viewMode === 'list' && (
                                                <div className={`text-[8px] font-black tracking-[0.2em] uppercase mb-1 ${RARITY_COLORS[asset.rarity]?.split(' ')[0]}`}>
                                                    {t(`rarity${asset.rarity.charAt(0).toUpperCase() + asset.rarity.slice(1)}` as any)}
                                                </div>
                                            )}
                                            <h3 className="font-bold text-foreground truncate group-hover:text-yellow-400 transition-colors uppercase tracking-tight">
                                                {asset.name}
                                            </h3>
                                            <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase opacity-60">
                                                ID: #{asset.id.slice(-6).toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <Trophy className="w-4 h-4 text-yellow-500/20 group-hover:text-yellow-500 transition-colors" />
                                        </div>
                                    </div>

                                    {viewMode === 'grid' && (
                                        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                                            <div className="text-[10px] text-muted-foreground font-bold uppercase">{t('foundIn')}</div>
                                            <div className="text-[10px] font-black text-foreground uppercase tracking-widest">{asset.universeId}</div>
                                        </div>
                                    )}
                                </div>

                                {viewMode === 'list' && (
                                    <div className="flex-shrink-0 flex items-center gap-6 pr-4">
                                        <div className="hidden sm:block text-right">
                                            <div className="text-[10px] text-muted-foreground font-bold uppercase">{t('universeLabel')}</div>
                                            <div className="text-[11px] font-black text-foreground uppercase tracking-widest">{asset.universeId}</div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
