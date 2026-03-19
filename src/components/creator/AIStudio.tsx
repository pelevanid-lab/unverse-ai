
"use client";

import { useState } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Wand2, Check, X, Globe, Lock, Clock, Coins } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function AIStudio() {
    const { user } = useWallet();
    const { toast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    
    // Publish State
    const [contentType, setContentType] = useState<'public' | 'premium' | 'limited'>('public');
    const [priceULC, setPriceULC] = useState(0);
    const [totalSupply, setTotalSupply] = useState(100);

    const handleGenerate = async () => {
        if (!prompt.trim() || !user?.uid) return;

        setGenerating(true);
        setImageUrl(null);

        try {
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, userId: user.uid }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI generation failed');
            }

            const { mediaUrl } = await response.json();
            setImageUrl(mediaUrl);

        } catch (error: any) {
            console.error("AI Generation failed:", error);
            toast({ variant: "destructive", title: "AI Generation Error", description: error.message });
        } finally {
            setGenerating(false);
        }
    };

    const handlePublish = async () => {
        if (!imageUrl || !user?.uid) return;

        setPublishing(true);
        try {
            // Create the final post directly
            await addDoc(collection(db, 'posts'), {
                creatorId: user.uid,
                creatorName: user.username,
                creatorAvatar: user.avatar || '',
                mediaUrl: imageUrl,
                mediaType: 'image',
                content: prompt,
                contentType: contentType,
                unlockPrice: (contentType === 'premium' || contentType === 'limited') ? Number(priceULC) : 0,
                createdAt: Date.now(),
                isAI: true,
                aiPrompt: prompt,
                likes: 0,
                unlockCount: 0,
                limited: contentType === 'limited' ? {
                    totalSupply: Number(totalSupply),
                    soldCount: 0,
                    price: Number(priceULC)
                } : null
            });

            toast({ title: 'Success!', description: 'Your AI masterpiece has been published.' });
            
            // Reset
            setImageUrl(null);
            setPrompt('');
            setContentType('public');
        } catch (error) {
            console.error("Error publishing AI image:", error);
            toast({ variant: 'destructive', title: 'Publishing Error', description: 'Failed to publish.'});
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <Card className="glass-card border-white/10">
                <CardContent className="p-6 space-y-6">
                    <div className="flex items-center gap-2 text-primary">
                        <Wand2 className="w-5 h-5" />
                        <h2 className="font-headline font-bold text-xl uppercase tracking-widest">AI Image Studio</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Original Prompt</Label>
                            <Textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe something incredible..."
                                className="bg-white/5 border-white/10 min-h-[120px] rounded-2xl resize-none"
                                disabled={generating || !!imageUrl}
                            />
                        </div>

                        {!imageUrl ? (
                            <Button 
                                onClick={handleGenerate} 
                                disabled={generating || !prompt.trim()} 
                                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-bold text-lg gap-2 shadow-xl shadow-primary/20"
                            >
                                {generating ? <Loader2 className="animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                {generating ? 'Generating...' : 'Generate with Flux'}
                            </Button>
                        ) : (
                            <Button 
                                variant="outline" 
                                onClick={() => { setImageUrl(null); }} 
                                className="w-full h-12 rounded-xl border-white/10 hover:bg-white/5 font-bold gap-2"
                            >
                                <X className="w-4 h-4" /> Start New Generation
                            </Button>
                        )}
                    </div>

                    {generating && (
                        <div className="py-12 text-center space-y-4">
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium animate-pulse">Flux is processing your prompt...</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-6">
                {imageUrl ? (
                    <Card className="glass-card border-white/10 overflow-hidden animate-in slide-in-from-right-8 duration-500">
                        <div className="relative aspect-square w-full">
                            <Image src={imageUrl} alt="Generated AI" fill className="object-cover" />
                        </div>
                        <CardContent className="p-6 space-y-6 bg-black/40 backdrop-blur-md">
                            <div className="space-y-4">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Select Visibility</Label>
                                <RadioGroup value={contentType} onValueChange={(v: any) => setContentType(v)} className="grid grid-cols-3 gap-2">
                                    <div className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${contentType === 'public' ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                        <RadioGroupItem value="public" id="p-public" className="sr-only" />
                                        <Globe className={contentType === 'public' ? 'text-primary' : 'text-muted-foreground'} size={20} />
                                        <span className="text-[10px] font-bold uppercase">Public</span>
                                    </div>
                                    <div className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${contentType === 'premium' ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                        <RadioGroupItem value="premium" id="p-premium" className="sr-only" />
                                        <Lock className={contentType === 'premium' ? 'text-primary' : 'text-muted-foreground'} size={20} />
                                        <span className="text-[10px] font-bold uppercase">Premium</span>
                                    </div>
                                    <div className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${contentType === 'limited' ? 'bg-yellow-500/20 border-yellow-500 shadow-lg shadow-yellow-500/10' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                        <RadioGroupItem value="limited" id="p-limited" className="sr-only" />
                                        <Clock className={contentType === 'limited' ? 'text-yellow-500' : 'text-muted-foreground'} size={20} />
                                        <span className="text-[10px] font-bold uppercase">Limited</span>
                                    </div>
                                </RadioGroup>
                            </div>

                            {contentType !== 'public' && (
                                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                                            <Coins size={12} className="text-primary" /> Unlock Price
                                        </Label>
                                        <Input 
                                            type="number" 
                                            value={priceULC} 
                                            onChange={(e) => setPriceULC(Number(e.target.value))} 
                                            className="bg-white/5 border-white/10 h-12 font-bold"
                                        />
                                    </div>
                                    {contentType === 'limited' && (
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase text-muted-foreground">Total Supply</Label>
                                            <Input 
                                                type="number" 
                                                value={totalSupply} 
                                                onChange={(e) => setTotalSupply(Number(e.target.value))} 
                                                className="bg-white/5 border-white/10 h-12 font-bold"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button 
                                onClick={handlePublish} 
                                disabled={publishing} 
                                className="w-full h-14 rounded-2xl bg-white text-black hover:bg-gray-200 font-bold text-lg gap-2"
                            >
                                {publishing ? <Loader2 className="animate-spin" /> : <Check className="w-5 h-5" />}
                                {publishing ? 'Publishing...' : 'Publish AI Post'}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] p-12 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <Wand2 className="w-8 h-8 text-muted-foreground opacity-20" />
                        </div>
                        <h3 className="text-muted-foreground font-headline font-bold text-xl opacity-40 uppercase">Awaiting Inspiration</h3>
                        <p className="text-muted-foreground/40 text-sm mt-2">Enter a prompt and generate to see the magic happen.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
