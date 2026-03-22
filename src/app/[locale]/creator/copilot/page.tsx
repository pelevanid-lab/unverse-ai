
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Clock, Lock, CheckCircle2, AlertCircle, ChevronLeft, Brain, Zap, Target, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { processAiCreatorActivation } from '@/lib/ledger';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getDailyStrategySuggestions } from '@/lib/CopilotEngine';

export default function CopilotPage() {
    const t = useTranslations('AIStudio');
    const { user, isConnected } = useWallet();
    const { toast } = useToast();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        personaName: '',
        niche: '',
        tone: '',
        targetAudience: '',
        vibe: ''
    });

    const [suggestions, setSuggestions] = useState<{ title: string, content: string }[]>([]);

    useEffect(() => {
        if (user?.aiCreatorModeConfig) {
            setConfig(user.aiCreatorModeConfig);
            setSuggestions(getDailyStrategySuggestions(user.aiCreatorModeConfig.personaName, user.aiCreatorModeConfig.niche));
        } else {
            setSuggestions(getDailyStrategySuggestions("your persona", "your niche"));
        }
    }, [user?.aiCreatorModeConfig]);

    if (!isConnected || !user) {
        return <div className="p-8 text-center">Please connect your wallet.</div>;
    }

    const isActive = user.aiCreatorModeExpiresAt && user.aiCreatorModeExpiresAt > Date.now();
    const daysLeft = isActive ? Math.ceil((user.aiCreatorModeExpiresAt! - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    const isFirstTime = !user.aiCreatorModeActivatedAt;

    const handleActivate = async () => {
        setLoading(true);
        try {
            await processAiCreatorActivation(user.uid);
            toast({ title: "Copilot Activated!", description: "Your 30-day auto-pilot mission has started." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Activation Failed", description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                aiCreatorModeConfig: config
            });
            toast({ title: "Configuration Saved", description: "Your AI persona has been updated." });
        } catch (err) {
            toast({ variant: "destructive", title: "Save Failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 mt-6">
            <header className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/creator/studio')} className="rounded-full">
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <div className="flex items-center gap-4">
                    {user?.savedCharacter?.referenceImageUrl ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary/20 bg-primary/5">
                            <img src={user.savedCharacter.referenceImageUrl} className="w-full h-full object-cover" alt="AI Avatar" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                            <User className="text-muted-foreground" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                            {user?.savedCharacter?.name || "Copilot"} Workspace <Badge className="bg-primary">thev 2.0</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">Autonomous Content & Strategy</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Card */}
                <Card className={cn("md:col-span-1 border-white/10 overflow-hidden relative", isActive ? "bg-primary/5 border-primary/20" : "bg-white/5")}>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                             {isActive ? <Zap className="text-primary animate-pulse" /> : <Clock className="text-muted-foreground" />}
                             Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isActive ? (
                            <div className="space-y-4">
                                <div className="bg-primary/10 rounded-2xl p-4 text-center">
                                    <p className="text-4xl font-headline font-bold text-primary">{daysLeft}</p>
                                    <p className="text-[10px] uppercase font-bold text-primary/60">Days Locked</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-green-400">
                                    <Lock size={14} /> <span>System is currently locked & active.</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-sm text-muted-foreground text-center py-4">
                                    {isFirstTime ? "Your first month is 100% FREE." : "Inactive. Activation fee: 5 ULC"}
                                </div>
                                <Button onClick={handleActivate} disabled={loading} className="w-full h-12 rounded-2xl font-bold">
                                    {isFirstTime ? "Activate Free Trial" : "Activate (5 ULC)"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Strategy Card */}
                <Card className="md:col-span-2 glass-card border-white/10">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Brain className="text-primary" /> Daily Intelligence
                        </CardTitle>
                        <CardDescription>3 AI suggestions to grow your influence today.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!isActive ? (
                            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2 opacity-50">
                                <Lock size={20} />
                                <p>Activate Copilot to receive daily strategy.</p>
                            </div>
                        ) : (
                            <>
                                {suggestions.map((item, i) => (
                                    <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-primary/40 transition-colors">
                                        <div className="flex items-center gap-2 mb-1">
                                            {i === 0 ? <Target className="w-4 h-4 text-orange-400" /> : i === 1 ? <Sparkles className="w-4 h-4 text-primary" /> : <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                            <span className="text-xs font-bold uppercase tracking-wider">{item.title}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{item.content}</p>
                                    </div>
                                ))}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Zero-Day Configuration */}
            <Card className="glass-card border-white/10">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline font-bold">Persona "Zero Day" Config</CardTitle>
                    <CardDescription>The core parameters used by AI to generate your content & strategy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Persona Name</Label>
                            <Input 
                                value={config.personaName} 
                                onChange={e => setConfig(p => ({ ...p, personaName: e.target.value }))}
                                placeholder="e.g. Cyber Girl X"
                                className="bg-black/20 border-white/10 rounded-xl h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Market Niche</Label>
                            <Input 
                                value={config.niche} 
                                onChange={e => setConfig(p => ({ ...p, niche: e.target.value }))}
                                placeholder="e.g. Fitness, Gaming, Crypto"
                                className="bg-black/20 border-white/10 rounded-xl h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Communication Tone</Label>
                            <Input 
                                value={config.tone} 
                                onChange={e => setConfig(p => ({ ...p, tone: e.target.value }))}
                                placeholder="e.g. Mysterious, Friendly, Bold"
                                className="bg-black/20 border-white/10 rounded-xl h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Target Audience</Label>
                            <Input 
                                value={config.targetAudience} 
                                onChange={e => setConfig(p => ({ ...p, targetAudience: e.target.value }))}
                                placeholder="e.g. Gen Z Creators"
                                className="bg-black/20 border-white/10 rounded-xl h-12"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Persona Vibe / Core Instruction</Label>
                        <Textarea 
                             value={config.vibe} 
                             onChange={e => setConfig(p => ({ ...p, vibe: e.target.value }))}
                             placeholder="Describe the ultimate vibe that AI should maintain..."
                             className="bg-black/20 border-white/10 rounded-2xl min-h-[100px] resize-none"
                        />
                    </div>
                    <Button onClick={handleSaveConfig} disabled={loading} className="w-full md:w-auto px-12 h-12 rounded-2xl font-bold bg-white text-black hover:bg-white/90">
                        {loading ? "Saving..." : "Save Configuration"}
                    </Button>
                </CardContent>
            </Card>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-6 flex items-start gap-4">
                <AlertCircle className="text-yellow-500 shrink-0 mt-1" />
                <div className="space-y-1">
                    <p className="text-sm font-bold text-yellow-500">Subscription Protocol</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Once activated, Copilot mode remains strictly ON for 30 consecutive days. 
                        Daily drafting fees (1 ULC) will be auto-deducted from your available balance. 
                        If balance is insufficient, drafts will pause but subscription remains valid until expiry.
                    </p>
                </div>
            </div>
        </div>
    );
}
