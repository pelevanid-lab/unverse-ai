
"use client"

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InitV3() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    const runFix = async () => {
        setStatus('loading');
        try {
            console.log("🚀 Starting Manual Firestore Tokenomics Fix V3...");

            const configRef = doc(db, 'config', 'system');
            const statsRef = doc(db, 'config', 'stats');

            const newConfig = {
                genesis_initialized: true,
                isSealed: false,
                last_manual_fix_v3_at: Date.now(),
                admin_wallet_address: "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa",
                treasury_wallets: {
                    TON: "EQD09uY4E4729uY4E4729uY4E4729uY4E472",
                    TRON: "TCY7Bm6hej8nwcjMDmXyYndjZBE4Zpmk2"
                },
                // 1. Subscription Split (15% total: 10% Treasury, 5% Staking)
                platform_subscription_fee_split: 0.15,
                subscription_treasury_ratio: 0.67, 
                subscription_buyback_ratio: 0.33,

                // 2. Premium Unlock Split (15% total: 10% Treasury, 5% Burn)
                premium_unlock_fee_split: 0.15,
                premium_unlock_treasury_ratio: 0.67,
                premium_unlock_burn_ratio: 0.33,
                
                // 3. AI Studio (3 ULC: 2 Treasury, 1 Burn)
                ai_generation_cost: 3,
                ai_generation_treasury_split: 2,
                ai_generation_burn_split: 1,

                pools: {
                    reserve: 420000000,
                    team: 130000000,
                    creators: 120000000,
                    presale: 100000000,
                    staking: 80000000,
                    liquidity: 60000000,
                    promo: 50000000,
                    exchanges: 40000000
                },
                totalTreasuryUSDT: 0,
                totalBuybackStakingUSDT: 0,
                totalStakedULC: 0,
                totalPresaleSold: 0
            };

            await setDoc(configRef, newConfig);
            await setDoc(statsRef, { totalTreasuryULC: 0, totalBurnedULC: 0 }, { merge: true });

            setStatus('success');
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md glass-card border-yellow-500/50">
                <CardHeader>
                    <CardTitle className="text-yellow-400">Manual Tokenomics Fix (V3)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-sm opacity-70">
                        This page will manually overwrite the Firestore config using your current browser authentication.
                    </p>

                    {status === 'idle' && (
                        <Button onClick={runFix} className="w-full h-12 bg-yellow-400 text-black font-bold">
                            EXECUTE FIX NOW (0.15 SPLIT)
                        </Button>
                    )}

                    {status === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
                            <p className="font-bold">Updating Firestore...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4 text-green-400">
                            <CheckCircle2 className="w-16 h-16" />
                            <h3 className="text-xl font-bold uppercase">Success!</h3>
                            <p className="text-sm text-center">Tokenomics rules (0.15 split) have been applied manually.</p>
                            <Button variant="outline" onClick={() => window.location.href = '/en/admin'} className="mt-4">
                                Back to Admin
                            </Button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4 text-red-400">
                            <AlertCircle className="w-16 h-16" />
                            <h3 className="text-xl font-bold uppercase">Update Failed</h3>
                            <p className="text-sm text-center">{error}</p>
                            <Button onClick={runFix} variant="outline" className="mt-4">Retry</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
