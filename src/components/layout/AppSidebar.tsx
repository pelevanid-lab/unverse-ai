"use client"

import { Link, usePathname } from '@/i18n/routing';
import {
    Scroll, Package, Users, Trophy, Coins, Flame,
    LayoutDashboard, Wallet, User, LogOut, Settings, Menu, Sparkles
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLocale, useTranslations } from 'next-intl';
import { getSystemConfig } from '@/lib/ledger';
import { useState, useEffect } from 'react';

const GAME_NAV = [
    { nameKey: 'navUnfold',      subKey: 'navUnfoldSub',      href: '/',            icon: Scroll,        accent: false },
    { nameKey: 'navInventory',   subKey: 'navInventorySub',   href: '/inventory',   icon: Package,       accent: false },
    { nameKey: 'navAlliance',    subKey: 'navAllianceSub',    href: '/alliances',   icon: Users,         accent: false },
    { nameKey: 'navLeaderboard', subKey: 'navLeaderboardSub', href: '/leaderboard', icon: Trophy,        accent: false },
];

const ECONOMY_NAV = [
    { nameKey: 'navWallet',   subKey: 'navWalletSub',   href: '/wallet',      icon: Wallet   },
    { nameKey: 'navStaking',  subKey: 'navStakingSub',  href: '/staking',     icon: Flame    },
    { nameKey: 'navPresale',  subKey: 'navPresaleSub',  href: '/tokenomics',  icon: Coins    },
    { nameKey: 'navUniq',     subKey: 'navUniqSub',     href: '/uniq',        icon: Sparkles },
];

export function AppSidebar() {
    const t = useTranslations('Game');
    const pathname = usePathname();
    const { user, isConnected, connectWallet, disconnectWallet, isAdmin } = useWallet();
    const locale = useLocale();
    const [floorPrice, setFloorPrice] = useState(0.015);

    useEffect(() => {
        getSystemConfig().then(c => {
            if (c.protocolFloorPrice) setFloorPrice(c.protocolFloorPrice);
        }).catch(() => {});
    }, []);

    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname?.startsWith(href);

    return (
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 border-r border-white/5 bg-background z-50 px-3 py-8">
            {/* ── LOGO ── */}
            <div className="px-3 mb-8">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-black/50 border border-yellow-500/20 shadow-lg shadow-yellow-500/10">
                        <img
                            src="/logo.png"
                            alt="Unverse Logo"
                            className="w-full h-full object-cover scale-[1.6]"
                            style={{ mixBlendMode: 'screen' }}
                        />
                    </div>
                    <div>
                        <span className="font-headline text-lg font-black tracking-tighter block">UNVERSE</span>
                        <span className="text-[9px] text-yellow-500/70 font-bold tracking-widest">THE INFINITE HUNT</span>
                    </div>
                </Link>
            </div>

            {/* ── ULC PRICE ── */}
            <div className="mx-3 mb-6 px-3 py-2 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-bold tracking-wider">1 ULC</span>
                    <span className="text-[10px] text-yellow-400 font-black">${floorPrice.toFixed(4)}</span>
                </div>
            </div>

            {/* ── GAME NAV ── */}
            <nav className="flex-1 space-y-1">
                <div className="px-3 mb-2">
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/50 uppercase">{t('sectionGame')}</span>
                </div>
                {GAME_NAV.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                                active
                                    ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                                    : 'hover:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent'
                            }`}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-yellow-400' : 'group-hover:scale-110 transition-transform'}`} />
                            <div>
                                <div className="text-sm font-bold">{t(item.nameKey as any)}</div>
                                <div className="text-[10px] text-muted-foreground/60">{t(item.subKey as any)}</div>
                            </div>
                        </Link>
                    );
                })}

                {/* ── ECONOMY NAV ── */}
                <div className="px-3 mt-5 mb-2">
                    <span className="text-[10px] font-black tracking-widest text-muted-foreground/50 uppercase">{t('sectionEconomy')}</span>
                </div>
                {ECONOMY_NAV.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                                active
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : item.href === '/tokenomics'
                                        ? 'hover:bg-white/5 text-yellow-500/70 hover:text-yellow-400 border border-transparent'
                                        : 'hover:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent'
                            }`}
                        >
                            <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : 'group-hover:scale-110 transition-transform'}`} />
                            <div>
                                <div className="text-sm font-bold">{t(item.nameKey as any)}</div>
                                <div className="text-[10px] text-muted-foreground/60">{t(item.subKey as any)}</div>
                            </div>
                        </Link>
                    );
                })}

                {/* Admin */}
                {isAdmin && (
                    <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent transition-all"
                    >
                        <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <div className="text-sm font-bold">{t('navAdmin')}</div>
                            <div className="text-[10px] text-muted-foreground/60">{t('navManagement')}</div>
                        </div>
                    </Link>
                )}
            </nav>

            {/* ── BOTTOM: USER ── */}
            <div className="mt-auto space-y-2">
                {isConnected && user ? (
                    <>
                        {/* Balance pill */}
                        <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground font-bold">ULC</span>
                            <span className="text-[13px] font-black text-yellow-400">
                                {(user.ulcBalance?.available ?? 0).toLocaleString()}
                            </span>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-5 rounded-xl hover:bg-white/5">
                                    <Avatar className="w-7 h-7 border border-yellow-500/20">
                                        <AvatarImage src={user?.avatar || ''} />
                                        <AvatarFallback className="bg-yellow-500/20 text-[10px] text-yellow-400">
                                            {user?.username?.charAt(0) || 'H'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate max-w-[110px] text-sm font-bold">{user?.username || 'Hunter'}</span>
                                    <Menu className="w-4 h-4 ml-auto text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-card border-white/10 rounded-xl">
                                <DropdownMenuItem className="py-3 cursor-pointer gap-3" asChild>
                                    <Link href="/mypage"><User className="w-4 h-4" /> {t('navProfile')}</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="py-3 cursor-pointer gap-3" asChild>
                                    <Link href="/wallet"><Wallet className="w-4 h-4" /> {t('navWalletMenu')}</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/5" />
                                <DropdownMenuItem
                                    className="py-3 cursor-pointer gap-3 text-red-400 focus:text-red-400"
                                    onClick={disconnectWallet}
                                >
                                    <LogOut className="w-4 h-4" /> {t('navLogout')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                ) : (
                    <Button
                        onClick={connectWallet}
                        className="w-full justify-start gap-3 px-3 py-5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black"
                    >
                        <Wallet className="w-5 h-5" />
                        <span>{t('connectButton')}</span>
                    </Button>
                )}

                {/* ── SYSTEM STATUS ── */}
                <div className="pt-4 border-t border-white/5">
                    <div className="px-3 py-2 flex items-center justify-between rounded-lg bg-black/20 border border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{t('statusLink')}</span>
                        </div>
                        <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">{t('statusOnline')}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
