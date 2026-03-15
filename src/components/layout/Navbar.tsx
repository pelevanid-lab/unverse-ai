"use client"

import Link from 'next/link';
import { Zap, Wallet, LayoutDashboard, Search, Users, Coins, Settings, TrendingUp } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { getSystemConfig } from '@/lib/ledger';

export function Navbar() {
  const { user, isConnected, connectWallet } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const config = await getSystemConfig();
        if (config && config.admin_wallet_address === user.walletAddress) {
          setIsAdmin(true);
        }
      }
    };
    checkAdmin();
  }, [user]);

  return (
    <nav className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <Zap className={`w-6 h-6 ${isAdmin ? 'text-yellow-400 fill-yellow-400 animate-pulse' : 'text-primary'}`} />
            <span className="font-headline text-xl font-bold tracking-tight">UNVERSE</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-primary transition-colors">Discover</Link>
            <Link href="/muses" className="hover:text-primary transition-colors">AI Muses</Link>
            <Link href="/staking" className="hover:text-primary transition-colors flex items-center gap-1.5">
              Staking <Badge variant="secondary" className="scale-75 origin-left bg-green-500/20 text-green-400 border-none">LIVE</Badge>
            </Link>
            <Link href="/tokenomics" className="hover:text-primary transition-colors">Tokenomics</Link>
            {isAdmin && <Link href="/admin" className="text-yellow-400 hover:text-yellow-300 transition-colors font-bold">Admin</Link>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center bg-muted/50 rounded-full px-3 py-1.5 border border-white/5 gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold">{user?.ulcBalance.available.toFixed(2) || '0.00'} ULC</span>
          </div>
          
          {isConnected ? (
            <Link href="/mypage">
              <Button variant="outline" size="sm" className="gap-2 hidden sm:flex border-white/10 hover:bg-white/5">
                <Wallet className="w-4 h-4" />
                {user?.walletAddress.slice(0, 6)}...
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden">
                <LayoutDashboard className="w-5 h-5" />
              </Button>
            </Link>
          ) : (
            <Button onClick={connectWallet} className="bg-primary hover:bg-primary/90 px-6 rounded-full font-bold">
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: any, className?: string }) {
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>{children}</div>;
}
