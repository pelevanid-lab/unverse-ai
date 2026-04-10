"use client"

import { Link, usePathname } from '@/i18n/routing';
import { Scroll, Wallet, Trophy, Zap, Menu, X } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getSystemConfig } from '@/lib/ledger';
import { useTranslations } from 'next-intl';
import { getDifficultyState, getDifficultyProfile } from '@/lib/difficulty-engine';

export function Navbar() {
    const t = useTranslations('Game');
    const { user, isConnected, connectWallet } = useWallet();
    const [floorPrice, setFloorPrice] = useState(0.015);
    const [difficulty, setDifficulty] = useState(1.0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        getSystemConfig().then(c => {
            if (c.protocolFloorPrice) setFloorPrice(c.protocolFloorPrice);
        }).catch(() => {});
        getDifficultyState().then(d => setDifficulty(d.currentDifficulty)).catch(() => {});
    }, []);

    const diffProfile = getDifficultyProfile(difficulty);

    return (
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/5 h-14 flex items-center px-4 gap-3">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-black/50 border border-yellow-500/20">
                    <img src="/logo.png" alt="Unverse" className="w-full h-full object-cover scale-[1.6]" style={{ mixBlendMode: 'screen' }} />
                </div>
                <span className="font-headline text-sm font-black tracking-tighter">UNVERSE</span>
            </Link>

            {/* Difficulty badge (center) */}
            <div
                className="flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold mx-auto"
                style={{ borderColor: diffProfile.color + '40', color: diffProfile.color }}
            >
                <Zap className="w-3 h-3" />
                {diffProfile.label}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {isConnected && user ? (
                    <>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <span className="text-[10px] font-black text-yellow-400">
                                {(user.ulcBalance?.available ?? 0).toLocaleString()}
                            </span>
                            <span className="text-[9px] text-yellow-500/60 font-bold">ULC</span>
                        </div>
                        <Link href="/mypage">
                            <div className="w-7 h-7 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-[11px] font-black text-yellow-400">
                                {user?.username?.charAt(0) || 'H'}
                            </div>
                        </Link>
                    </>
                ) : (
                    <Button
                        onClick={connectWallet}
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[11px] px-3 py-1 h-7 rounded-lg"
                    >
                        Connect
                    </Button>
                )}
            </div>
        </header>
    );
}
