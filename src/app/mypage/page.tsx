"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Coins, Crown, ArrowUpRight, ArrowDownLeft, Sparkles, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function MyPage() {
  const { user, isConnected, disconnectWallet } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h1 className="text-3xl font-headline font-bold">Please Connect</h1>
        <p className="text-muted-foreground text-center max-w-sm">Connect your wallet to access your dashboard, earnings, and unlocks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b">
        <Avatar className="w-24 h-24 border-4 border-primary/20">
          <AvatarImage src={user?.avatar} />
          <AvatarFallback>{user?.username[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-4xl font-headline font-bold">{user?.username}</h1>
          <p className="text-muted-foreground mb-4">{user?.bio}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="bg-muted px-3 py-1 rounded-full text-xs font-mono">{user?.walletAddress}</div>
            <Button variant="outline" size="sm" onClick={disconnectWallet} className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10">
              <LogOut className="w-4 h-4" /> Disconnect
            </Button>
          </div>
        </div>
        <div className="flex gap-4">
          <Link href="/creator">
            <Button className="bg-primary hover:bg-primary/90">Creator Panel</Button>
          </Link>
          <Link href="/wallet">
            <Button variant="secondary">My Wallet</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" /> Available ULC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline font-bold">{user?.ulcBalance.available.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Approx. ${(user?.ulcBalance.available! * 0.015).toFixed(2)} USDT</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-green-400" /> Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline font-bold">{user?.totalEarnings.toFixed(2)} ULC</div>
            <p className="text-xs text-muted-foreground mt-1">From unlocks & subs</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-orange-400" /> Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-headline font-bold">{user?.totalSpent.toFixed(2)} ULC</div>
            <p className="text-xs text-muted-foreground mt-1">Premium unlocks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-400" /> Subscriptions
          </h2>
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              You haven't subscribed to any creators yet.
              <div className="mt-4">
                <Link href="/">
                  <Button variant="outline" size="sm">Explore Creators</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> My AI Muses
          </h2>
          <Card className="glass-card">
            <CardContent className="p-8 text-center text-muted-foreground">
              AI Muse ownership is coming soon.
              <div className="mt-4">
                <Link href="/muses">
                  <Button variant="outline" size="sm">View AI Muses</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}