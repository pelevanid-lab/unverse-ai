"use client"

import { useState, useEffect } from 'react'
import { useWallet } from '@/hooks/use-wallet'
import { db, storage } from '@/lib/firebase'
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, User, Camera, Wand2, ChevronLeft, Lock, RefreshCcw, Loader2, Save, Info, Check, Upload, Star, Layers, Video, Maximize, Heart, Zap, Sun } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Uniq } from '@/lib/uniq'
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CharacterProfile, SceneLock } from '@/lib/types'
import { SceneRuleEngine } from '@/lib/scene-engine'
import { useTranslations, useLocale } from 'next-intl'
import { Switch } from "@/components/ui/switch"

export default function AIMusePage() {
    const locale = useLocale()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useWallet()
    const { toast } = useToast()
    const t = useTranslations('Muse')
    const tCommon = useTranslations('AIStudio')

    // 🛡️ Robust Translation Helper (Phase 24)
    const getModeLabel = (key: string, fallback: string) => {
        try {
            const val = t(key);
            // next-intl returns key or error message if missing
            if (!val || val === key || val.includes("MISSING_MESSAGE") || val.includes("Could not resolve")) {
                return fallback;
            }
            return val;
        } catch (e) {
            return fallback;
        }
    };
    
    const [step, setStep] = useState<'selection' | 'photo' | 'prompt' | 'steady' | 'training'>('selection')
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [generatingVariation, setGeneratingVariation] = useState(false)
    const [saving, setSaving] = useState(false)
    
    // Character Creation State
    const [charName, setCharName] = useState('')
    const [refImages, setRefImages] = useState<(string | null)[]>(Array(15).fill(null))
    const [promptDraft, setPromptDraft] = useState('')
    const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
    const [extractedAttributes, setExtractedAttributes] = useState<any>(null)
    
    // Steady State (Generation)
    const [genPrompt, setGenPrompt] = useState('')
    const [lastResult, setLastResult] = useState<string | null>(null)
    const [logId, setLogId] = useState<string | null>(null)
    const [lastSeed, setLastSeed] = useState<number | null>(null)
    const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null)
    const [uploadedRefUrls, setUploadedRefUrls] = useState<string[]>([])
    const [lastEnhancedPrompt, setLastEnhancedPrompt] = useState<string | null>(null)
    const [masterEnhancedPrompt, setMasterEnhancedPrompt] = useState<string | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    // Scene Variations State
    const [showVariationPresets, setShowVariationPresets] = useState(false)
    const [selectedPresets, setSelectedPresets] = useState<{
        composition?: string,
        angle?: string,
        mood?: string,
        action?: string,
        lighting?: string
    }>({})
    const [isVariationMode, setIsVariationMode] = useState(false)
    const [currentSceneLock, setCurrentSceneLock] = useState<SceneLock | null>(null)
    const [detectedSceneType, setDetectedSceneType] = useState<string | null>(null)
    const [isAdvancedMode, setIsAdvancedMode] = useState(false)
    const [lastResultIsAdvanced, setLastResultIsAdvanced] = useState(false)
    const [smartMode, setSmartMode] = useState(true)
    const [selectedMode, setSelectedMode] = useState<'portrait' | 'medium' | 'wide'>('portrait')

    useEffect(() => {
        const uniqStatus = (user as any)?.uniq;
        if (uniqStatus?.twin_status === 'ready') {
            setStep('steady');
        } else if (uniqStatus?.twin_status === 'training') {
            setStep('training');
        } else if (uniqStatus?.twin_path === 'photos') {
            setStep('photo');
        } else if (uniqStatus?.twin_path === 'imaginary') {
            setStep('prompt');
        } else {
            setStep('selection');
        }
    }, [user?.uid, (user as any)?.uniq?.twin_status])

    // 🚀 Uniq V4: Deep Linking for Variations from Container
    useEffect(() => {
        const variationImage = searchParams.get('variationImage')
        const variationPrompt = searchParams.get('variationPrompt')
        const origin = searchParams.get('origin')

        if (variationImage && user?.savedCharacter) {
            setLastResult(variationImage)
            setPreviewUrl(variationImage)
            if (variationPrompt) {
                setGenPrompt(variationPrompt)
                setMasterEnhancedPrompt(variationPrompt)
            }
            setIsVariationMode(true)
            setShowVariationPresets(true)
            setStep('steady')
            
            // Clean up URL so refresh doesn't trigger it again
            if (origin === 'container') {
                router.replace(`/${locale}/creator/muse`)
            }
        }
    }, [searchParams, user?.savedCharacter, locale, router])

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onloadend = () => {
            const newImages = [...refImages]
            newImages[index] = reader.result as string
            setRefImages(newImages)
        }
        reader.readAsDataURL(file)
    }

    const handleSatisfactionScore = async (score: number) => {
        if (!logId || !user?.uid) return;
        setSatisfactionScore(score);
        try {
            const uniq = new Uniq(user.uid);
            await uniq.init();
            await uniq.logInteraction({
                id: logId,
                satisfactionScore: score
            });
            toast({ title: tCommon('feedbackReceived'), description: tCommon('feedbackReceivedDesc') });
        } catch (e) {
            console.error("Score update failed:", e);
        }
    };

    const handleStartNeuralTraining = async (method: 'photo' | 'prompt') => {
        if (!user?.uid) return
        setLoading(true)
        try {
            // No extra ULC cost required here; they already paid 500/700 ULC on the landing page.
            
            if (method === 'prompt') {
                if (!promptDraft || promptDraft.length < 10) throw new Error(t("provideDescription"));

                const transRes = await fetch('/api/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: promptDraft })
                })
                const transData = await transRes.json()
                const englishPrompt = transData.translation || promptDraft

                // Call neural training API directly
                const res = await fetch('/api/ai/neural-training', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.uid, type: 'imaginary', prompt: englishPrompt })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || t("failedStartNeural"));
                }

                toast({ title: t("neuralLearningStarted"), description: t("imaginaryStartedDesc") });
                setStep('training');
                
            } else {
                // Photo Method - Needs 15 uploads
                const validImages = refImages.filter(img => img !== null);
                if (validImages.length < 15) {
                    throw new Error(t("upload15"));
                }

                toast({ title: t("uploadingPhotos"), description: t("uploadingPhotosDesc") });
                
                const uploadedUrls: string[] = []
                for (let i = 0; i < validImages.length; i++) {
                    const img = validImages[i]
                    if (img) {
                        const storageRef = ref(storage, `twin-datasets/${user.uid}/${Date.now()}-${i}.png`)
                        await uploadString(storageRef, img.split(',')[1], 'base64', { contentType: 'image/png' })
                        const url = await getDownloadURL(storageRef)
                        uploadedUrls.push(url)
                    }
                }

                toast({ title: t("initiatingTraining"), description: t("initiatingTrainingDesc") });

                // Call neural training API
                const res = await fetch('/api/ai/neural-training', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.uid, type: 'photos', imageUrls: uploadedUrls })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || t("failedLoRA"));
                }

                toast({ title: t("neuralLearningStarted"), description: t("trainingStartedDesc") });
                setStep('training');
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: tCommon("errorTitle"), description: err.message })
        } finally {
            setLoading(false)
        }
    }

    const handleCommitCharacter = async () => {
        if (!user?.uid || !previewAvatar) return
        setLoading(true)
        try {
            const character: CharacterProfile = {
                id: 'main',
                name: charName || "AI Muse",
                gender: extractedAttributes?.gender || 'female',
                hairColor: extractedAttributes?.hairColor || 'unknown',
                eyeColor: extractedAttributes?.eyeColor || 'unknown',
                faceStyle: extractedAttributes?.faceStyle || 'natural',
                bodyStyle: extractedAttributes?.bodyStyle || 'natural',
                height: extractedAttributes?.height || 'average',
                vibe: extractedAttributes?.vibe || 'natural',
                characterPromptBase: promptDraft,
                referenceImageUrl: previewAvatar,
                referenceImageUrls: [], // Purged from Storage - No longer needed in DB
                identitySeed: Math.floor(Math.random() * 1000000000), // DIGITAL TWIN 3.0: SEED LOCK
                createdAt: Date.now()
            }

            const userRef = doc(db, 'users', user.uid)
            await updateDoc(userRef, { savedCharacter: character })

            // STORAGE CLEANUP: Delete raw reference photos from Storage once locked
            if (uploadedRefUrls.length > 0) {
                console.log("Purging reference photos from Storage...");
                const deletePromises = uploadedRefUrls.map(url => {
                    const fileRef = ref(storage, url);
                    return deleteObject(fileRef).catch(err => {
                        console.warn("Storage deletion failed for URL:", url, err);
                    });
                });
                await Promise.all(deletePromises);
                setUploadedRefUrls([]); // Clear local state
            }

            toast({ title: t("fixSuccess"), description: t("fixSuccessDesc") })
            setStep('steady')
        } catch (err: any) {
            toast({ variant: 'destructive', title: tCommon("errorTitle"), description: tCommon("saveFailed") })
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateConsistent = async (isRegen: boolean = false) => {
        if (!user?.uid || !genPrompt.trim()) return
        setGenerating(true)
        try {
            // 🗑️ Cleanup previous unsaved result before generating new one
            if (lastResult) {
                try {
                    const oldRef = ref(storage, lastResult);
                    await deleteObject(oldRef);
                } catch (e) {
                    console.warn("Failed to delete previous AI preview:", e);
                }
            }

            const uniq = new Uniq(user.uid)
            await uniq.init()

            const { enhancedPrompt, translation, sceneLock: dna } = await uniq.generateImagePrompt({
                userInput: genPrompt,
                style: 'cinematic',
                character: user.savedCharacter || undefined,
                outfit: undefined // Can be improved if we add an outfit input to Muse
            })

            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: genPrompt,
                    enhancedPrompt: enhancedPrompt,
                    translation: translation,
                    userId: user.uid,
                    character: user.savedCharacter,
                    mode: selectedMode, // 🎯 EXPLICIT MODE (Phase 24)
                    cost: isRegen ? 5 : 10,
                    isStateful: smartMode // 🧬 UNIQ 4.0: TRIGGER STATEFUL ENGINE
                })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || tCommon("generationError"))
            }

            const data = await response.json()
            
            // 🛡️ SCENE CONSISTENCY ENGINE: Detect and Lock Scene
            const sceneType = SceneRuleEngine.detectSceneType(data.finalAuditPrompt || enhancedPrompt);
            const lock = SceneRuleEngine.generateSceneLock(data.finalAuditPrompt || enhancedPrompt, sceneType, dna);
            setCurrentSceneLock(lock);
            setDetectedSceneType(sceneType);
            setLastResultIsAdvanced(false); // Initial generation is standard
            setLastResult(data.mediaUrl)
            setPreviewUrl(data.mediaBase64 || data.mediaUrl)
            setLogId(data.logId)
            setLastSeed(data.seed)
            setLastEnhancedPrompt(data.finalAuditPrompt)
            setMasterEnhancedPrompt(data.finalAuditPrompt)
            setSatisfactionScore(null)
            toast({ title: tCommon("publishSuccess"), description: tCommon("savedToContainerDesc") })
        } catch (err: any) {
            toast({ variant: 'destructive', title: tCommon("generationError"), description: err.message })
        } finally {
            setGenerating(false)
            setIsVariationMode(false)
        }
    }

    const handleGenerateVariation = async () => {
        if (!user?.uid || !lastResult || !genPrompt) return
        setGeneratingVariation(true)
        setShowVariationPresets(false)
        try {
            const uniq = new Uniq(user.uid)
            await uniq.init()

            // 🗑️ Cleanup previous unsaved result (the one we just saved to pool, so it's fine to delete the storage preview)
            // But wait, it's safer to just set lastResult to null later.
            
            // 1. Generate transformed prompt
            // 🎬 DIRECTOR MODE: Call the new granular prompt generator
            const { enhancedPrompt } = await uniq.generateDirectorPrompt({
                originalPrompt: masterEnhancedPrompt!,
                presets: selectedPresets,
                character: user.savedCharacter!,
                sceneLock: currentSceneLock || undefined
            })

            // 2. Generate new image with 5 ULC cost
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: genPrompt,
                    translation: enhancedPrompt,
                    originalEnhancedPrompt: masterEnhancedPrompt,
                    image: lastResult, // 🚀 CRITICAL FIX: Pass visual reference for consistency
                    seed: lastSeed, // 🧬 SEED LOCK: Ensure same noise pattern
                    userId: user.uid,
                    character: user.savedCharacter,
                    sceneLock: currentSceneLock,
                    sceneType: detectedSceneType,
                    isAdvanced: isAdvancedMode,
                    cost: 5, // Variations are 5 ULC
                    isStateful: smartMode // 🧬 UNIQ 4.0: TRIGGER STATEFUL ENGINE
                })
            })

            if (!response.ok) throw new Error(tCommon("generationError"))
            const data = await response.json()
            
            setLastResult(data.mediaUrl)
            setPreviewUrl(data.mediaBase64 || data.mediaUrl)
            setLastResultIsAdvanced(isAdvancedMode)
            setLogId(data.logId)
            setLastSeed(data.seed)
            setLastEnhancedPrompt(data.finalAuditPrompt)
            setSatisfactionScore(null)
            setIsVariationMode(true)
            toast({ title: t("variationOptions"), description: tCommon("publishSuccess") })
        } catch (err: any) {
            toast({ variant: 'destructive', title: tCommon("generationError"), description: err.message })
        } finally {
            setGeneratingVariation(false)
        }
    }

    const handleSaveToContainer = async (skipRedirect: boolean = false) => {
        if (!user?.uid || !lastResult) return
        setSaving(true)
        try {
            const response = await fetch('/api/ai/save-to-container', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    mediaUrl: lastResult,
                    mediaType: 'image',
                    category: 'ai_muse',
                    isAdvanced: lastResultIsAdvanced
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Save failed");
            }
            
            toast({ title: tCommon("savedToContainer"), description: tCommon("savedToContainerDesc") })
            if (!skipRedirect) {
                router.push('/creator')
            }
            return true
        } catch (err: any) {
            toast({ variant: 'destructive', title: tCommon("saveFailed"), description: err.message })
            return false
        } finally {
            setSaving(false)
        }
    }

    const handleSaveAndVariations = async () => {
        const success = await handleSaveToContainer(true)
        if (success) {
            setShowVariationPresets(true)
        }
    }

    const handleRegenerate = () => handleGenerateConsistent(true)

    const handleResetCharacter = async () => {
        if (!confirm(t("resetConfirm"))) return
        if (!user?.uid) return
        try {
            const userRef = doc(db, 'users', user.uid)
            await updateDoc(userRef, { savedCharacter: null })
            setStep('selection')
            setRefImages([null, null, null])
            setCharName('')
            setPromptDraft('')
            setPreviewAvatar(null)
            setExtractedAttributes(null)
            setLastEnhancedPrompt(null)

            // Cleanup any pending storage refs
            if (previewAvatar && previewAvatar !== user?.savedCharacter?.referenceImageUrl) {
                await deleteObject(ref(storage, previewAvatar)).catch(() => {});
            }
            if (lastResult) {
                await deleteObject(ref(storage, lastResult)).catch(() => {});
            }
            if (uploadedRefUrls.length > 0) {
                const deletePromises = uploadedRefUrls.map(url => deleteObject(ref(storage, url)).catch(() => {}));
                await Promise.all(deletePromises);
                setUploadedRefUrls([]);
            }
        } catch (e) {
            toast({ variant: 'destructive', title: tCommon("errorTitle"), description: tCommon("updateFailed") })
        }
    }

    const handleUnlockPro = async () => {
        if (!user?.uid) return
        
        const isPremium = user.aiCreatorModeExpiresAt && user.aiCreatorModeExpiresAt > Date.now();
        const cost = isPremium ? 0 : 2;

        if (!isPremium && (user.ulcBalance?.available || 0) < cost) {
            toast({ variant: 'destructive', title: tCommon("insufficientULC"), description: `Uniq Pro kilit açımı için ${cost} ULC gereklidir.` })
            return
        }
        
        setLoading(true)
        try {
            const response = await fetch('/api/ai/unlock-pro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid })
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Unlock failed");

            toast({ title: "Uniq Pro Unlocked!", description: "You now have access to Advanced AI features." })
            setIsAdvancedMode(true)
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Unlock Failed", description: err.message })
        } finally {
            setLoading(false)
        }
    }

    // 🔒 Digital Twin Gate — redirect to /uniq if not unlocked
    const uniqStatus = (user as any)?.uniq;
    if (user && !uniqStatus?.unlocked) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-headline font-black italic uppercase tracking-tighter">{t('digitalTwinRequired')}</h2>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        {t('digitalTwinRequiredDesc')}
                    </p>
                </div>
                <button
                    onClick={() => router.push(`/${locale}/uniq`)}
                    className="px-8 py-3 rounded-2xl bg-primary text-black font-black uppercase tracking-widest text-sm hover:opacity-90 transition-opacity"
                >
                    {t('goToUniq')}
                </button>
            </div>
        );
    }

    if (step === 'selection') {

        return (
            <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in">
                <header className="flex items-center gap-4 border-b pb-10 border-white/10">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator/container')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-4xl font-headline font-bold">{t("onboardingTitle")}</h1>
                        <p className="text-muted-foreground text-sm font-medium">{t("onboardingSubtitle")}</p>
                    </div>
                </header>

                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex gap-4">
                    <Info className="text-primary shrink-0 mt-1" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("onboardingDesc")}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="glass-card border-white/10 hover:border-primary/40 transition-all cursor-pointer group bg-white/[0.02]" onClick={() => setStep('photo')}>
                        <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Camera className="text-primary w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">{t("createWithPhoto")}</h3>
                                <p className="text-sm text-muted-foreground">{t("createWithPhotoDesc")}</p>
                                <Badge className="bg-primary/20 text-primary border-primary/30 mt-2">20 ULC</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-white/10 hover:border-fuchsia-500/40 transition-all cursor-pointer group bg-white/[0.02]" onClick={() => setStep('prompt')}>
                        <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Wand2 className="text-fuchsia-400 w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">{t("aiCreate")}</h3>
                                <p className="text-sm text-muted-foreground">{t("aiCreateDesc")}</p>
                                <Badge className="bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30 mt-2">10 ULC</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    if (step === 'photo' || step === 'prompt') {
        return (
            <div className="max-w-2xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in slide-in-from-right-4">
                 <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setStep('selection')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-headline font-bold">{step === 'photo' ? t("createWithPhoto") : t("aiCreate")}</h1>
                </header>

                <Card className="glass-card border-white/10 p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("characterName")}</Label>
                            <Input placeholder={t("charNamePlaceholder")} value={charName} onChange={e => setCharName(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl" />
                        </div>

                        <div className="space-y-4">
                            {step === 'photo' ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('trainingDataset')}</Label>
                                        <Badge className="bg-primary/20 text-primary">{refImages.filter(i => i !== null).length} / 15</Badge>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                        {Array.from({ length: 15 }).map((_, i) => (
                                            <div key={i} className="space-y-2">
                                                <div 
                                                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-all overflow-hidden relative group"
                                                    onClick={() => document.getElementById(`upload-${i}`)?.click()}
                                                >
                                                    {refImages[i] ? (
                                                        <>
                                                            <img src={refImages[i]!} className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <Upload className="w-5 h-5 text-white" />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <Camera className="w-5 h-5 text-muted-foreground mb-1" />
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{t('slot')} {i + 1}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <input id={`upload-${i}`} type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoUpload(e, i)} />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] items-center text-muted-foreground bg-white/5 p-4 rounded-xl border border-white/10 leading-relaxed block text-center">
                                        {t('trainingDatasetDesc')}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("description")}</Label>
                                    <Textarea 
                                        placeholder={t("descriptionPlaceholder")} 
                                        className="bg-black/20 border-white/10 min-h-[120px] rounded-2xl resize-none"
                                        value={promptDraft}
                                        onChange={e => setPromptDraft(e.target.value)}
                                    />
                                </div>
                            )}
                            
                            <Button 
                                className="w-full h-14 rounded-2xl font-bold text-lg gap-2 mt-4 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-black uppercase tracking-widest" 
                                disabled={loading || (step === 'photo' && refImages.filter(img => img !== null).length < 15) || (step === 'prompt' && !promptDraft)}
                                onClick={() => handleStartNeuralTraining(step as 'photo' | 'prompt')}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                                {t('startNeuralLearning')}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        )
    }

    if (step === 'training') {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
                <div className="w-20 h-20 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-headline font-black italic uppercase tracking-tighter">{t('neuralLearningActive')}</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">{t('neuralLearningActiveDesc')}</p>
                </div>
                <button
                    onClick={() => router.push(`/${locale}/uniq`)}
                    className="mt-4 px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-colors"
                >{t('viewProgressInDashboard')}</button>
            </div>
        );
    }

    // STEADY STATE
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in">
             <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-10 border-white/10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator/container')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-4xl font-headline font-bold flex items-center gap-3">
                            Uniq Muse <Badge className="bg-primary text-white">{t("fixedBadge")}</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium">{t("characterFixed")}</p>
                    </div>
                </div>

                <Button variant="outline" size="sm" className="rounded-xl font-bold border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={handleResetCharacter}>
                    <RefreshCcw className="w-4 h-4 mr-2" /> {t("resetCharacter")}
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                    <Card className="glass-card border-primary/20 bg-primary/5 overflow-hidden">
                        <div className="aspect-square relative flex items-center justify-center bg-black/40">
                            {user?.savedCharacter?.referenceImageUrl ? (
                                <img src={user.savedCharacter.referenceImageUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center space-y-2 opacity-50">
                                    <User size={40} className="mx-auto" />
                                    <p className="text-[10px] font-bold uppercase">MASTER AVATAR</p>
                                </div>
                            )}
                            <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg uppercase">
                                {t("digitalTwinActive")}
                            </div>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <h3 className="text-xl font-bold">{user?.savedCharacter?.name || "---"}</h3>
                                <p className="text-xs text-muted-foreground">{t("mainRef")}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">{t("eyes")}</p>
                                    <p className="text-xs font-bold">{user?.savedCharacter?.eyeColor || t("unknown")}</p>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">{t("hair")}</p>
                                    <p className="text-xs font-bold">{user?.savedCharacter?.hairColor || t("unknown")}</p>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">{t("body")}</p>
                                    <p className="text-xs font-bold capitalize">{user?.savedCharacter?.bodyStyle || t("natural")}</p>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">{t("height")}</p>
                                    <p className="text-xs font-bold capitalize">{user?.savedCharacter?.height || t("natural")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/20 border-white/10 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Lock className="text-primary w-5 h-5" />
                                <h4 className="font-bold">{t("uniqIntegration")}</h4>
                            </div>
                            {user?.savedCharacter?.referenceImageUrl && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 rounded-xl text-[10px] font-bold border-primary/20 hover:bg-primary/10 gap-2"
                                    onClick={async () => {
                                        if (!user?.uid || !user?.savedCharacter?.referenceImageUrl) return;
                                        setSaving(true);
                                        try {
                                            await updateDoc(doc(db, 'users', user.uid), {
                                                avatar: user.savedCharacter.referenceImageUrl
                                            });
                                            toast({ title: t("profilePhotoSuccess"), description: tCommon("updateSuccess") });
                                        } catch (e) {
                                            toast({ variant: 'destructive', title: t("errorTitle"), description: tCommon("updateFailed") });
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                    disabled={saving}
                                >
                                    <User size={12} /> {t("setProfilePhoto")}
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t("uniqIntegrationDesc")}
                        </p>
                    </Card>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2 italic"><Sparkles className="text-primary" /> {t("consistentProd")}</span>
                                <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20">10 ULC</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* 🎯 SHOT TYPE SELECTOR (Phase 24) */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    {getModeLabel("title", "Shot Type")}
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'portrait', icon: User, label: getModeLabel("portrait", "Portrait") },
                                        { id: 'medium', icon: Maximize, label: getModeLabel("medium", "Medium Shot") },
                                        { id: 'wide', icon: Camera, label: getModeLabel("wide", "Wide Shot") }
                                    ].map((m) => (
                                        <Button
                                            key={m.id}
                                            variant={selectedMode === m.id ? 'default' : 'outline'}
                                            className={cn(
                                                "h-20 rounded-2xl flex flex-col gap-2 transition-all",
                                                selectedMode === m.id ? "bg-primary border-primary shadow-lg shadow-primary/20" : "bg-white/5 border-white/5 hover:bg-white/10"
                                            )}
                                            onClick={() => setSelectedMode(m.id as any)}
                                        >
                                            <m.icon className={cn("w-5 h-5", selectedMode === m.id ? "text-white" : "text-muted-foreground")} />
                                            <span className="text-[10px] font-bold uppercase">{m.label}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("actionPrompt")}</Label>
                                <Textarea 
                                    className="min-h-[150px] bg-black/40 border-white/10 rounded-3xl resize-none p-6 text-lg"
                                    placeholder={t("actionPromptPlaceholder")}
                                    value={genPrompt}
                                    onChange={e => setGenPrompt(e.target.value)}
                                />
                                <div className="flex items-center gap-2 bg-primary/5 p-3 rounded-2xl border border-primary/20">
                                    <Check className="text-primary w-4 h-4" />
                                    <p className="text-[10px] text-muted-foreground">{t("actionDesc")}</p>
                                </div>
                            </div>

                            {/* 🧬 Smart Mode Toggle UI */}
                            <div className={cn(
                                "flex items-center justify-between p-4 rounded-3xl border transition-all duration-500",
                                smartMode ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/5 opacity-50"
                            )}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                                        <Sparkles size={18} className="text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-primary">Uniq: Smart Mode</h4>
                                        <p className="text-[10px] text-muted-foreground">
                                            {smartMode ? "Görseliniz Critic & Retry motoruyla iyileştirilecek ✨" : "Hızlı mod: Zeka katmanı devre dışı."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Aktif</Label>
                                    <Switch checked={smartMode} onCheckedChange={setSmartMode} />
                                </div>
                            </div>

                            <Button 
                                className="w-full h-16 rounded-3xl font-bold text-xl gap-3 shadow-xl shadow-primary/20" 
                                disabled={generating || !genPrompt.trim()}
                                onClick={() => handleGenerateConsistent()}
                            >
                                {generating ? <Loader2 className="animate-spin w-6 h-6" /> : <Wand2 className="w-6 h-6" />}
                                {t("generateAction")} (10 ULC)
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4">
                        {lastResult ? (
                            <Card className="glass-card border-primary/20 bg-black/40 overflow-hidden group relative">
                                <div className="aspect-square w-full flex items-center justify-center">
                                    <img src={previewUrl || lastResult} className="w-full h-full object-contain" alt="Generated" />
                                </div>
                                    <div className="p-6 space-y-4 bg-black/60 backdrop-blur-md">
                                        {/* Satisfaction Rating */}
                                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase text-center tracking-widest">{tCommon('satisfaction')}</p>
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

                                        <div className="flex flex-col gap-3">
                                            <div className="flex gap-4">
                                                <Button className="flex-1 h-12 rounded-xl font-bold gap-2" variant="default" onClick={() => handleSaveToContainer()} disabled={saving}>
                                                    {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={18} />}
                                                    {t("saveToPool")}
                                                </Button>
                                                <Button className="flex-1 h-12 rounded-xl font-bold gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white" onClick={handleSaveAndVariations} disabled={saving || generatingVariation}>
                                                    {generatingVariation ? <Loader2 className="animate-spin w-4 h-4" /> : <Layers size={18} />}
                                                    {t("saveAndVariations")} (5 ULC)
                                                </Button>
                                            </div>
                                            <Button className="w-full h-12 rounded-xl font-bold gap-2" variant="outline" onClick={handleRegenerate} disabled={generating}>
                                                <RefreshCcw size={18} /> {t("regenAction")} (5 ULC)
                                            </Button>
                                        </div>
                                    </div>
                            </Card>
                        ) : (
                            <Card className="glass-card border-dashed border-white/10 bg-white/[0.02] h-60 flex items-center justify-center text-muted-foreground text-sm italic">
                                {t("noProdYet")}
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* DIRECTOR MODE DIALOG */}
            <Dialog open={showVariationPresets} onOpenChange={setShowVariationPresets}>
                <DialogContent className="glass-card border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-3xl font-headline font-bold flex items-center gap-3">
                            <Video className="text-primary w-8 h-8" /> DIRECTOR MODE 🎬
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            {t("directorModeDesc")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                        {/* 1. COMPOSITION */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                                    <Maximize className="w-4 h-4 text-primary" />
                                </div>
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("composition")}</Label>
                                {currentSceneLock?.riskyVariationTypes.includes('composition') && (
                                    <Badge variant="outline" className="text-[8px] h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 py-0 uppercase">Risky</Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {['wide', 'medium', 'full_body', 'close_up', 'extreme_close'].map(key => (
                                    <Button
                                        key={key}
                                        variant={selectedPresets.composition === key ? 'default' : 'outline'}
                                        className={cn("h-11 rounded-xl justify-start px-4 font-medium transition-all", selectedPresets.composition === key ? "bg-primary border-primary" : "hover:bg-primary/5")}
                                        onClick={() => setSelectedPresets(prev => ({ ...prev, composition: prev.composition === key ? undefined : key }))}
                                    >
                                        <div className={cn("w-2 h-2 rounded-full mr-3", selectedPresets.composition === key ? "bg-white" : "bg-white/20")} />
                                        {t(`dir_${key}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* 2. VIEW ANGLE */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                                    <Camera className="w-4 h-4 text-fuchsia-400" />
                                </div>
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("viewAngle")}</Label>
                                {currentSceneLock?.riskyVariationTypes.includes('angle') && (
                                    <Badge variant="outline" className="text-[8px] h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 py-0 uppercase">Risky</Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {['front', 'profile', 'over_shoulder', 'back', 'low_angle', 'high_angle'].map(key => (
                                    <Button
                                        key={key}
                                        variant={selectedPresets.angle === key ? 'default' : 'outline'}
                                        className={cn("h-11 rounded-xl justify-start px-4 font-medium transition-all", selectedPresets.angle === key ? "bg-fuchsia-600 border-fuchsia-600" : "hover:bg-fuchsia-500/5")}
                                        onClick={() => setSelectedPresets(prev => ({ ...prev, angle: prev.angle === key ? undefined : key }))}
                                    >
                                        <div className={cn("w-2 h-2 rounded-full mr-3", selectedPresets.angle === key ? "bg-white" : "bg-fuchsia-400/20")} />
                                        {t(`dir_${key}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* 3. MOOD / EMOTION */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                    <Heart className="w-4 h-4 text-amber-400" />
                                </div>
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("moodEmotion")}</Label>
                                {currentSceneLock?.riskyVariationTypes.includes('mood') && (
                                    <Badge variant="outline" className="text-[8px] h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 py-0 uppercase">Risky</Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {['confident', 'mysterious', 'seductive', 'relaxed', 'playful', 'cold'].map(key => (
                                    <Button
                                        key={key}
                                        variant={selectedPresets.mood === key ? 'default' : 'outline'}
                                        className={cn("h-11 rounded-xl justify-start px-4 font-medium transition-all", selectedPresets.mood === key ? "bg-amber-600 border-amber-600" : "hover:bg-amber-500/5")}
                                        onClick={() => setSelectedPresets(prev => ({ ...prev, mood: prev.mood === key ? undefined : key }))}
                                    >
                                        <div className={cn("w-2 h-2 rounded-full mr-3", selectedPresets.mood === key ? "bg-white" : "bg-amber-400/20")} />
                                        {t(`dir_${key}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* 4. ACTION / MOMENT */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-emerald-400" />
                                </div>
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("actionMoment")}</Label>
                                {currentSceneLock?.riskyVariationTypes.includes('action') && (
                                    <Badge variant="outline" className="text-[8px] h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 py-0 uppercase">Risky</Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {['still', 'walking', 'sitting', 'turning', 'looking_away', 'interaction'].map(key => (
                                    <Button
                                        key={key}
                                        variant={selectedPresets.action === key ? 'default' : 'outline'}
                                        className={cn("h-11 rounded-xl justify-start px-4 font-medium transition-all", selectedPresets.action === key ? "bg-emerald-600 border-emerald-600" : "hover:bg-emerald-500/5")}
                                        onClick={() => setSelectedPresets(prev => ({ ...prev, action: prev.action === key ? undefined : key }))}
                                    >
                                        <div className={cn("w-2 h-2 rounded-full mr-3", selectedPresets.action === key ? "bg-white" : "bg-emerald-400/20")} />
                                        {t(`dir_${key}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* 5. LIGHTING STYLE */}
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Sun className="w-4 h-4 text-blue-400" />
                                </div>
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("lightingStyle")}</Label>
                                {currentSceneLock?.riskyVariationTypes.includes('lighting') && (
                                    <Badge variant="outline" className="text-[8px] h-4 border-amber-500/50 text-amber-500 bg-amber-500/10 py-0 uppercase">Risky</Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                {['golden_hour', 'soft_studio', 'dramatic', 'neon', 'daylight'].map(key => (
                                    <Button
                                        key={key}
                                        variant={selectedPresets.lighting === key ? 'default' : 'outline'}
                                        className={cn("h-11 rounded-xl flex-col items-center justify-center gap-0 font-medium transition-all text-[10px]", selectedPresets.lighting === key ? "bg-blue-600 border-blue-600" : "hover:bg-blue-500/5")}
                                        onClick={() => setSelectedPresets(prev => ({ ...prev, lighting: prev.lighting === key ? undefined : key }))}
                                    >
                                        {t(`dir_${key}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* 🌟 UNIQ PRO / ADVANCED MODE (YELLOW TRIGGER) */}
                        <div className="md:col-span-2 mt-4 space-y-4 border-t border-white/10 pt-6">
                            <div className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
                                        isAdvancedMode ? "bg-yellow-500 shadow-lg shadow-yellow-500/40 rotate-12" : "bg-yellow-500/20"
                                    )}>
                                        <Star className={cn("w-5 h-5", isAdvancedMode ? "text-black fill-current" : "text-yellow-500")} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h4 className="text-sm font-bold text-yellow-500 uppercase tracking-widest leading-none mb-1">Uniq Pro Engine</h4>
                                        <p className="text-[10px] text-muted-foreground">{t("unlockProDesc")}</p>
                                    </div>
                                </div>
                                <Button 
                                    variant={isAdvancedMode ? 'default' : 'outline'}
                                    className={cn(
                                        "h-10 rounded-xl px-4 font-bold transition-all",
                                        isAdvancedMode ? "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-500" : "border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
                                    )}
                                    onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                                    disabled={loading}
                                >
                                    {isAdvancedMode ? t("proActive") : t("unlockPro")}
                                </Button>
                            </div>

                            {isAdvancedMode && (
                                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                    {/* CLOTHING FLEXIBILITY - 14 ADVANCED OPTIONS */}
                                    <div className="space-y-4 p-5 bg-black/40 border border-yellow-500/10 rounded-2xl shadow-inner shadow-yellow-500/5">
                                        <Label className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-yellow-500/70 flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5" /> {t("clothingFlex")}
                                        </Label>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                            {[
                                                'sheerLingerie', 'satinSilks', 'wetShirt', 'provocativeLace', 'highLegBodysuit',
                                                'strategicCoverage', 'sultryBoudoir', 'exoticBeachwear', 'distressedDenim', 'leatherLace',
                                                'deepPlunge', 'ultraHighCut', 'openFront', 'monokiniExotic'
                                            ].map(key => (
                                                <Button
                                                    key={key}
                                                    variant={selectedPresets.action === key ? 'default' : 'outline'}
                                                    size="sm"
                                                    className={cn(
                                                        "h-10 rounded-xl text-[9px] font-bold uppercase transition-all duration-300", 
                                                        selectedPresets.action === key 
                                                            ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 border-yellow-500" 
                                                            : "hover:bg-yellow-500/10 border-white/10 text-muted-foreground hover:text-yellow-500"
                                                    )}
                                                    onClick={() => setSelectedPresets(prev => ({ ...prev, action: prev.action === key ? undefined : key }))}
                                                >
                                                    {t(key)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ADVANCED POSES - 8 OPTIONS */}
                                    <div className="space-y-4 p-5 bg-black/40 border border-yellow-500/10 rounded-2xl shadow-inner shadow-yellow-500/5">
                                        <Label className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-yellow-500/70 flex items-center gap-2">
                                            <Camera className="w-3.5 h-3.5" /> {t("eroticPoses")}
                                        </Label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {[
                                                'backReveal', 'strategicCover', 'silkProne', 'sultryArch',
                                                'kneelingSeduction', 'sideRecumbent', 'leaningSilhouette', 'recliningPose'
                                            ].map(key => (
                                                <Button
                                                    key={key}
                                                    variant={selectedPresets.mood === key ? 'default' : 'outline'}
                                                    size="sm"
                                                    className={cn(
                                                        "h-10 rounded-xl text-[9px] font-bold uppercase transition-all duration-300", 
                                                        selectedPresets.mood === key 
                                                            ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20 border-yellow-500" 
                                                            : "hover:bg-yellow-500/10 border-white/10 text-muted-foreground hover:text-yellow-500"
                                                    )}
                                                    onClick={() => setSelectedPresets(prev => ({ ...prev, mood: prev.mood === key ? undefined : key }))}
                                                >
                                                    {t(key)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="bg-white/5 -mx-6 -mb-6 p-6 mt-4 border-t border-white/10">
                        <Button
                            className="w-full h-16 rounded-3xl font-bold bg-primary text-white text-xl gap-3 shadow-2xl shadow-primary/40 relative overflow-hidden group"
                            onClick={handleGenerateVariation}
                            disabled={generatingVariation || Object.values(selectedPresets).every(v => v === undefined)}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                    {generatingVariation ? <Loader2 className="animate-spin w-6 h-6" /> : <Wand2 className="w-6 h-6" />}
                                    <span className="relative">{t("generateAction")} (5 ULC)</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
