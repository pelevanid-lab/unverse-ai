"use client"

import { Link, usePathname } from '@/i18n/routing';
import { Scroll, Package, Users, Trophy, User } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { useTranslations } from 'next-intl';

export function MobileBottomNav() {
    const pathname = usePathname();
    const { isConnected } = useWallet();
    const t = useTranslations('Game');

    const MOBILE_NAV = [
        { nameKey: 'navUnfold',      href: '/',            icon: Scroll  },
        { nameKey: 'navInventory',   href: '/inventory',   icon: Package },
        { nameKey: 'navAlliance',    href: '/alliances',   icon: Users   },
        { nameKey: 'navLeaderboard', href: '/leaderboard', icon: Trophy  },
        { nameKey: 'profileLabel',   href: '/mypage',      icon: User    },
    ];

    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname?.startsWith(href);

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-white/10 safe-area-pb">
            <div className="flex items-stretch h-16">
                {MOBILE_NAV.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all ${
                                active
                                    ? 'text-yellow-400'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <div className={`relative p-1 rounded-xl transition-all ${active ? 'bg-yellow-500/10' : ''}`}>
                                <Icon className="w-5 h-5" />
                                {active && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-400" />
                                )}
                            </div>
                            <span className={`text-[10px] font-bold ${active ? 'text-yellow-400' : ''}`}>
                                {t(item.nameKey as any)}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
