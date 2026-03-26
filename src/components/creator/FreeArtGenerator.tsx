"use client";

import { useState } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { processAiGenerationPayment } from '@/lib/ledger';
import { Loader2, Wand2, Sparkles, Save, RefreshCcw, AlertCircle, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslations, useLocale } from 'next-intl';
import { Uniq } from '@/lib/uniq';
import { SceneLock } from '@/lib/types';
import { SceneRuleEngine } from '@/lib/scene-engine';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export function FreeArtGenerator() {
    const t = useTranslations('AIStudio');
    const locale = useLocale();
    const { user } = useWallet();
    const { toast } = useToast();

    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [logId, setLogId] = useState<string | null>(null);
    const [lastSeed, setLastSeed] = useState<number | null>(null);
    const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string | null>(null);
    const [variationPrompt, setVariationPrompt] = useState('');
    const [showVariationInput, setShowVariationInput] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const [currentSceneLock, setCurrentSceneLock] = useState<SceneLock | null>(null);
    const [detectedSceneType, setDetectedSceneType] = useState<string>('other');

    const isPromptValid = prompt.trim().split(/\s+/).length >= 2 || prompt.length >= 10;

    const handleGenerate = async (isRegen: boolean = false, isVariation: boolean = false) => {
        if (!user?.uid) return;
        
        // Variation cost is 5, Regen cost is 3, Initial is 5
        const cost = isRegen ? 3 : 5;

        if ((user.ulcBalance?.available || 0) < cost) {
            toast({ variant: "destructive", title: t('insufficientULC'), description: t('insufficientULCDesc') });
            return;
        }

        // 🚀 AUTO-SAVE: If this is a variation, save the PREVIOUS image to pool first
        if (isVariation && imageUrl) {
            try {
                const uniq = new Uniq(user.uid);
                await uniq.init();
                const tags = await uniq.generateTags(prompt, locale);

                await fetch('/api/ai/save-to-container', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.uid,
                        mediaUrl: imageUrl,
                        mediaType: 'image',
                        prompt: prompt,
                        isAI: true,
                        aiPrompt: prompt,
                        isFreeArt: true,
                        tags: tags
                    })
                });
                console.log("Auto-saved previous image to pool before variation.");
            } catch (e) {
                console.error("Auto-save failed:", e);
                // We continue anyway even if save fails, but we logged it
            }
        }

        setGenerating(true);
        if (!isVariation && !isRegen) {
            setImageUrl(null);
            setIsTranslating(true);
        }

        try {
            const uniq = new Uniq(user.uid);
            await uniq.init();

            let enhancedPrompt = lastEnhancedPrompt || "";
            let dna: any = currentSceneLock;

            if (!isVariation && !isRegen) {
                // 1. Initial DNA Extraction
                setIsTranslating(true);
                const expansion = await uniq.generateImagePrompt({
                    userInput: prompt,
                    style: 'cinematic',
                    outfit: undefined
                });
                enhancedPrompt = expansion.enhancedPrompt;
                dna = expansion.sceneLock;
                setIsTranslating(false);
            }

            // 2. Generation API call
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    translation: isVariation ? (variationPrompt || "cinematic masterpiece") : enhancedPrompt,
                    enhancedPrompt: enhancedPrompt,
                    originalEnhancedPrompt: isVariation ? lastEnhancedPrompt : undefined,
                    image: isVariation ? imageUrl : undefined,
                    seed: isVariation ? lastSeed : undefined,
                    sceneLock: dna,
                    userId: user.uid,
                    cost: cost,
                    isFreeArt: true
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t('generationFailed'));
            }

            const { mediaUrl, logId: newLogId, finalAuditPrompt, seed: newSeed } = await response.json();
            
            // 🛡️ SCENE LOCK DNA (Auto-lock if not existing)
            const stype = SceneRuleEngine.detectSceneType(finalAuditPrompt || enhancedPrompt);
            const lock = SceneRuleEngine.generateSceneLock(finalAuditPrompt || enhancedPrompt, stype, dna);
            setCurrentSceneLock(lock);
            setDetectedSceneType(stype);

            setImageUrl(mediaUrl);
            setLogId(newLogId);
            setLastSeed(newSeed);
            setLastEnhancedPrompt(finalAuditPrompt);
            setShowVariationInput(false);
            setVariationPrompt('');

            toast({ title: t('successTitle'), description: "Your art has been adapted! ✨" });

        } catch (error: any) {
            console.error("Free Art Generation failed:", error);
            toast({ variant: "destructive", title: t('generationError'), description: error.message });
        } finally {
            setGenerating(false);
            setIsTranslating(false);
        }
    };

    const handleSaveToPool = async () => {
        if (!imageUrl || !user?.uid || publishing) return;
        setPublishing(true);
        try {
            const uniq = new Uniq(user.uid);
            await uniq.init();
            const tags = await uniq.generateTags(prompt, locale);

            const response = await fetch('/api/ai/save-to-container', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    mediaUrl: imageUrl,
                    mediaType: 'image',
                    prompt: prompt,
                    isAI: true,
                    aiPrompt: prompt,
                    isFreeArt: true,
                    tags: tags
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Save failed");
            }

            toast({ title: t('savedInPool'), description: t('savedInPoolDesc') });
            setPrompt('');
            setImageUrl(null);
        } catch (e) {
            toast({ variant: 'destructive', title: t('saveFailed') });
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="glass-card border-white/10">
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{t('promptYourVision')}</Label>
                                <Textarea
                                    placeholder={t('promptPlaceholder')}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="min-h-[150px] bg-black/40 border-white/10 rounded-2xl resize-none p-4 text-lg"
                                />
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 italic">
                                    <Sparkles size={12} className="text-primary" />
                                    {isTranslating ? "Translating for AI..." : "Free prompts for landscapes, objects, architecture..."}
                                </p>
                            </div>

                            <Button
                                onClick={() => handleGenerate()}
                                disabled={!isPromptValid || generating || !!imageUrl}
                                className="w-full h-16 rounded-2xl bg-primary font-bold text-xl gap-3 shadow-xl shadow-primary/20"
                            >
                                {generating ? <Loader2 className="animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                {generating ? t('generating') : `Generate (5 ULC)`}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-start gap-4">
                        <AlertCircle className="text-primary shrink-0 mt-1" />
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm">Free Art Mode</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                This mode does not use your locked character. It's perfect for creating backgrounds, 
                                nature, or abstract art. Each generation creates a unique 1:1 masterpiece.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {imageUrl ? (
                        <div className="space-y-6">
                            <Card className="glass-card border-primary/20 bg-black/40 overflow-hidden group relative">
                                <div className="aspect-square w-full flex items-center justify-center relative">
                                    <Image src={imageUrl} fill className="object-contain" alt="Generated" unoptimized />
                                </div>
                                <div className="p-6 bg-black/60 backdrop-blur-md flex flex-col gap-3">
                                    {showVariationInput ? (
                                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                            <Label className="text-[10px] font-bold uppercase text-primary tracking-widest">{t('variationQuestion')}</Label>
                                            <Textarea 
                                                className="bg-black/40 border-primary/20 rounded-xl min-h-[80px] text-sm"
                                                placeholder="e.g. make it sunset, add more mountains..."
                                                value={variationPrompt}
                                                onChange={(e) => setVariationPrompt(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <Button 
                                                    className="flex-1 h-10 rounded-xl font-bold bg-primary"
                                                    onClick={() => handleGenerate(false, true)}
                                                    disabled={generating || !variationPrompt.trim()}
                                                >
                                                    {generating ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                                    Apply Variation (5 ULC)
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    className="h-10 rounded-xl"
                                                    onClick={() => {
                                                        setShowVariationInput(false);
                                                        setVariationPrompt('');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-3">
                                            <Button className="flex-1 h-12 rounded-xl font-bold gap-2" variant="default" onClick={handleSaveToPool} disabled={publishing}>
                                                {publishing ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={18} />}
                                                {t('saveToContainer')}
                                            </Button>
                                            <Button 
                                                className="flex-1 h-12 rounded-xl font-bold gap-2 bg-white/10 hover:bg-white/20 border-white/10" 
                                                variant="outline"
                                                onClick={() => setShowVariationInput(true)}
                                                disabled={generating}
                                            >
                                                <Sparkles size={18} className={generating ? "animate-spin" : "text-emerald-400"} />
                                                {t('variationBtn')} (5 ULC)
                                            </Button>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Button className="flex-1 h-12 rounded-xl font-bold gap-2 bg-white/5 border-white/10 hover:bg-white/10" variant="ghost" onClick={() => handleGenerate(true)} disabled={generating}>
                                            <RefreshCcw size={18} className={generating ? "animate-spin" : ""} /> {t('regenerateDiscount')} (3 ULC)
                                        </Button>
                                        <a href={imageUrl} download="unverse-art.png" target="_blank">
                                            <Button className="h-12 w-12 rounded-xl font-bold flex items-center justify-center bg-white/5 border-white/10 hover:bg-white/10" variant="ghost">
                                                <Download size={18} />
                                            </Button>
                                        </a>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <Card className="glass-card border-dashed border-white/10 bg-white/[0.02] h-full min-h-[400px] flex items-center justify-center text-muted-foreground text-sm italic p-12 text-center">
                            <div className="space-y-4">
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                    <Sparkles size={32} className="opacity-20" />
                                </div>
                                {generating ? (
                                    <div className="space-y-3">
                                        <Loader2 className="animate-spin mx-auto w-8 h-8 text-primary" />
                                        <p className="font-bold text-white not-italic">Uniq is painting your imagination...</p>
                                        <p className="text-xs">Estimate: 5-8 seconds</p>
                                    </div>
                                ) : (
                                    <p>{t('canvasEmpty')}</p>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
