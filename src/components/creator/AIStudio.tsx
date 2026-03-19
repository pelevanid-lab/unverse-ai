
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db } from '@/lib/firebase';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Wand2, Check, X, Globe, Lock, Clock, Coins, Package, Send, Sparkles, User, Save, RefreshCcw, AlertCircle, Users, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { buildPrompt, PromptStyle, CompositionMode } from '@/lib/CopilotEngine';
import { CharacterProfile } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AIStudio() {
    const { user } = useWallet();
    const { toast } = useToast();
    
    // UI state
    const [mode, setMode] = useState<'new' | 'consistent'>(user?.savedCharacter ? 'consistent' : 'new');
    const [composition, setComposition] = useState<CompositionMode>('solo');
    const [showCharacterEditor, setShowCharacterEditor] = useState(false);
    
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
            toast({ title: "Feedback Received", description: "Thanks! We'll use this to improve our models." });
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
            toast({ title: "Character Saved", description: "This character will now be used for consistent generations." });
            setShowCharacterEditor(false);
            setMode('consistent');
        } catch (e) {
            toast({ variant: 'destructive', title: "Save Failed" });
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
            toast({ title: "Main Character Set!", description: "AI will now use this reference for future images." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Update Failed" });
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || !user?.uid) return;

        const wordCount = prompt.trim().split(/\s+/).length;
        const charCount = prompt.length;

        if (wordCount < 3 && charCount < 20) {
            toast({ 
                variant: "destructive", 
                title: "Prompt too short", 
                description: "Please provide more detail. Minimum 3 words or 20 characters required." 
            });
            return;
        }

        if ((user.ulcBalance?.available || 0) < 3) {
            toast({ 
                variant: "destructive", 
                title: "Insufficient ULC", 
                description: "AI generation costs 3 ULC. Please top up your wallet." 
            });
            return;
        }

        const characterToUse = mode === 'consistent' ? (user.savedCharacter as CharacterProfile) : null;
        const finalEnhancedPrompt = buildPrompt(prompt, selectedStyle, composition, characterToUse);
        setEnhancedPromptUsed(finalEnhancedPrompt);

        setGenerating(true);
        setImageUrl(null);
        setMediaId(null);
        setLogId(null);
        setSatisfactionScore(null);

        try {
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt, 
                    enhancedPrompt: finalEnhancedPrompt,
                    userId: user.uid 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI generation failed');
            }

            const { mediaUrl, mediaId: newMediaId, logId: newLogId } = await response.json();
            setImageUrl(mediaUrl);
            setMediaId(newMediaId);
            setLogId(newLogId);

        } catch (error: any) {
            console.error("AI Generation failed:", error);
            toast({ variant: "destructive", title: "AI Generation Error", description: error.message });
        } finally {
            setGenerating(false);
        }
    };

    const handleSendToContainer = () => {
        toast({ title: 'Saved to Container', description: 'Your AI image is now in your draft container.' });
        resetStudio();
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

            toast({ title: 'Success!', description: 'Your AI masterpiece has been published publicly.' });
            resetStudio();
        } catch (error) {
            console.error("Error publishing AI image:", error);
            toast({ variant: 'destructive', title: 'Publishing Error', description: 'Failed to publish.'});
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
        { id: 'none', label: 'Natural' },
        { id: 'cool', label: 'Cool' },
        { id: 'flirty', label: 'Flirty' },
        { id: 'premium', label: 'Premium' },
        { id: 'moody', label: 'Moody' },
    ];

    const isPromptValid = prompt.trim().split(/\s+/).length >= 3 || prompt.length >= 20;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header with Mode & Composition Selection */}
            <div className="flex flex-col gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
                            <Wand2 className="text-primary" /> AI Image Studio
                        </h2>
                        <p className="text-sm text-muted-foreground">Generate consistent high-quality character content.</p>
                    </div>
                    
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-start md:self-center">
                        <Button 
                            variant={mode === 'new' ? 'primary' : 'ghost'} 
                            size="sm"
                            onClick={() => setMode('new')}
                            className={cn(
                                "rounded-lg text-xs font-bold px-4 transition-all",
                                mode === 'new' && "bg-primary text-white shadow-lg shadow-primary/20"
                            )}
                        >
                            New Character
                        </Button>
                        <Button 
                            variant={mode === 'consistent' ? 'primary' : 'ghost'} 
                            size="sm"
                            onClick={() => {
                                if (!user?.savedCharacter) setShowCharacterEditor(true);
                                else setMode('consistent');
                            }}
                            className={cn(
                                "rounded-lg text-xs font-bold px-4 flex items-center gap-2 transition-all",
                                mode === 'consistent' && "bg-primary text-white shadow-lg shadow-primary/20"
                            )}
                        >
                            <Lock size={12} /> {mode === 'consistent' ? 'Consistent Mode' : 'Character Lock'}
                        </Button>
                    </div>
                </div>

                <div className="h-px bg-white/5 w-full" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Composition</Label>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                            <Button 
                                variant={composition === 'solo' ? 'primary' : 'ghost'} 
                                size="sm"
                                onClick={() => setComposition('solo')}
                                className={cn(
                                    "rounded-lg text-[10px] font-bold px-4 py-1 h-8 flex items-center gap-2 transition-all",
                                    composition === 'solo' && "bg-primary text-white shadow-lg shadow-primary/20"
                                )}
                                disabled={generating || !!imageUrl}
                            >
                                <User size={12} /> Solo Mode
                            </Button>
                            <Button 
                                variant={composition === 'duo' ? 'primary' : 'ghost'} 
                                size="sm"
                                onClick={() => setComposition('duo')}
                                className={cn(
                                    "rounded-lg text-[10px] font-bold px-4 py-1 h-8 flex items-center gap-2 transition-all",
                                    composition === 'duo' && "bg-primary text-white shadow-lg shadow-primary/20"
                                )}
                                disabled={generating || !!imageUrl}
                            >
                                <Users size={12} /> Duo Mode
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 self-start md:self-center">
                        <Coins size={14} className="text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">3 ULC / Generation</span>
                    </div>
                </div>
            </div>

            {/* Character Profile Editor */}
            {showCharacterEditor && (
                <Card className="border-primary/30 bg-primary/5 animate-in slide-in-from-top-4 rounded-[2rem]">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" /> Setup Main Character
                        </CardTitle>
                        <CardDescription>Define the physical traits for your virtual persona.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gender</Label>
                                <Select value={charProfile.gender} onValueChange={(v: any) => setCharProfile(p => ({ ...p, gender: v }))}>
                                    <SelectTrigger className="bg-black/20 border-white/5"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="male">Male</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Hair Color</Label>
                                <Input 
                                    value={charProfile.hairColor} 
                                    onChange={e => setCharProfile(p => ({ ...p, hairColor: e.target.value }))}
                                    placeholder="e.g. Blonde"
                                    className="bg-black/20 border-white/5"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Eye Color</Label>
                                <Input 
                                    value={charProfile.eyeColor} 
                                    onChange={e => setCharProfile(p => ({ ...p, eyeColor: e.target.value }))}
                                    placeholder="e.g. Blue"
                                    className="bg-black/20 border-white/5"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Face Style</Label>
                                <Input 
                                    value={charProfile.faceStyle} 
                                    onChange={e => setCharProfile(p => ({ ...p, faceStyle: e.target.value }))}
                                    placeholder="e.g. Sharp"
                                    className="bg-black/20 border-white/5"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" onClick={() => setShowCharacterEditor(false)} className="rounded-xl">Cancel</Button>
                            <Button onClick={handleSaveCharacterProfile} className="bg-primary rounded-xl font-bold px-8">Save Profile</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Generation Form */}
                <Card className="glass-card border-white/10 h-fit">
                    <CardContent className="p-6 space-y-6">
                        {mode === 'consistent' && user?.savedCharacter && (
                            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-2xl border border-primary/20 animate-in fade-in">
                                <div className="w-12 h-12 rounded-xl overflow-hidden relative border border-white/10">
                                    <Image src={user.savedCharacter.referenceImageUrl || "https://placehold.co/100x100/png?text=?"} fill alt="ref" className="object-cover" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-primary uppercase">Consistent Persona Active</p>
                                    <p className="text-xs font-bold text-white truncate">{user.savedCharacter.name || 'Virtual Model'}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowCharacterEditor(true)} className="h-8 w-8 rounded-lg hover:bg-primary/20 text-primary">
                                    <RefreshCcw size={14} />
                                </Button>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Select Style Preset</Label>
                                <div className="flex flex-wrap gap-2">
                                    {styles.map(style => (
                                        <Button
                                            key={style.id}
                                            variant={selectedStyle === style.id ? 'primary' : 'outline'}
                                            size="sm"
                                            onClick={() => setSelectedStyle(style.id)}
                                            className={cn(
                                                "text-[10px] h-8 rounded-full px-4 border-white/10 transition-all",
                                                selectedStyle === style.id && "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                            )}
                                            disabled={generating || !!imageUrl}
                                        >
                                            {style.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-muted-foreground">Prompt Your Vision</Label>
                                <Textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe your content (e.g. red dress, sunset, balcony). Min 3 words or 20 characters."
                                    className={`bg-white/5 border-white/10 min-h-[120px] rounded-2xl resize-none text-sm leading-relaxed transition-all ${prompt.length > 0 && !isPromptValid ? 'border-yellow-500/50' : ''}`}
                                    disabled={generating || !!imageUrl}
                                />
                                {prompt.length > 0 && !isPromptValid && !imageUrl && (
                                    <p className="text-[10px] text-yellow-500 flex items-center gap-1 font-bold animate-pulse">
                                        <AlertCircle size={10} /> Needs more detail (min 3 words or 20 chars)
                                    </p>
                                )}
                                {isPromptValid && !imageUrl && (
                                    <p className="text-[10px] text-primary flex items-center gap-1 font-bold">
                                        <Sparkles size={10} /> Copilot will translate this into a rich {composition} scene
                                    </p>
                                )}
                            </div>

                            {!imageUrl ? (
                                <Button 
                                    onClick={handleGenerate} 
                                    disabled={generating || !prompt.trim() || !isPromptValid}
                                    className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-bold text-lg gap-2 shadow-xl shadow-primary/20"
                                >
                                    {generating ? <Loader2 className="animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                    {generating ? 'Generating...' : `Generate (3 ULC)`}
                                </Button>
                            ) : (
                                <Button 
                                    variant="outline" 
                                    onClick={resetStudio} 
                                    className="w-full h-12 rounded-xl border-white/10 hover:bg-white/5 font-bold gap-2 text-muted-foreground"
                                >
                                    <X className="w-4 h-4" /> Start Over
                                </Button>
                            )}
                        </div>

                        {generating && (
                            <div className="py-8 text-center space-y-4">
                                <div className="relative w-16 h-16 mx-auto">
                                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium animate-pulse uppercase tracking-widest">Flux is painting your imagination...</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Preview & Action Area */}
                <div className="space-y-6">
                    {imageUrl ? (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <Card className="glass-card border-white/10 overflow-hidden shadow-2xl">
                                <div className="relative aspect-square w-full group">
                                    <Image src={imageUrl} alt="Generated AI" fill className="object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <p className="text-white font-bold text-sm uppercase tracking-tighter">Resulting Masterpiece</p>
                                    </div>
                                </div>
                                
                                <CardContent className="p-6 space-y-4">
                                    {/* Satisfaction Feedback Section */}
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase text-center tracking-widest">How satisfied are you?</p>
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
                                            onClick={handlePublishDirectly}
                                            disabled={publishing}
                                            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-bold text-lg gap-3"
                                        >
                                            {publishing ? <Loader2 className="animate-spin" /> : <Globe className="w-5 h-5" />}
                                            {publishing ? 'Publishing...' : 'Publish as Public'}
                                        </Button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button 
                                                variant="outline"
                                                onClick={handleSendToContainer}
                                                className="h-12 rounded-2xl border-white/10 hover:bg-white/5 font-bold gap-2 text-xs"
                                            >
                                                <Package size={14} /> Container
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                onClick={handleSetAsMainCharacter}
                                                className="h-12 rounded-2xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold gap-2 text-xs"
                                            >
                                                <Lock size={14} /> Character Lock
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] p-12 text-center bg-black/10">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Wand2 className="w-8 h-8 text-muted-foreground opacity-20" />
                            </div>
                            <h3 className="text-muted-foreground font-headline font-bold text-xl opacity-40 uppercase">Canvas is Empty</h3>
                            <p className="text-muted-foreground/40 text-sm mt-2 max-w-xs">Once generated, you can choose to publish your AI art or lock this character for consistent results.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper utility
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
