"use client"

import { useState, useEffect } from 'react'
import { useWallet } from '@/hooks/use-wallet'
import { db } from '@/lib/firebase'
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, User, Camera, Wand2, ChevronLeft, Lock, RefreshCcw, Loader2, Save, Info, AlertCircle, Check, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Image from 'next/image'
import { CharacterProfile } from '@/lib/types'
import { processAiGenerationPayment } from '@/lib/ledger'

export default function AIMusePage() {
    const router = useRouter()
    const { user } = useWallet()
    const { toast } = useToast()
    
    const [step, setStep] = useState<'selection' | 'photo' | 'prompt' | 'steady'>('selection')
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    
    // Character Creation State
    const [charName, setCharName] = useState('')
    const [refImage, setRefImage] = useState<string | null>(null)
    const [promptDraft, setPromptDraft] = useState('')
    const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
    const [extractedAttributes, setExtractedAttributes] = useState<any>(null)
    
    // Steady State (Generation)
    const [genPrompt, setGenPrompt] = useState('')
    const [lastResult, setLastResult] = useState<string | null>(null)

    useEffect(() => {
        if (user?.savedCharacter) {
            setStep('steady')
        } else {
            setStep('selection')
        }
    }, [user?.savedCharacter])

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onloadend = () => setRefImage(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleCreateCharacter = async (method: 'photo' | 'prompt') => {
        if (!user?.uid) return
        setLoading(true)
        try {
            const isRegen = !!previewAvatar
            const cost = method === 'photo' ? 20 : (isRegen ? 7 : 10)
            
            if ((user.ulcBalance?.available || 0) < cost) {
                throw new Error("Yetersiz ULC bakiyesi.")
            }

            // 1. Get English Prompt & Attributes (if prompt method)
            let englishPrompt = promptDraft
            let attributes = null

            if (method === 'prompt') {
                // Translation & Attribute extraction in in in parallel
                const [transRes, parseRes] = await Promise.all([
                    fetch('/api/ai/translate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: promptDraft })
                    }),
                    fetch('/api/ai/parse-character', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: promptDraft })
                    })
                ])
                
                const transData = await transRes.json()
                englishPrompt = transData.translation || promptDraft
                attributes = await parseRes.json()
            }

            // 2. Generate Initial Master Avatar
            const genResponse = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: englishPrompt,
                    userId: user.uid,
                    cost: cost,
                    isMasterPreview: true // Flag for for for internal logic if if if if if needed
                })
            })

            if (!genResponse.ok) throw new Error("Görsel üretimi başarısız.")
            
            const genData = await genResponse.json()
            setPreviewAvatar(genData.mediaUrl)
            if (attributes) setExtractedAttributes(attributes)
            
            toast({ title: "Karakter Hazır!", description: "Görüşünüzü inceleyip sabitleyebilirsiniz." })
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Hata", description: err.message })
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
                ageRange: extractedAttributes?.ageRange || '20-25',
                hairColor: extractedAttributes?.hairColor || 'blonde',
                eyeColor: extractedAttributes?.eyeColor || 'blue',
                faceStyle: extractedAttributes?.faceStyle || 'casual',
                bodyStyle: extractedAttributes?.bodyStyle || 'slim',
                height: extractedAttributes?.height || 'average',
                vibe: extractedAttributes?.vibe || 'friendly',
                characterPromptBase: promptDraft,
                referenceImageUrl: previewAvatar,
                createdAt: Date.now()
            }

            const userRef = doc(db, 'users', user.uid)
            await updateDoc(userRef, { savedCharacter: character })

            toast({ title: "Karakter Sabitlendi!", description: "Tebrikler! Artık bu avatar üzerinden üretim yapacaksınız." })
            setStep('steady')
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Hata", description: "Kayıt başarısız." })
        } finally {
            setLoading(false)
        }
    }
    const handleGenerateConsistent = async (isRegen: boolean = false) => {
        if (!user?.uid || !genPrompt.trim()) return
        setGenerating(true)
        try {
            // 1. Translation for Firewall Bypass
            const transResponse = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: genPrompt })
            })
            const transData = await transResponse.json()
            const englishPrompt = transData.translation || genPrompt

            // 2. Generation with English Translation
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: genPrompt,
                    translation: englishPrompt,
                    userId: user.uid,
                    character: user.savedCharacter,
                    cost: isRegen ? 3 : 5
                })
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || "Üretim başarısız.")
            }

            const data = await response.json()
            setLastResult(data.mediaUrl)
            toast({ title: "Görsel Hazır!", description: "Havuza kaydetmeyi unutmayın." })
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Üretim Hatası", description: err.message })
        } finally {
            setGenerating(false)
        }
    }

    const handleSaveToContainer = async () => {
        if (!user?.uid || !lastResult) return
        setSaving(true)
        try {
            await addDoc(collection(db, 'creator_media'), {
                creatorId: user.uid,
                mediaUrl: lastResult,
                mediaType: 'image',
                category: 'ai_muse',
                createdAt: Date.now(),
                status: 'draft'
            })
            toast({ title: "Havuza Kaydedildi!", description: "İçeriğiniz artık yönetilmeye hazır." })
            router.push('/creator/container')
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Kaydetme Hatası", description: err.message })
        } finally {
            setSaving(false)
        }
    }

    const handleRegenerate = () => {
        // Just trigger the same flow, will cost 3 ULC if we pass the right flag
        handleGenerateConsistent(true)
    }

    const handleResetCharacter = async () => {
        if (!confirm("Karakterinizi sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.")) return
        if (!user?.uid) return
        try {
            const userRef = doc(db, 'users', user.uid)
            await updateDoc(userRef, { savedCharacter: null })
            setStep('selection')
            setRefImage(null)
            setCharName('')
            setPromptDraft('')
        } catch (e) {
            toast({ variant: 'destructive', title: "Hata", description: "Sıfırlama başarısız." })
        }
    }

    // --- RENDER SELECTION ---
    if (step === 'selection') {
        return (
            <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in">
                <header className="flex items-center gap-4 border-b pb-10 border-white/10">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator/studio')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-4xl font-headline font-bold">AI Muse Onboarding</h1>
                        <p className="text-muted-foreground text-sm font-medium">İlk adım: AI Karakterinizi Oluşturun</p>
                    </div>
                </header>

                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex gap-4">
                    <Info className="text-primary shrink-0 mt-1" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Sistemde içerik üretmek için önce bir **AI Avatar** sabitlemeniz gerekir. 
                        Bu avatar sizin dijital ikiziniz veya markanızın yüzü olacak ve tüm üretimlerde tutarlılık sağlayacaktır.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="glass-card border-white/10 hover:border-primary/40 transition-all cursor-pointer group bg-white/[0.02]" onClick={() => setStep('photo')}>
                        <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Camera className="text-primary w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">Fotoğrafınla Oluştur</h3>
                                <p className="text-sm text-muted-foreground">Kendi fotoğrafını yükle, AI dijital ikizini yaratsın.</p>
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
                                <h3 className="text-xl font-bold">AI Senin İçin Oluştursun</h3>
                                <p className="text-sm text-muted-foreground">Hayalindeki karakteri tarif et, AI sıfırdan yaratsın.</p>
                                <Badge className="bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30 mt-2">10 ULC</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    // --- RENDER WIZARD (PHOTO OR PROMPT) ---
    if (step === 'photo' || step === 'prompt') {
        return (
            <div className="max-w-2xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in slide-in-from-right-4">
                 <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setStep('selection')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-headline font-bold">{step === 'photo' ? 'Dijital İkiz Oluştur' : 'Sıfırdan Karakter Yarat'}</h1>
                </header>

                <Card className="glass-card border-white/10 p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Karakter Adı</Label>
                            <Input placeholder="Örn: Milla AI" value={charName} onChange={e => setCharName(e.target.value)} className="bg-black/20 border-white/10 h-12 rounded-xl" />
                        </div>

                        {previewAvatar ? (
                             <div className="space-y-4 animate-in zoom-in-95 duration-500">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Önizleme</Label>
                                <div className="aspect-square rounded-3xl overflow-hidden glass-card border-primary/20 relative group">
                                    <img src={previewAvatar} className="w-full h-full object-cover" alt="Preview" />
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-4 text-center">
                                         <p className="text-[10px] font-bold text-primary mb-1 uppercase">
                                            {extractedAttributes?.hairColor} SAÇ • {extractedAttributes?.eyeColor} GÖZ
                                         </p>
                                         <p className="text-[9px] text-white font-medium mb-1">
                                            {extractedAttributes?.bodyStyle} • {extractedAttributes?.height}
                                         </p>
                                         <p className="text-[8px] text-white/60">AI TARAFINDAN ÖZELLİKLER ÇIKARILDI</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button 
                                        variant="outline" 
                                        className="h-12 rounded-2xl font-bold gap-2 border-primary/20 hover:bg-primary/5" 
                                        onClick={() => handleCreateCharacter(step)}
                                        disabled={loading}
                                    >
                                        <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} /> Yeniden ({step === 'photo' ? '20' : '7'} ULC)
                                    </Button>
                                    <Button 
                                        className="h-12 rounded-2xl font-bold gap-2 bg-primary text-white" 
                                        onClick={handleCommitCharacter}
                                        disabled={loading}
                                    >
                                        <Check className="w-4 h-4" /> Karakteri Sabitle
                                    </Button>
                                </div>
                             </div>
                        ) : (
                            <>
                                {step === 'photo' ? (
                                    <div className="space-y-4">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Referans Fotoğraf</Label>
                                        <div 
                                            className="aspect-square rounded-3xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden relative"
                                            onClick={() => document.getElementById('char-upload')?.click()}
                                        >
                                            {refImage ? (
                                                <img src={refImage} className="w-full h-full object-cover" />
                                            ) : (
                                                <>
                                                    <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                                                    <p className="text-xs text-muted-foreground">Net bir yüz fotoğrafı yükleyin</p>
                                                </>
                                            )}
                                        </div>
                                        <input id="char-upload" type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Karakter Tarifi</Label>
                                        <Textarea 
                                            placeholder="Saç rengi, göz rengi, genel tarz..." 
                                            className="bg-black/20 border-white/10 min-h-[120px] rounded-2xl resize-none"
                                            value={promptDraft}
                                            onChange={e => setPromptDraft(e.target.value)}
                                        />
                                    </div>
                                )}
                                
                                <Button 
                                    className="w-full h-14 rounded-2xl font-bold text-lg gap-2 mt-4" 
                                    disabled={loading || (step === 'photo' && !refImage) || (step === 'prompt' && !promptDraft) || !charName}
                                    onClick={() => handleCreateCharacter(step)}
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                    {step === 'photo' ? 'Karakteri Oluştur (20 ULC)' : 'Karakteri Oluştur (10 ULC)'}
                                </Button>
                            </>
                        )}
                    </div>
                </Card>
            </div>
        )
    }

    // --- RENDER STEADY STATE (CONSISTENT PRODUCTION) ---
    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in">
             <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-10 border-white/10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator/studio')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-4xl font-headline font-bold flex items-center gap-3">
                            AI Muse <Badge className="bg-primary text-white">FIXED</Badge>
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium">Karakteriniz Sabitlendi - Tutarlı Üretime Hazır</p>
                    </div>
                </div>

                <Button variant="outline" size="sm" className="rounded-xl font-bold border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={handleResetCharacter}>
                    <RefreshCcw className="w-4 h-4 mr-2" /> Karakteri Sıfırla
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Fixed Avatar Sidebar */}
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
                            <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                                AKTİF
                            </div>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <h3 className="text-xl font-bold">{user?.savedCharacter?.name || "Adsız Muse"}</h3>
                                <p className="text-xs text-muted-foreground">Bu karakter tüm üretimlerde ana referanstır.</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">Göz Rengi</p>
                                    <p className="text-xs font-bold">{user?.savedCharacter?.eyeColor || "Mavi"}</p>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">Saç Rengi</p>
                                    <p className="text-xs font-bold">{user?.savedCharacter?.hairColor || "Sarışın"}</p>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">Vücut</p>
                                    <p className="text-xs font-bold capitalize">{user?.savedCharacter?.bodyStyle || "Doğal"}</p>
                                </div>
                                <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                                    <p className="text-[8px] uppercase font-bold text-muted-foreground italic tracking-widest">Boy</p>
                                    <p className="text-xs font-bold capitalize">{user?.savedCharacter?.height || "Orta"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-black/20 border-white/10 rounded-3xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Lock className="text-primary w-5 h-5" />
                            <h4 className="font-bold">Copilot Entegrasyonu</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Bu avatarınız artık **Copilot Asistan** sayfanızda da kimlik olarak belirecek ve 
                            otomatik taslak üretimlerinde bu karakterin fiziksel özellikleri korunacaktır.
                        </p>
                    </Card>
                </div>

                {/* Secure Production Area */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="glass-card border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2 italic"><Sparkles className="text-primary" /> Tutarlı Üretim</span>
                                <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20">5 ULC</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sahne veya Eylem Tarifi</Label>
                                <Textarea 
                                    className="min-h-[150px] bg-black/40 border-white/10 rounded-3xl resize-none p-6 text-lg"
                                    placeholder="Örn: Ormanda gün batımında yürüyüş yaparken, üzerinde spor kıyafetleri var..."
                                    value={genPrompt}
                                    onChange={e => setGenPrompt(e.target.value)}
                                />
                                <div className="flex items-center gap-2 bg-primary/5 p-3 rounded-2xl border border-primary/20">
                                    <Check className="text-primary w-4 h-4" />
                                    <p className="text-[10px] text-muted-foreground">Karakterinizin fiziksel özellikleri (saç, göz, yüz hattı) otomatik olarak koruma altına alınacak.</p>
                                </div>
                            </div>

                            <Button 
                                className="w-full h-16 rounded-3xl font-bold text-xl gap-3 shadow-xl shadow-primary/20" 
                                disabled={generating || !genPrompt.trim()}
                                onClick={() => handleGenerateConsistent()}
                            >
                                {generating ? <Loader2 className="animate-spin w-6 h-6" /> : <Wand2 className="w-6 h-6" />}
                                Görseli Üret (5 ULC)
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Result display */}
                    <div className="grid grid-cols-1 gap-4">
                        {lastResult ? (
                            <Card className="glass-card border-primary/20 bg-black/40 overflow-hidden group relative">
                                <div className="aspect-square w-full flex items-center justify-center">
                                    <img src={lastResult} className="w-full h-full object-contain" alt="Generated" />
                                </div>
                                <div className="p-6 flex gap-4 bg-black/60 backdrop-blur-md">
                                    <Button className="flex-1 h-12 rounded-xl font-bold gap-2" variant="default" onClick={handleSaveToContainer} disabled={saving}>
                                        {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={18} />}
                                        Havuza Kaydet
                                    </Button>
                                    <Button className="flex-1 h-12 rounded-xl font-bold gap-2" variant="outline" onClick={handleRegenerate} disabled={generating}>
                                        <RefreshCcw size={18} /> Üretimi Yinele (3 ULC)
                                    </Button>
                                </div>
                            </Card>
                        ) : (
                            <Card className="glass-card border-dashed border-white/10 bg-white/[0.02] h-60 flex items-center justify-center text-muted-foreground text-sm italic">
                                Henüz bir üretim yapılmadı. Yukarıdaki butona basarak başlayın!
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
