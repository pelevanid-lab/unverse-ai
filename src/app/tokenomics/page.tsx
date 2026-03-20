
"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';
import { AnimatedText } from '@/components/landing/AnimatedText';
import { Play, ArrowRight, Zap } from 'lucide-react';
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
  const { isConnected, connectWallet } = useWallet();

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <section className="relative pt-10 md:pt-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 blur-[120px] rounded-full -z-10" />
        
        <div className="text-center space-y-8 max-w-4xl mx-auto px-4">
          
          <h1 className="text-6xl md:text-8xl font-headline font-bold leading-tight tracking-tighter">
            Unlock Your Universe
          </h1>

          <div className="text-4xl md:text-6xl font-headline font-bold leading-tight tracking-tighter">
            <span className="gradient-text">
              <AnimatedText words={["Earn.", "Create.", "Unlock."]} />
            </span>
          </div>
          
          <p className="text-lg text-muted-foreground font-bold tracking-widest uppercase">
            Powered by ULC
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {isConnected ? (
              <Link href="/">
                <Button size="lg" className="h-14 px-8 rounded-2xl text-lg font-bold gap-2 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
                  Enter Discover <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <Button size="lg" onClick={connectWallet} className="h-14 px-8 rounded-2xl text-lg font-bold gap-2 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
                Connect Wallet <Zap className="w-5 h-5" />
              </Button>
            )}
            <Link href="/tokenomics">
              <Button variant="outline" size="lg" className="h-14 px-8 rounded-2xl text-lg font-bold border-white/10 hover:bg-white/5">
                Explore Tokenomics
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 relative max-w-5xl mx-auto px-4">
          <div className="aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
            <Image 
              src="https://picsum.photos/seed/unverse-hero/1200/800" 
              alt="Unverse Dashboard" 
              fill 
              className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
              data-ai-hint="futuristic dashboard"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                 <Play className="w-8 h-8 text-white fill-white" />
               </div>
            </div>
          </div>
        </div>
      </section>

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
