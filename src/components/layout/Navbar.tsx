
"use client"

import { Link } from '@/i18n/routing';
import { Zap, Wallet, LayoutDashboard, Search, Users, Coins, Settings, TrendingUp, Menu, X, User as UserIcon } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getSystemConfig } from '@/lib/ledger';
import { Badge } from '@/components/ui/badge';
import { usePathname } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';

export function Navbar() {
  const t = useTranslations('Navbar');
  const locale = useLocale();
  const { user, isConnected, connectWallet, isAdmin } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const [floorPrice, setFloorPrice] = useState(0.015);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getSystemConfig();
        if (config.protocolFloorPrice) {
          setFloorPrice(config.protocolFloorPrice);
        }
      } catch (err) {
        console.error("Failed to fetch floor price:", err);
      }
    };
    fetchConfig();

    fetchConfig();
  }, []);

  const navLinks = [
    { name: t('discover'), href: '/' },
    { name: t('staking'), href: '/staking' },
    { name: t('community'), href: '/community' },
    { name: t('tokenomics'), href: '/tokenomics' },
  ];

  return (
    <>
      <nav className="lg:hidden border-b bg-background/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-black/50 border border-white/5 shadow-lg shadow-primary/20">
                <img 
                  src="/logo.png" 
                  alt="Unverse Logo" 
                  className={`w-full h-full object-cover scale-[1.6] ${isAdmin ? 'animate-pulse' : ''}`} 
                  style={{ mixBlendMode: 'screen' }}
                />
              </div>
              <span className="font-headline text-lg font-bold tracking-tight">UNVERSE</span>
            </Link>
            <div className="flex items-center ml-1">
                <span className="text-[9px] font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded-full border border-primary/20 whitespace-nowrap">
                    1 ULC = {floorPrice} USDC
                </span>
            </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/search">
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Search className="w-5 h-5 text-muted-foreground" />
            </Button>
          </Link>
          
          {isConnected ? (
            <Link href="/wallet">
              <div className="flex items-center bg-muted/50 rounded-full px-3 py-1 border border-white/5 gap-2 h-8">
                <Coins className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold">{user?.ulcBalance?.available?.toFixed(0) ?? '0'}</span>
              </div>
            </Link>
          ) : (
            <Button onClick={connectWallet} size="sm" className="h-8 bg-primary hover:bg-primary/90 rounded-full text-[10px] font-bold">
              {t('connect')}
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="w-9 h-9"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </nav>

    {/* Mobile Menu Overlay */}
    {mobileMenuOpen && (
      <>
        <div 
          className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div className="fixed top-0 inset-x-0 z-[9999] bg-background/95 backdrop-blur-xl border-b border-white/10 flex flex-col p-6 animate-in slide-in-from-top-4 duration-300 lg:hidden text-foreground shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-black/50 border border-white/5 shadow-lg shadow-primary/20">
                <img src="/logo.png" alt="Unverse" className="w-full h-full object-cover scale-[1.6]" style={{ mixBlendMode: 'screen' }} />
              </div>
              <span className="font-headline text-lg font-bold tracking-tight uppercase italic">UNVERSE</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Links */}
          <nav className="flex flex-col gap-6 flex-1">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={() => setMobileMenuOpen(false)}
                className={`text-2xl font-black font-headline tracking-tighter uppercase italic flex items-center gap-3 transition-colors ${
                  link.href === '/tokenomics' ? 'text-yellow-400' : 'hover:text-primary'
                }`}
              >
                {link.name}
                {link.href === '/staking' && (
                  <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20 font-sans not-italic">
                    EARN 🔥
                  </span>
                )}
              </Link>
            ))}

            {isAdmin && (
              <Link 
                href="/admin" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-2xl font-black font-headline tracking-tighter uppercase italic flex items-center gap-3 text-red-500 hover:text-red-400 transition-colors"
              >
                <LayoutDashboard className="w-6 h-6" />
                Admin
              </Link>
            )}

            {isConnected && (
              <Link 
                href="/mypage" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-2xl font-black font-headline tracking-tighter uppercase italic flex items-center gap-3 hover:text-primary transition-colors"
              >
                <UserIcon className="w-6 h-6" />
                {t('mypage')}
              </Link>
            )}
          </nav>

          {/* Footer / Balance */}
          <div className="mt-auto border-t border-white/5 pt-6 pb-4">
            <div className="flex items-center justify-between text-muted-foreground mb-4">
              <span className="text-sm font-bold tracking-wider">BALANCE</span>
              <div className="flex items-center gap-2 text-foreground">
                <Coins className="w-5 h-5 text-primary" />
                <span className="text-xl font-black font-headline tracking-tighter italic">
                  {user?.ulcBalance?.available?.toLocaleString() ?? '0'} ULC
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
  </>
);
}
