"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Flame, Gem, TrendingUp, Wallet, ShieldCheck, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

const ALLOCATION_DATA = [
  { name: 'Reserve Pool', value: 42, color: 'hsl(var(--primary))' },
  { name: 'Creator Incentives', value: 12, color: 'hsl(var(--secondary))' },
  { name: 'Team Vesting', value: 13, color: 'hsl(var(--accent))' },
  { name: 'Treasury', value: 8, color: '#4ade80' },
  { name: 'Liquidity', value: 6, color: '#60a5fa' },
  { name: 'Marketing', value: 5, color: '#f472b6' },
  { name: 'Exchanges', value: 4, color: '#a78bfa' },
  { name: 'Presale', value: 10, color: '#fbbf24' },
];

const EMISSION_DATA = [
  { year: 'Year 1', amount: 100 },
  { year: 'Year 2', amount: 80 },
  { year: 'Year 3', amount: 64 },
  { year: 'Year 4', amount: 51 },
  { year: 'Year 5', amount: 41 },
];

export default function TokenomicsPage() {
  return (
    <div className="space-y-12 pb-20">
      <header className="text-center space-y-4 pt-10">
        <h1 className="text-6xl font-headline font-bold gradient-text tracking-tighter">Unverse Tokenomics</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A sustainable, deflationary economy powered by the $ULC utility token.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" /> Token Allocation
            </CardTitle>
            <CardDescription>Visual breakdown of the total 1,000,000,000 $ULC supply.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ALLOCATION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {ALLOCATION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Emission Schedule
            </CardTitle>
            <CardDescription>Decaying rewards model ensuring long-term scarcity.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={EMISSION_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card p-8 border-white/10 text-center space-y-4">
           <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
             <Coins className="w-6 h-6 text-primary" />
           </div>
           <h3 className="font-headline font-bold text-xl">Utility Token</h3>
           <p className="text-sm text-muted-foreground">Every interaction, from AI chat to premium content, requires $ULC.</p>
        </Card>
        <Card className="glass-card p-8 border-white/10 text-center space-y-4">
           <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
             <Flame className="w-6 h-6 text-red-400" />
           </div>
           <h3 className="font-headline font-bold text-xl">Burn Mechanism</h3>
           <p className="text-sm text-muted-foreground">2.5% of every content unlock is burned, reducing circulating supply over time.</p>
        </Card>
        <Card className="glass-card p-8 border-white/10 text-center space-y-4">
           <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
             <Gem className="w-6 h-6 text-green-400" />
           </div>
           <h3 className="font-headline font-bold text-xl">Staking Yield</h3>
           <p className="text-sm text-muted-foreground">Holders earn yield derived from platform fees by securing the network.</p>
        </Card>
      </div>

      <section className="space-y-6">
        <h2 className="text-3xl font-headline font-bold text-center">Protocol Splits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <Card className="glass-card overflow-hidden">
             <div className="bg-primary/10 p-4 border-b border-white/10">
               <h4 className="font-bold flex items-center gap-2"><Coins className="w-4 h-4" /> Content Unlocks (ULC)</h4>
             </div>
             <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Creator Share</span>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-none">95.0%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Staking Rewards</span>
                  <Badge variant="outline">2.5%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Treasury / Ops</span>
                  <Badge variant="outline">2.5%</Badge>
                </div>
             </CardContent>
           </Card>

           <Card className="glass-card overflow-hidden">
             <div className="bg-blue-500/10 p-4 border-b border-white/10">
               <h4 className="font-bold flex items-center gap-2"><Wallet className="w-4 h-4" /> Subscriptions (USDT)</h4>
             </div>
             <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Creator Share</span>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-none">90.0%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Platform Treasury</span>
                  <Badge variant="outline">5.0%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Buyback & Burn</span>
                  <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-none">5.0%</Badge>
                </div>
             </CardContent>
           </Card>
        </div>
      </section>
    </div>
  );
}
