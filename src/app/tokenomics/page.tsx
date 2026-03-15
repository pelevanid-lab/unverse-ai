
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Flame, Gem, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const ALLOCATION_DATA = [
  { name: 'Reserve Pool', value: 420, color: 'hsl(var(--primary))' },
  { name: 'Team Vesting', value: 130, color: 'hsl(var(--secondary))' },
  { name: 'Creator Incentives', value: 120, color: 'hsl(var(--accent))' },
  { name: 'Presale', value: 100, color: '#fbbf24' },
  { name: 'Treasury', value: 80, color: '#4ade80' },
  { name: 'Liquidity', value: 60, color: '#60a5fa' },
  { name: 'Promo', value: 50, color: '#f472b6' },
  { name: 'Exchanges', value: 40, color: '#a78bfa' },
];

export default function TokenomicsPage() {
  return (
    <div className="space-y-12 pb-20">
      <header className="text-center space-y-4 pt-10">
        <h1 className="text-6xl font-headline font-bold gradient-text tracking-tighter">Tokenomics</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A deflationary economy powered by the 1 Billion $ULC supply.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-primary" /> Supply Allocation</CardTitle>
            <CardDescription>Breakdown of the total 1B ULC supply (Millions).</CardDescription>
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
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10 p-8 space-y-6">
           <div className="flex items-start gap-4">
             <div className="p-3 bg-red-500/10 rounded-xl"><Flame className="text-red-400" /></div>
             <div>
               <h4 className="font-bold">Burn Mechanism</h4>
               <p className="text-sm text-muted-foreground">Every AI Chat Fee (0.5 ULC) and a portion of content unlocks are permanently burned.</p>
             </div>
           </div>
           <div className="flex items-start gap-4">
             <div className="p-3 bg-green-500/10 rounded-xl"><Gem className="text-green-400" /></div>
             <div>
               <h4 className="font-bold">Staking Yield</h4>
               <p className="text-sm text-muted-foreground">Stakers earn 2.5% of all platform premium unlocks.</p>
             </div>
           </div>
           <div className="flex items-start gap-4">
             <div className="p-3 bg-blue-500/10 rounded-xl"><Coins className="text-blue-400" /></div>
             <div>
               <h4 className="font-bold">Creator Revenue</h4>
               <p className="text-sm text-muted-foreground">Creators keep 95% of unlock fees and 90% of USDT subscriptions.</p>
             </div>
           </div>
        </Card>
      </div>
    </div>
  );
}
