"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Flame, Gem, TrendingUp, Wallet, ShieldCheck } from 'lucide-react';

export default function TokenomicsPage() {
  return (
    <div className="space-y-12">
      <header className="text-center space-y-4">
        <h1 className="text-5xl font-headline font-bold gradient-text">Unverse Tokenomics</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Built on a sustainable, deflationary, and community-driven economic model powered by $ULC.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="glass-card text-center p-8">
          <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Coins className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-headline font-bold mb-2">Unlock Coin ($ULC)</h3>
          <p className="text-sm text-muted-foreground">The native utility token for all content unlocks, tips, and AI interactions.</p>
        </Card>

        <Card className="glass-card text-center p-8">
          <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Flame className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-xl font-headline font-bold mb-2">Deflationary Mechanism</h3>
          <p className="text-sm text-muted-foreground">A portion of every subscription and premium unlock is permanently burned.</p>
        </Card>

        <Card className="glass-card text-center p-8">
          <div className="bg-green-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Gem className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-headline font-bold mb-2">Dynamic Emissions</h3>
          <p className="text-sm text-muted-foreground">Rewards decay over time based on the reserve pool size, ensuring long-term value.</p>
        </Card>
      </div>

      <section className="space-y-6">
        <h2 className="text-3xl font-headline font-bold">Token Allocation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Reserve Pool', value: '42%', color: 'bg-primary' },
            { label: 'Creator Incentives', value: '12%', color: 'bg-secondary' },
            { label: 'Team Vesting', value: '13%', color: 'bg-accent' },
            { label: 'Presale', value: '10%', color: 'bg-yellow-400' },
            { label: 'Liquidity', value: '6%', color: 'bg-blue-400' },
            { label: 'Treasury', value: '8%', color: 'bg-green-400' },
            { label: 'Promo/Marketing', value: '5%', color: 'bg-pink-400' },
            { label: 'Exchanges', value: '4%', color: 'bg-purple-400' },
          ].map((item, i) => (
            <div key={i} className="glass-card p-4 flex items-center justify-between border-l-4" style={{ borderColor: 'var(--primary)' }}>
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-lg font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-3xl font-headline font-bold">Revenue Distribution</h2>
          <Card className="glass-card p-8 space-y-6">
            <div>
              <h4 className="font-bold flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Subscriptions (USDT)
              </h4>
              <div className="flex gap-2">
                <Badge className="bg-primary">90% Creator</Badge>
                <Badge variant="outline">5% Treasury</Badge>
                <Badge variant="outline">5% Buyback/Burn</Badge>
              </div>
            </div>
            <div className="pt-6 border-t">
              <h4 className="font-bold flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-primary" /> Premium Unlocks (ULC)
              </h4>
              <div className="flex gap-2">
                <Badge className="bg-primary">95% Creator</Badge>
                <Badge variant="outline">2.5% Treasury</Badge>
                <Badge variant="outline">2.5% Staking</Badge>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-headline font-bold">Emission Formula</h2>
          <Card className="glass-card p-8 flex flex-col justify-center">
            <div className="bg-muted p-6 rounded-2xl text-center">
              <code className="text-2xl font-headline font-bold text-primary">
                reward = min(20, reserve_pool * 0.000002)
              </code>
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Our dynamic emission model rewards active participants while naturally slowing down supply growth as the reserve pool depletes.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}