
"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShieldCheck, Flame, Coins, Lock, BarChart3, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

export default function InvestorTokenomics() {
    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
            <header className="space-y-4">
                <Link href="/tokenomics">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                        <ChevronLeft className="w-4 h-4" /> Back to Tokenomics
                    </Button>
                </Link>
                <div className="space-y-2">
                    <Badge className="bg-primary/20 text-primary border-none">Institutional Grade</Badge>
                    <h1 className="text-5xl font-headline font-bold tracking-tighter">Investor Tokenomics</h1>
                    <p className="text-xl text-muted-foreground">A deep dive into the deflationary mechanics and yield structures of the $ULC ecosystem.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Fixed Supply</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold font-headline">1,000,000,000 <span className="text-sm font-normal opacity-50">ULC</span></p>
                        <p className="text-sm text-muted-foreground mt-2">Maximum supply is hard-capped. No further minting is possible under any circumstances.</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-red-500/20 bg-red-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Flame className="w-5 h-5 text-red-400" /> Deflationary Burn</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold font-headline text-red-400">Continuous <span className="text-sm font-normal opacity-50">Burn</span></p>
                        <p className="text-sm text-muted-foreground mt-2">Every AI content generation and premium unlock triggers a permanent supply reduction.</p>
                    </CardContent>
                </Card>
            </div>

            <section className="space-y-6">
                <h2 className="text-3xl font-headline font-bold flex items-center gap-3">
                    <BarChart3 className="text-primary" /> Core Economic Principles
                </h2>
                
                <div className="space-y-4">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-xl font-bold text-yellow-400">1. Pre-Sale Vesting & Lock-up</h4>
                        <p className="text-muted-foreground leading-relaxed">
                            To ensure long-term stability, Pre-Sale tokens are subject to a 12-month cliff 
                            followed by a 24-month linear release. This ensures that early contributors 
                            are aligned with the multi-year growth of the platform.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-xl font-bold text-yellow-500">2. Staking Reward Mechanism</h4>
                        <p className="text-muted-foreground leading-relaxed">
                            Unlike inflationary tokens, $ULC yield is derived from actual platform revenue. 
                            5% of all USDT monthly subscriptions are directed to the Staking Pool, 
                            which is distributed to ULC stakers every 30 days. This creates a sustainable, 
                            revenue-backed yield model.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-xl font-bold text-blue-400">3. Platform Buyback Support</h4>
                        <p className="text-muted-foreground leading-relaxed">
                            The platform utilizes USDT revenue to periodically buy back ULC from the open market 
                            to fund reward pools and strategic reserves, creating consistent upward pressure 
                            on token demand.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <h4 className="text-xl font-bold text-green-400">4. Immutable Security (Sealed Economy)</h4>
                        <p className="text-muted-foreground leading-relaxed">
                            The Unverse AI economic parameters are sealed at the smart-contract and 
                            ledger levels. No entity can modify ratios or reset pools once the 
                            Economy Seal is active, ensuring 100% transparency and predictability.
                        </p>
                    </div>
                </div>
            </section>

            <Card className="glass-card border-yellow-500/50 bg-yellow-500/5 p-8 text-center space-y-4">
                <TrendingUp className="w-12 h-12 text-yellow-400 mx-auto" />
                <h3 className="text-2xl font-headline font-bold italic">"Revenue-Backed Scarcity"</h3>
                <p className="text-muted-foreground max-w-lg mx-auto italic">
                    By combining a fixed supply with revenue-driven buybacks and staking rewards, 
                    $ULC is designed to scale directly with the growth of the Unverse AI platform users.
                </p>
            </Card>
        </div>
    );
}
