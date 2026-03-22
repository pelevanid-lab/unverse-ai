"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { Loader2, Video, ChevronLeft, Sparkles, Film, Clock, Play, Image as ImageIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { CreatorMedia } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export default function AnimatePage() {
    const t = useTranslations('Container')
    const tStudio = useTranslations('AIStudio')
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useWallet()
    const { toast } = useToast()

    const [selectedImageId, setSelectedImageId] = useState<string | null>(searchParams.get('imageId'))
    const [selectedImage, setSelectedImage] = useState<CreatorMedia | null>(null)
    const [motionPrompt, setMotionPrompt] = useState('')
    const [duration, setDuration] = useState<5 | 10>(5)
    const [generating, setGenerating] = useState(false)
    const [containerItems, setContainerItems] = useState<CreatorMedia[]>([])
    const [loadingContainer, setLoadingContainer] = useState(false)
    const [showPicker, setShowPicker] = useState(!searchParams.get('imageId'))
    const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)

    useEffect(() => {
        if (selectedImageId) {
            fetchSelectedImage(selectedImageId)
        }
    }, [selectedImageId])

    useEffect(() => {
        if (user?.uid && showPicker && containerItems.length === 0) {
            fetchContainerItems();
        }
    }, [user?.uid, showPicker]);

    const fetchSelectedImage = async (id: string) => {
        try {
            const docSnap = await getDoc(doc(db, 'creator_media', id))
            if (docSnap.exists()) {
                setSelectedImage({ id: docSnap.id, ...docSnap.data() } as CreatorMedia)
                setShowPicker(false)
            }
        } catch (e) {
            console.error("Error fetching image:", e)
        }
    }

    const fetchContainerItems = async () => {
        if (!user?.uid) return
        setLoadingContainer(true)
        try {
            const q = query(
                collection(db, 'creator_media'),
                where('creatorId', '==', user.uid),
                where('mediaType', '==', 'image'),
                where('status', 'in', ['draft', 'scheduled'])
            )
            const snap = await getDocs(q)
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia))
                                    .sort((a, b) => {
                                        const dateA = a.createdAt?.seconds || (typeof a.createdAt === 'number' ? a.createdAt / 1000 : 0);
                                        const dateB = b.createdAt?.seconds || (typeof b.createdAt === 'number' ? b.createdAt / 1000 : 0);
                                        return dateB - dateA;
                                    });
            setContainerItems(items)
        } catch (e) {
            console.error("Error loading container:", e)
            toast({ variant: 'destructive', title: tStudio('errorTitle'), description: "Havuz yüklenemedi." })
        } finally {
            setLoadingContainer(false)
        }
    }

    const handleGenerate = async (isRegeneration = false) => {
        if (!selectedImage || !user?.uid || generating) return

        setGenerating(true)
        setResultVideoUrl(null)
        try {
            const res = await fetch('/api/ai/animate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageId: selectedImage.id,
                    prompt: motionPrompt,
                    userId: user.uid,
                    duration,
                    isRegeneration
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Animation failed')
            }

            const data = await res.json()
            setResultVideoUrl(data.mediaUrl)
            toast({ title: tStudio('successTitle'), description: "Video hazır! Artık havuza kaydedebilirsiniz." })
        } catch (error: any) {
            console.error("Animation failed:", error)
            toast({ variant: "destructive", title: tStudio('errorTitle'), description: error.message })
        } finally {
            setGenerating(false)
        }
    }

    const handleSaveToPool = () => {
        if (!resultVideoUrl) return;
        toast({ title: tStudio('successTitle'), description: t('animateSuccess') })
        router.push('/creator?tab=container')
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 px-4 mt-6 animate-in fade-in duration-500">
            <header className="flex items-center justify-between border-b pb-6 border-white/10">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.back()} 
                        className="h-10 w-10 rounded-full bg-white/5"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-headline font-bold gradient-text tracking-tighter">{t('tabAnimate')}</h1>
                        <p className="text-muted-foreground text-sm font-medium mt-1">{t('animateDesc')}</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-4">
                    <Card className="glass-card border-white/10 overflow-hidden bg-black/40 aspect-[3/4] flex items-center justify-center relative group">
                        {resultVideoUrl ? (
                            <video src={resultVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                        ) : selectedImage ? (
                            <>
                                <img src={selectedImage.mediaUrl} alt="Source" className="w-full h-full object-cover" />
                                {!generating && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button variant="secondary" onClick={() => { setShowPicker(true); fetchContainerItems(); }}>
                                            Görseli Değiştir
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <Button variant="ghost" className="flex flex-col gap-4 h-full w-full" onClick={() => { setShowPicker(true); fetchContainerItems(); }}>
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <span className="text-muted-foreground font-bold">{t('selectFromContainer')}</span>
                            </Button>
                        )}

                        {generating && (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-50">
                            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                            <p className="text-white font-bold">{tStudio('generating')}</p>
                            <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                              {tStudio('animateLoadingLong')}
                            </p>
                          </div>
                        )}
                    </Card>
                </div>

                <div className="lg:col-span-7 space-y-6">
                    {resultVideoUrl ? (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <div className="p-6 bg-primary/10 rounded-3xl border border-primary/20 space-y-2">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Sparkles className="text-primary w-6 h-6" />
                                    Şaheser Hazır!
                                </h3>
                                <p className="text-sm text-muted-foreground">Videonuz başarıyla oluşturuldu. Şimdi ne yapmak istersiniz?</p>
                            </div>

                            <Button onClick={handleSaveToPool} className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-lg font-bold shadow-xl shadow-primary/20">
                                <Play className="mr-2 h-5 w-5" />
                                Havuza Kaydet ve Devam Et
                            </Button>

                            <div className="grid grid-cols-1 gap-3">
                                <Button variant="outline" onClick={() => handleGenerate(true)} className="h-14 rounded-2xl border-white/10 hover:bg-white/5 font-bold gap-2">
                                    <Film className="w-5 h-5 text-primary" />
                                    {tStudio('regenerateDiscount')}
                                </Button>
                                <Button variant="ghost" onClick={() => { setResultVideoUrl(null); setSelectedImage(null); setMotionPrompt(''); }} className="text-muted-foreground hover:text-white">
                                    Baştan Başla
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Card className="glass-card border-white/10 p-6 space-y-6">
                            <div className="space-y-4">
                                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Film className="w-4 h-4" />
                                    {t('motionPrompt')}
                                </Label>
                                <Textarea 
                                    placeholder={t('motionPromptPlaceholder')}
                                    className="min-h-[120px] bg-black/20 border-white/10 rounded-2xl p-4 focus:ring-primary/50"
                                    value={motionPrompt}
                                    onChange={(e) => setMotionPrompt(e.target.value)}
                                    disabled={generating}
                                />
                            </div>

                            <div className="space-y-4">
                                <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    {t('duration')}
                                </Label>
                                <div className="flex gap-4">
                                    {[5, 10].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDuration(d as 5 | 10)}
                                            disabled={generating}
                                            className={cn(
                                                "flex-1 py-4 rounded-2xl border-2 transition-all font-bold",
                                                duration === d ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10" : "border-white/5 bg-white/5 text-muted-foreground hover:bg-white/10"
                                            )}
                                        >
                                            {t(`sec${d}`)}
                                            <span className="block text-[10px] opacity-60 font-normal">({d === 5 ? '60' : '120'} ULC)</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button 
                                className="w-full h-16 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                onClick={() => handleGenerate()}
                                disabled={!selectedImage || generating}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                        {tStudio('generating')}
                                    </>
                                ) : (
                                    <>
                                        <Video className="mr-2 h-6 w-6" />
                                        {t('generateVideo')}
                                    </>
                                )}
                            </Button>
                        </Card>
                    )}
                </div>
            </div>

            {showPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in transition-all">
                    <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border-primary/20">
                        <header className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <h3 className="font-bold">{t('selectFromContainer')}</h3>
                            <Button variant="ghost" size="icon" onClick={() => setShowPicker(false)}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </header>
                        <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {loadingContainer ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-xs text-muted-foreground">Havuz yükleniyor...</p>
                                </div>
                            ) : containerItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                                    <ImageIcon className="w-12 h-12 text-muted-foreground opacity-20" />
                                    <div>
                                        <p className="font-bold text-muted-foreground">{t('emptyStateTitle') || 'Havuzunuz Boş'}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Stüdyo'da içerik üreterek veya manuel yükleyerek başlayın.</p>
                                    </div>
                                    <Button onClick={() => router.push('/creator/studio')}>Stüdyo'ya Git</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {containerItems.map((item) => (
                                        <div key={item.id} onClick={() => { setSelectedImage(item); setShowPicker(false); setResultVideoUrl(null); }} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group">
                                            <img src={item.mediaUrl} alt="Item" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
