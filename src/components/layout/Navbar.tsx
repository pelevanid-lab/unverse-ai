
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
  const { user, isConnected, connectWallet } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkAdmin = async () => {
      if (user && user.walletAddress) {
        const config = await getSystemConfig();
        if (config && config.admin_wallet_address && user.walletAddress &&
            config.admin_wallet_address.toLowerCase() === user.walletAddress.toLowerCase()) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [user]);

  const navLinks = [
    { name: t('discover'), href: '/' },
    { name: t('staking'), href: '/staking' },
    { name: t('community'), href: '/community' },
    { name: t('tokenomics'), href: '/tokenomics' },
  ];

  return (
    <nav className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-black/50 border border-white/5 shadow-lg shadow-primary/20">
                <img 
                  src="/logo.png" 
                  alt="Unverse Logo" 
                  className={`w-full h-full object-cover scale-[1.6] ${isAdmin ? 'animate-pulse' : ''}`} 
                  style={{ mixBlendMode: 'screen' }}
                />
              </div>
            </Link>
            <div className="flex flex-col">
              <Link href="/" className="group leading-none">
                <span className="font-headline text-xl font-bold tracking-tight">UNVERSE</span>
              </Link>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 font-bold font-headline mt-0.5">
                <Link href={pathname || '/'} locale="en" className={`hover:text-primary transition-colors ${locale === 'en' ? 'text-primary opacity-100' : 'opacity-70'}`}>EN</Link>
                <span className="opacity-50">/</span>
                <Link href={pathname || '/'} locale="tr" className={`hover:text-primary transition-colors ${locale === 'tr' ? 'text-primary opacity-100' : 'opacity-70'}`}>TR</Link>
                <span className="opacity-50">/</span>
                <Link href={pathname || '/'} locale="ru" className={`hover:text-primary transition-colors ${locale === 'ru' ? 'text-primary opacity-100' : 'opacity-70'}`}>RU</Link>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`flex items-center gap-1.5 ${pathname === link.href ? 'text-primary' : 'text-muted-foreground hover:text-primary transition-colors'}`}
              >
                {link.name}
              </Link>
            ))}
            {isAdmin && <Link href="/admin" className={`text-yellow-400 hover:text-yellow-300 transition-colors font-bold ${pathname === '/admin' ? 'underline' : ''}`}>Admin</Link>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isConnected && (
            <Link 
              href="/mypage" 
              className={`flex items-center gap-1.5 text-sm font-medium ${pathname === '/mypage' ? 'text-primary' : 'text-muted-foreground hover:text-primary transition-colors'}`}
            >
              <UserIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline-block">{t('mypage')}</span>
            </Link>
          )}

          <div className="hidden sm:flex items-center bg-muted/50 rounded-full px-3 py-1.5 border border-white/5 gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold">{user?.ulcBalance?.available?.toFixed(2) ?? '0.00'} ULC</span>
          </div>
          
          {isConnected ? (
            <Link href="/mypage">
              <Button variant="outline" size="sm" className="gap-2 hidden sm:flex border-white/10 hover:bg-white/5 rounded-full px-4">
                <Wallet className="w-4 h-4" />
                {user?.walletAddress.slice(0, 6)}...
              </Button>
            </Link>
          ) : (
            <Button onClick={connectWallet} className="bg-primary hover:bg-primary/90 px-6 rounded-full font-bold shadow-lg shadow-primary/20">
              {t('connect')}
            </Button>
          )}

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-card/95 backdrop-blur-2xl border-b border-white/10 absolute w-full animate-in slide-in-from-top-4 duration-300">
          <div className="p-6 flex flex-col gap-6 font-headline font-bold text-lg">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  {link.name}
                </span>
              </Link>
            ))}
            
            {/* My Page Link for connected users */}
            {isConnected && (
              <Link 
                href="/mypage"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><UserIcon className='w-5 h-5'/> {t('mypage')}</span>
              </Link>
            )}

            {isAdmin && <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="text-yellow-400">Admin</Link>}
            
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm font-body font-normal text-muted-foreground">Balance</span>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                <span>{user?.ulcBalance?.available?.toFixed(2) ?? '0.00'} ULC</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
