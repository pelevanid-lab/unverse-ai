
"use client"

import Link from 'next/link';
import { Zap, Wallet, LayoutDashboard, Search, Users, Coins, Settings, TrendingUp, Menu, X } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getSystemConfig } from '@/lib/ledger';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const { user, isConnected, connectWallet } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const checkAdmin = async () => {
      if (user && user.walletAddress) {
        const config = await getSystemConfig();
        // Case-insensitive comparison for wallet addresses
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
    { name: 'Discover', href: '/discover' },
    { name: 'AI Muses', href: '/muses' },
    { name: 'Staking', href: '/staking', live: true },
    { name: 'Tokenomics', href: '/tokenomics' },
  ];

  return (
    <nav className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <Zap className={`w-6 h-6 ${isAdmin ? 'text-yellow-400 fill-yellow-400 animate-pulse' : 'text-primary'}`} />
            <span className="font-headline text-xl font-bold tracking-tight">UNVERSE</span>
          </Link>

          <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`hover:text-primary transition-colors flex items-center gap-1.5 ${pathname === link.href ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {link.name}
                {link.live && (
                  <Badge className="scale-75 origin-left bg-green-500/20 text-green-400 border-none px-1.5 py-0 h-4">LIVE</Badge>
                )}
              </Link>
            ))}
            {isAdmin && <Link href="/admin" className={`text-yellow-400 hover:text-yellow-300 transition-colors font-bold ${pathname === '/admin' ? 'underline' : ''}`}>Admin</Link>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center bg-muted/50 rounded-full px-3 py-1.5 border border-white/5 gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold">{user?.ulcBalance.available.toFixed(2) || '0.00'} ULC</span>
          </div>
          
          {isConnected ? (
            <Link href="/mypage">
              <Button variant="outline" size="sm" className="gap-2 hidden sm:flex border-white/10 hover:bg-white/5 rounded-full px-4">
                <Wallet className="w-4 h-4" />
                {user?.walletAddress.slice(0, 6)}...
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <LayoutDashboard className="w-5 h-5" />
              </Button>
            </Link>
          ) : (
            <Button onClick={connectWallet} className="bg-primary hover:bg-primary/90 px-6 rounded-full font-bold shadow-lg shadow-primary/20">
              Connect Wallet
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
                {link.name}
                {link.live && <Badge className="bg-green-500/20 text-green-400 border-none">LIVE</Badge>}
              </Link>
            ))}
            {isAdmin && <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="text-yellow-400">Admin</Link>}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm font-body font-normal text-muted-foreground">Balance</span>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                <span>{user?.ulcBalance.available.toFixed(2) || '0.00'} ULC</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
