
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Wand2, Check, X, Globe, Lock, Clock, Coins, Package, Send, Sparkles, User, Save, RefreshCcw, AlertCircle, Users, Star, Container } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { buildPrompt, PromptStyle, CompositionMode } from '@/lib/CopilotEngine';
import { CharacterProfile } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type StudioMode = 'standard' | 'digitalTwin' | 'aiEdit';

export function AIStudio() {
    const t = useTranslations('AIStudio');
    const { user } = useWallet();
    const { toast } = useToast();
    
    // UI state
    const [activeTab, setActiveTab] = useState<StudioMode>('standard');

    // Reset results and irrelevant state when switching tabs to ensure independence
    const handleTabChange = (value: string) => {
        setActiveTab(value as StudioMode);
        setImageUrl(null);
        setMediaId(null);
        setLogId(null);
        setSatisfactionScore(null);
        // - **AI Edit**: Selective in-painting to change backgrounds or objects while preserving the main character (3 ULC) (Frozen).
        // - **Character Locking**: In 'New Character' mode, users can now immediately "Lock" a generated result as their main persona for future consistent generations.
        // - **Economic Model**: Treasury (70%) and Burn (30%) logic is now fully dynamic and controlled by the `config/system` document in Firestore (`ai_generation_treasury_split` and `ai_generation_burn_split`).
        // - **Persona Verification**: The 'Consistent' mode now provides clear feedback if no character is yet locked, with a guided setup flow.
        // We keep the prompt in case they want to try the same prompt in another mode, 
        // but clear the refImage if moving to standard
        if (value === 'standard') {
            setRefImage(null);
        }
    };

    const [mode, setMode] = useState<'new' | 'consistent'>(user?.savedCharacter ? 'consistent' : 'new');
    const currentCost = activeTab === 'digitalTwin' 
        ? (mode === 'consistent' ? 3 : 20) 
        : (activeTab === 'aiEdit' ? 3 : 5);
    const [composition, setComposition] = useState<CompositionMode>('solo');
    const [showCharacterEditor, setShowCharacterEditor] = useState(false);
    
    // Advanced AI Controls
    const [outfitLockEnabled, setOutfitLockEnabled] = useState(false);
    const [lockedOutfit, setLockedOutfit] = useState('');
    const [refImage, setRefImage] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Feedback state
    const [logId, setLogId] = useState<string | null>(null);
    const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null);

    // Character Profile State
    const [charProfile, setCharProfile] = useState<Partial<CharacterProfile>>(user?.savedCharacter || {
        name: '',
        gender: 'female',
        ageRange: '20-25',
        hairColor: 'blonde',
        eyeColor: 'blue',
        faceStyle: 'cute',
        bodyStyle: 'slim',
        vibe: 'friendly',
        characterPromptBase: ''
    });

    // Sync charProfile when user data changes
    useEffect(() => {
        if (user?.savedCharacter) {
            setCharProfile(user.savedCharacter);
        }
    }, [user?.savedCharacter]);

    // Generation State
    const [prompt, setPrompt] = useState('');
    const [selectedStyle, setSelectedStyle] = useState<PromptStyle>('none');
    const [generating, setGenerating] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [mediaId, setMediaId] = useState<string | null>(null);
    const [enhancedPromptUsed, setEnhancedPromptUsed] = useState<string | null>(null);
    
    const handleSatisfactionScore = async (score: number) => {
        if (!logId) return;
        setSatisfactionScore(score);
        try {
            await updateDoc(doc(db, 'ai_generation_logs', logId), {
                satisfactionScore: score
            });
            toast({ title: t('feedbackReceived'), description: t('feedbackReceivedDesc') });
        } catch (e) {
            console.error("Score update failed:", e);
        }
    };

    const handleSaveCharacterProfile = async () => {
        if (!user?.uid) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                savedCharacter: {
                    ...charProfile,
                    id: 'main',
                    createdAt: Date.now()
                }
            });
            toast({ title: t('characterSaved'), description: t('characterSavedDesc') });
            setShowCharacterEditor(false);
            setMode('consistent');
        } catch (e) {
            toast({ variant: 'destructive', title: t('saveFailed') });
        }
    };

    const handleSetAsMainCharacter = async () => {
        if (!user?.uid || !imageUrl) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            const updatedProfile = {
                ...charProfile,
                id: 'main',
                referenceImageUrl: imageUrl,
                characterPromptBase: prompt,
                createdAt: Date.now()
            };
            await updateDoc(userRef, {
                savedCharacter: updatedProfile
            });
            toast({ title: t('mainCharacterSet'), description: t('mainCharacterSetDesc') });
            setMode('consistent');
            setShowCharacterEditor(false);
        } catch (e) {
            toast({ variant: 'destructive', title: t('updateFailed') });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            setRefImage(reader.result as string);
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async (overrideImage?: string) => {
        const imageToUse = overrideImage || refImage;

        if (!prompt.trim() || !user?.uid) return;

        const wordCount = prompt.trim().split(/\s+/).length;
        const charCount = prompt.length;

        if (wordCount < 3 && charCount < 20) {
            toast({ 
                variant: "destructive", 
                title: t('promptTooShort'), 
                description: t('promptTooShortDesc') 
            });
            return;
        }

        if ((user.ulcBalance?.available || 0) < 3) {
            toast({ 
                variant: "destructive", 
                title: t('insufficientULC'), 
                description: t('insufficientULCDesc') 
            });
            return;
        }

        const characterToUse = mode === 'consistent' 
            ? (user.savedCharacter as CharacterProfile) 
            : (charProfile as CharacterProfile); // Use current traits for 'new' mode
        
        setGenerating(true);
        setImageUrl(null);
        setMediaId(null);
        setLogId(null);
        setSatisfactionScore(null);

        let finalUserPrompt = prompt.trim();
        // ... translation logic omitted for brevity in chunk but I must include it or replace it correctly
        try {
            const trRes = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: finalUserPrompt, targetLang: 'en' })
            });
            if (trRes.ok) {
                const data = await trRes.json();
                if (data.translatedText) {
                    finalUserPrompt = data.translatedText;
                    console.log("Copilot translated prompt to:", finalUserPrompt);
                }
            }
        } catch (trErr) {
            console.warn("Translation failed, using original prompt:", trErr);
        }

        const finalPrompt = buildPrompt(
            finalUserPrompt, 
            selectedStyle, 
            composition, 
            characterToUse,
            outfitLockEnabled ? lockedOutfit : undefined,
            activeTab
        );
        setEnhancedPromptUsed(finalPrompt);

        try {
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: finalUserPrompt, 
                    enhancedPrompt: finalPrompt,
                    userId: user.uid,
                    cost: currentCost,
                    image: imageToUse || undefined,
                    mask: activeTab === 'aiEdit' ? imageToUse : undefined // Simplified
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t('generationFailed'));
            }

            const { mediaUrl, mediaId: newMediaId, logId: newLogId } = await response.json();
            setImageUrl(mediaUrl);
            setMediaId(newMediaId);
            setLogId(newLogId);

        } catch (error: any) {
            console.error("AI Generation failed:", error);
            toast({ variant: "destructive", title: t('generationError'), description: error.message });
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveToPool = async () => {
        if (!imageUrl || !user?.uid || publishing) return;
        setPublishing(true);
        try {
            // "Havuza Kaydet" now creates the draft manually
            const mediaDocRef = await addDoc(collection(db, 'creator_media'), {
                creatorId: user.uid,
                mediaUrl: imageUrl,
                mediaType: 'image',
                status: 'draft',
                createdAt: Date.now(),
                prompt: prompt,
                isAI: true,
                aiPrompt: prompt,
                aiEnhancedPrompt: enhancedPromptUsed || prompt,
                paymentReference: logId // using the logId returned from generation
            });
            setMediaId(mediaDocRef.id);
            toast({ title: t('savedInPool'), description: t('savedInPoolDesc') });
            resetStudio(); // Clear the screen after save as requested
        } catch (e) {
            console.error("Error saving to pool:", e);
            toast({ variant: 'destructive', title: t('saveFailed') });
        } finally {
            setPublishing(false);
        }
    };

    const handlePublishDirectly = async () => {
        if (!imageUrl || !user?.uid || !mediaId) return;

        setPublishing(true);
        try {
            await addDoc(collection(db, 'posts'), {
                creatorId: user.uid,
                creatorName: user.username,
                creatorAvatar: user.avatar || '',
                mediaUrl: imageUrl,
                mediaType: 'image',
                content: prompt,
                contentType: 'public', // Hardcoded to public
                unlockPrice: 0,
                createdAt: Date.now(),
                isAI: true,
                aiPrompt: prompt,
                aiEnhancedPrompt: enhancedPromptUsed,
                likes: 0,
                unlockCount: 0,
                limited: null
            });

            await deleteDoc(doc(db, 'creator_media', mediaId));

            toast({ title: t('publishSuccess'), description: t('publishSuccessDesc') });
            resetStudio();
        } catch (error) {
            console.error("Error publishing AI image:", error);
            toast({ variant: 'destructive', title: t('publishingError'), description: t('publishingErrorDesc')});
        } finally {
            setPublishing(false);
        }
    };

    const resetStudio = () => {
        setImageUrl(null);
        setMediaId(null);
        setLogId(null);
        setSatisfactionScore(null);
        setPrompt('');
        setEnhancedPromptUsed(null);
        setSelectedStyle('none');
        setComposition('solo');
    };

    const styles: { id: PromptStyle, label: string }[] = [
        { id: 'none', label: t('natural') },
        { id: 'cool', label: t('cool') },
        { id: 'flirty', label: t('flirty') },
        { id: 'premium', label: t('stylePremium') },
        { id: 'moody', label: t('moody') },
    ];

    const isPromptValid = prompt.trim().split(/\s+/).length >= 3 || prompt.length >= 20;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Main Tabs Selection */}
            <Tabs defaultValue="standard" value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid grid-cols-3 bg-black/40 p-1.5 rounded-[2rem] border border-white/5 h-auto mb-8">
                    <TabsTrigger value="standard" className="rounded-full py-3 font-bold text-xs gap-2 data-[state=active]:bg-primary">
                        <Wand2 size={16} /> {t('tabStandard')}
                    </TabsTrigger>
                    <TabsTrigger value="digitalTwin" disabled className="rounded-full py-3 font-bold text-xs gap-2 relative group opacity-50">
                        <Sparkles size={16} /> {t('tabDigitalTwin')}
                        <Badge variant="secondary" className="absolute -top-2 -right-2 text-[8px] bg-primary text-white border-none">{t('comingSoon')}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="aiEdit" disabled className="rounded-full py-3 font-bold text-xs gap-2 relative group opacity-50">
                        <RefreshCcw size={16} /> {t('tabAiEdit')}
                        <Badge variant="secondary" className="absolute -top-2 -right-2 text-[8px] bg-primary text-white border-none">{t('comingSoon')}</Badge>
                    </TabsTrigger>
                </TabsList>

                {/* Header with Mode & Composition Selection - Hidden for AI Edit */}
                {activeTab !== 'aiEdit' && (
                    <div className="flex flex-col gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/5 mb-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
                                    {activeTab === 'standard' && <Wand2 className="text-primary" />}
                                    {activeTab === 'digitalTwin' && <Sparkles className="text-primary" />}
                                    {t(`tab${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`)}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {activeTab === 'standard' && t('subtitle')}
                                    {activeTab === 'digitalTwin' && t('digitalTwinDesc')}
                                </p>
                            </div>
                            
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-start md:self-center">
                                {activeTab === 'standard' ? (
                                    <>
                                        <Button 
                                            variant={mode === 'new' ? 'default' : 'ghost'} 
                                            size="sm"
                                            onClick={() => setMode('new')}
                                            className={cn(
                                                "rounded-lg text-xs font-bold px-4 transition-all h-8",
                                                mode === 'new' && "bg-primary text-white shadow-lg shadow-primary/20"
                                            )}
                                        >
                                            {t('newCharacter')}
                                        </Button>
                                        <Button 
                                            variant={mode === 'consistent' ? 'default' : 'ghost'} 
                                            size="sm"
                                            onClick={() => {
                                                if (!user?.savedCharacter) setShowCharacterEditor(true);
                                                else setMode('consistent');
                                            }}
                                            className={cn(
                                                "rounded-lg text-xs font-bold px-4 flex items-center gap-2 transition-all h-8",
                                                mode === 'consistent' && "bg-primary text-white shadow-lg shadow-primary/20"
                                            )}
                                        >
                                            <Lock size={12} /> {mode === 'consistent' ? t('consistentMode') : t('characterLock')}
                                        </Button>
                                    </>
                                ) : (
                                    <div className="px-4 py-1 text-xs font-bold text-primary flex items-center gap-2 h-8">
                                        {activeTab === 'digitalTwin' ? (
                                            <><Sparkles size={12} /> {t('digitalTwinActive')}</>
                                        ) : (
                                            <><RefreshCcw size={12} /> {t('aiEditActive')}</>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="h-px bg-white/5 w-full" />

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t('composition')}</Label>
                                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                    <Button 
                                        variant={composition === 'solo' ? 'default' : 'ghost'} 
                                        size="sm"
                                        onClick={() => setComposition('solo')}
                                        className={cn(
                                            "rounded-lg text-[10px] font-bold px-4 py-1 h-8 flex items-center gap-2 transition-all",
                                            composition === 'solo' && "bg-primary text-white shadow-lg shadow-primary/20"
                                        )}
                                        disabled={generating || !!imageUrl}
                                    >
                                        <User size={12} /> {t('soloMode')}
                                    </Button>
                                    <Button 
                                        variant={composition === 'duo' ? 'default' : 'ghost'} 
                                        size="sm"
                                        onClick={() => setComposition('duo')}
                                        className={cn(
                                            "rounded-lg text-[10px] font-bold px-4 py-1 h-8 flex items-center gap-2 transition-all",
                                            composition === 'duo' && "bg-primary text-white shadow-lg shadow-primary/20"
                                        )}
                                        disabled={generating || !!imageUrl}
                                    >
                                        <Users size={12} /> {t('duoMode')}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 self-start md:self-center">
                                <Coins size={14} className="text-primary" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                    {activeTab === 'standard' && (mode === 'consistent' ? t('cost3') : t('cost5'))}
                                    {activeTab === 'digitalTwin' && (mode === 'consistent' ? t('cost3') : t('cost20'))}
                                </span>
                            </div>
                        </div>
                    </div>
                )}


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Generation Form Column */}
                <div className="space-y-6">
                    <TabsContent value="standard" className="mt-0 space-y-6">
                        <Card className="glass-card border-white/10 h-fit">
                            <CardContent className="p-6 space-y-6">
                                {mode === 'consistent' ? (
                                    user?.savedCharacter ? (
                                        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-2xl border border-primary/20 animate-in fade-in">
                                            <div className="w-12 h-12 rounded-xl overflow-hidden relative border border-white/10">
                                                <Image 
                                                    src={user.savedCharacter.referenceImageUrl || "https://placehold.co/100x100/png?text=?"} 
                                                    fill 
                                                    alt="ref" 
                                                    className="object-cover" 
                                                    unoptimized // Avoid caching issues for new images
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-bold text-primary uppercase">{t('consistentPersonaActive')}</p>
                                                <p className="text-xs font-bold text-white truncate">{user.savedCharacter.name || t('virtualModel')}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => setShowCharacterEditor(true)} className="h-8 w-8 rounded-lg hover:bg-primary/20 text-primary">
                                                <RefreshCcw size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 text-center space-y-3">
                                            <p className="text-xs text-muted-foreground">{t('noCharacterToLock')}</p>
                                            <Button 
                                                variant="outline" 
                                                onClick={() => setMode('new')}
                                                className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                                            >
                                                <User className="w-4 h-4 mr-2" /> {t('newCharacter')}
                                            </Button>
                                        </div>
                                    )
                                ) : (
                                    /* Traits integration for New Character mode */
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4 animate-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-bold uppercase tracking-wider">{t('characterTraits')}</span>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('characterName')}</Label>
                                                <Input 
                                                    value={charProfile.name} 
                                                    onChange={e => setCharProfile(p => ({ ...p, name: e.target.value }))}
                                                    placeholder={t('characterNamePlaceholder')}
                                                    className="bg-black/20 border-white/5 h-9 text-xs"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('gender')}</Label>
                                                    <Select value={charProfile.gender} onValueChange={(v: any) => setCharProfile(p => ({ ...p, gender: v }))}>
                                                        <SelectTrigger className="bg-black/20 border-white/5 h-9 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="female">{t('female')}</SelectItem>
                                                            <SelectItem value="male">{t('male')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('hairColor')}</Label>
                                                <Input 
                                                    value={charProfile.hairColor} 
                                                    onChange={e => setCharProfile(p => ({ ...p, hairColor: e.target.value }))}
                                                    placeholder={t('hairColorPlaceholder')}
                                                    className="bg-black/20 border-white/5 h-9 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('eyeColor')}</Label>
                                                <Input 
                                                    value={charProfile.eyeColor} 
                                                    onChange={e => setCharProfile(p => ({ ...p, eyeColor: e.target.value }))}
                                                    placeholder={t('eyeColorPlaceholder')}
                                                    className="bg-black/20 border-white/5 h-9 text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">{t('faceStyle')}</Label>
                                                <Input 
                                                    value={charProfile.faceStyle} 
                                                    onChange={e => setCharProfile(p => ({ ...p, faceStyle: e.target.value }))}
                                                    placeholder={t('faceStylePlaceholder')}
                                                    className="bg-black/20 border-white/5 h-9 text-xs"
                                                />
                                            </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Outfit Lock Logic */}
                                <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label className="text-sm font-bold flex items-center gap-2">
                                                <Lock size={14} className="text-primary" /> {t('outfitLock')}
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground">{t('outfitLockTooltip')}</p>
                                        </div>
                                        <Switch checked={outfitLockEnabled} onCheckedChange={setOutfitLockEnabled} />
                                    </div>
                                    {outfitLockEnabled && (
                                        <Input 
                                            placeholder={t('outfitLockPlaceholder')}
                                            value={lockedOutfit}
                                            onChange={(e) => setLockedOutfit(e.target.value)}
                                            className="bg-black/20 border-white/5 text-xs h-10 rounded-xl"
                                        />
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">{t('selectStylePreset')}</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {styles.map((style) => (
                                                <Button
                                                    key={style.id}
                                                    variant={selectedStyle === style.id ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setSelectedStyle(style.id)}
                                                    className={cn(
                                                        "rounded-full text-[10px] font-bold px-4 h-8 transition-all",
                                                        selectedStyle === style.id ? "bg-primary text-white" : "border-white/10 hover:bg-white/5"
                                                    )}
                                                >
                                                    {style.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">{t('promptYourVision')}</Label>
                                        <div className="relative">
                                            <Textarea 
                                                placeholder={t('promptPlaceholder')}
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                className="min-h-[120px] bg-black/40 border-white/10 rounded-2xl resize-none p-4"
                                            />
                                            {prompt.length > 0 && !isPromptValid && (
                                                <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-orange-400">
                                                    <AlertCircle size={12} />
                                                    <span className="text-[10px] font-bold uppercase">{t('needsMoreDetail')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-3 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                            <Sparkles size={14} className="text-primary" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground flex-1">
                                            {t('copilotMessage', { composition: composition === 'solo' ? t('soloMode') : t('duoMode') })}
                                        </p>
                                    </div>

                                    <Button 
                                        onClick={() => handleGenerate()}
                                        disabled={!isPromptValid || generating || !!imageUrl}
                                        className="w-full h-14 rounded-2xl bg-primary font-bold text-lg gap-3"
                                    >
                                        {generating ? <Loader2 className="animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                        {generating ? t('generating') : `${t('generateBtn')} (${currentCost} ULC)`}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="digitalTwin" className="mt-0 space-y-6 relative">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-50 rounded-[2rem] flex flex-col items-center justify-center text-center p-6 border border-primary/20">
                            <Clock className="w-12 h-12 text-primary mb-4 opacity-50" />
                            <h3 className="text-2xl font-headline font-bold uppercase tracking-tighter mb-2">{t('comingSoon')}</h3>
                            <p className="text-muted-foreground text-sm max-w-[250px]">{t('featureFrozenDesc')}</p>
                        </div>
                        <Card className="glass-card border-white/10 h-fit opacity-20 pointer-events-none">
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">{t('uploadReference')}</Label>
                                    {mode === 'new' ? (
                                        <div className="relative aspect-video w-full rounded-2xl border-2 border-dashed border-white/10 bg-black/40 overflow-hidden group">
                                            {refImage ? (
                                                <>
                                                    <Image src={refImage} alt="Reference" fill className="object-cover" />
                                                    <Button 
                                                        variant="destructive" size="icon" 
                                                        className="absolute top-2 right-2 h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => setRefImage(null)}
                                                    >
                                                        <X size={14} />
                                                    </Button>
                                                </>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 transition-colors">
                                                    <User size={32} className="text-muted-foreground opacity-20 mb-2" />
                                                    <p className="text-xs font-bold text-muted-foreground uppercase">{t('tabDigitalTwin')}</p>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                </label>
                                            )}
                                            {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}
                                        </div>
                                    ) : (
                                        <div className="relative aspect-video w-full rounded-2xl border border-primary/20 bg-primary/5 flex flex-col items-center justify-center p-6 text-center space-y-3">
                                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                                <Lock className="text-primary w-8 h-8" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-primary uppercase tracking-wider">{t('mainCharacterLocked')}</p>
                                                <p className="text-[10px] text-muted-foreground px-4">{t('mainCharacterLockedDesc')}</p>
                                            </div>
                                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">3 ULC</Badge>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">{t('promptYourVision')}</Label>
                                        <Textarea 
                                            placeholder={t('promptPlaceholderDigitalTwin')}
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            className="min-h-[100px] bg-black/40 border-white/10 rounded-2xl p-4"
                                        />
                                    </div>

                                    <Button 
                                        onClick={() => handleGenerate()}
                                        disabled={(mode === 'new' && !refImage) || !isPromptValid || generating || !!imageUrl}
                                        className="w-full h-14 rounded-2xl bg-primary font-bold text-lg gap-3"
                                    >
                                        {generating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                        {generating ? t('generating') : `${t('generateBtn')} (${currentCost} ULC)`}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="aiEdit" className="mt-0 space-y-6 relative">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-50 rounded-[2rem] flex flex-col items-center justify-center text-center p-6 border border-primary/20">
                            <Clock className="w-12 h-12 text-primary mb-4 opacity-50" />
                            <h3 className="text-2xl font-headline font-bold uppercase tracking-tighter mb-2">{t('comingSoon')}</h3>
                            <p className="text-muted-foreground text-sm max-w-[250px]">{t('featureFrozenDesc')}</p>
                        </div>
                        <div className="space-y-1 mb-4 px-2 opacity-20 pointer-events-none">
                            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
                                <RefreshCcw className="text-primary" /> {t('tabAiEdit')}
                                <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20 text-[10px]">3 ULC</Badge>
                            </h2>
                            <p className="text-sm text-muted-foreground">{t('aiEditDesc')}</p>
                        </div>
                        <Card className="glass-card border-white/10 h-fit opacity-20 pointer-events-none">
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">{t('uploadReference')}</Label>
                                    <div className="relative aspect-video w-full rounded-2xl border-2 border-dashed border-white/10 bg-black/40 overflow-hidden group">
                                        {refImage ? (
                                            <>
                                                <Image src={refImage} alt="Reference" fill className="object-cover" />
                                                <Button 
                                                    variant="destructive" size="icon" 
                                                    className="absolute top-2 right-2 h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setRefImage(null)}
                                                >
                                                    <X size={14} />
                                                </Button>
                                            </>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 transition-colors">
                                                <RefreshCcw size={32} className="text-muted-foreground opacity-20 mb-2" />
                                                <p className="text-xs font-bold text-muted-foreground uppercase">{t('tabAiEdit')}</p>
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            </label>
                                        )}
                                        {isUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">{t('promptYourVision')}</Label>
                                        <Textarea 
                                            placeholder={t('promptPlaceholderAiEdit')}
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            className="min-h-[100px] bg-black/40 border-white/10 rounded-2xl p-4"
                                        />
                                    </div>

                                    <Button 
                                        onClick={() => handleGenerate()}
                                        disabled={!refImage || !isPromptValid || generating || !!imageUrl}
                                        className="w-full h-14 rounded-2xl bg-primary font-bold text-lg gap-3"
                                    >
                                        {generating ? <Loader2 className="animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                                        {generating ? t('generating') : `${t('generateBtn')} (${currentCost} ULC)`}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>

                {/* Preview & Action Area Column */}
                <div className="space-y-6 lg:sticky lg:top-8 h-fit">
                    {imageUrl ? (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <Card className="glass-card border-white/10 overflow-hidden shadow-2xl">
                                <div className="relative aspect-square w-full group">
                                    <Image src={imageUrl} alt="Generated AI" fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <p className="text-white font-bold text-sm uppercase tracking-tighter">{t('resultingMasterpiece')}</p>
                                    </div>
                                </div>
                                
                                <CardContent className="p-6 space-y-4">
                                    {/* Satisfaction Feedback Section */}
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase text-center tracking-widest">{t('satisfaction')}</p>
                                        <div className="flex justify-center gap-2">
                                            {[1, 2, 3, 4, 5].map((score) => (
                                                <Button
                                                    key={score}
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={!logId}
                                                    onClick={() => handleSatisfactionScore(score)}
                                                    className={cn(
                                                        "h-10 w-10 rounded-xl transition-all",
                                                        satisfactionScore === score ? "bg-primary text-white" : "hover:bg-white/10 text-muted-foreground"
                                                    )}
                                                >
                                                    <Star className={cn("w-5 h-5", satisfactionScore && satisfactionScore >= score ? "fill-current" : "")} />
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <Button 
                                            variant="outline"
                                            onClick={() => {
                                                setImageUrl(null);
                                                setMediaId(null);
                                                setLogId(null);
                                            }}
                                            className="w-full h-12 rounded-2xl border-white/10 hover:bg-white/5 font-bold gap-2 text-xs"
                                        >
                                            <RefreshCcw size={14} /> {t('startOver')}
                                        </Button>

                                        <p className="text-[10px] font-bold text-muted-foreground uppercase text-center mt-4 tracking-widest">{t('selectAction')}</p>
                                        
                                        <Button 
                                            onClick={handleSaveToPool}
                                            disabled={publishing || !imageUrl}
                                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-bold text-lg gap-3"
                                        >
                                            <Container className="w-5 h-5" />
                                            {publishing ? t('publishingBtn') : t('saveToContainer')}
                                        </Button>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button 
                                                variant="outline"
                                                onClick={() => {
                                                    // Variation Logic: Trigger generation immediately
                                                    setActiveTab('standard');
                                                    setPrompt(prompt); 
                                                    setRefImage(imageUrl); 
                                                    setImageUrl(null);
                                                    handleGenerate(imageUrl); // Trigger immediately with current result as ref
                                                }}
                                                className="h-12 rounded-2xl border-white/10 hover:bg-white/5 font-bold gap-2 text-xs"
                                            >
                                                <Sparkles size={14} className="text-primary" /> {t('variationBtn')}
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                disabled
                                                className="h-12 rounded-2xl border-white/10 opacity-50 cursor-not-allowed font-bold gap-2 text-xs"
                                            >
                                                <RefreshCcw size={14} /> {t('editBtn')}
                                            </Button>
                                        </div>

                                        {/* NEW: Lock Character Button for Standard AI */}
                                        {activeTab === 'standard' && mode === 'new' && imageUrl && (
                                            <Button 
                                                variant="ghost" 
                                                onClick={handleSetAsMainCharacter}
                                                className="w-full h-12 rounded-2xl border border-primary/20 text-primary font-bold gap-2 text-xs animate-in slide-in-from-bottom-2"
                                            >
                                                <Lock size={14} /> {t('lockAsCharacter')}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] p-12 text-center bg-black/10">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Wand2 className="w-8 h-8 text-muted-foreground opacity-20" />
                            </div>
                            <h3 className="text-muted-foreground font-headline font-bold text-xl opacity-40 uppercase">{t('canvasEmpty')}</h3>
                            <p className="text-muted-foreground/40 text-sm mt-2 max-w-xs">{t('canvasEmptyDesc')}</p>
                        </div>
                    )}
                </div>
            </div>
            </Tabs>
        </div>
    );
}

// Helper utility
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
