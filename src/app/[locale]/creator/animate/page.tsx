"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useWallet } from "@/hooks/use-wallet"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { Loader2, Video, ChevronLeft, Sparkles, Film, Clock, Play } from "lucide-react"
import { useTranslations } from "next-intl"
import { CreatorMedia } from "@/lib/types"
import { cn } from "@/lib/utils"

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

    useEffect(() => {
        if (selectedImageId) {
            fetchSelectedImage(selectedImageId)
        }
    }, [selectedImageId])

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
                orderBy('createdAt', 'desc')
            )
            const snap = await getDocs(q)
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia))
            setContainerItems(items)
        } catch (e) {
            console.error("Error loading container:", e)
        } finally {
            setLoadingContainer(false)
        }
    }

    const handleGenerate = async () => {
        if (!selectedImage || !user?.uid || generating) return

        setGenerating(true)
        try {
            const res = await fetch('/api/ai/animate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageId: selectedImage.id,
                    prompt: motionPrompt,
                    userId: user.uid,
                    duration
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Animation failed')
            }

            const data = await res.json()
            toast({ title: tStudio('successTitle'), description: t('animateSuccess') || "Video başarıyla üretildi ve havuza eklendi." })
            
            // Redirect to container or show result
            router.push('/creator?tab=container')
        } catch (error: any) {
            console.error("Animation failed:", error)
            toast({ variant: "destructive", title: tStudio('errorTitle'), description: error.message })
        } finally {
            setGenerating(false)
        }
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
                        <p className="text-muted-foreground text-xs font-medium mt-1">{t('animateDesc')}</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Source Image */}
                <div className="lg:col-span-5 space-y-4">
                    <Card className="glass-card border-white/10 overflow-hidden bg-black/40 aspect-[3/4] flex items-center justify-center relative group">
                        {selectedImage ? (
                            <>
                                <img src={selectedImage.mediaUrl} alt="Source" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button variant="secondary" onClick={() => { setShowPicker(true); fetchContainerItems(); }}>
                                        Görseli Değiştir
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <Button variant="ghost" className="flex flex-col gap-4 h-full w-full" onClick={() => { setShowPicker(true); fetchContainerItems(); }}>
                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <span className="text-muted-foreground font-bold">{t('selectFromContainer')}</span>
                            </Button>
                        )}
                    </Card>
                </div>

                {/* Right: Controls */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Film className="w-3 h-3" /> {t('motionPrompt')}
                            </label>
                            <Textarea 
                                placeholder={t('motionPromptPlaceholder')}
                                value={motionPrompt}
                                onChange={(e) => setMotionPrompt(e.target.value)}
                                className="bg-white/5 border-white/10 min-h-[120px] rounded-2xl focus:ring-primary/40"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Clock className="w-3 h-3" /> {t('duration')}
                            </label>
                            <div className="flex gap-3">
                                {[5, 10].map((d) => (
                                    <Button
                                        key={d}
                                        variant="outline"
                                        onClick={() => setDuration(d as any)}
                                        className={cn(
                                            "flex-1 h-12 rounded-xl border-white/10 font-bold",
                                            duration === d ? "bg-primary text-white border-primary" : "bg-white/5 hover:bg-white/10"
                                        )}
                                    >
                                        {d === 5 ? t('sec5') : t('sec10')}
                                        <span className={cn("ml-2 text-[10px] opacity-70", duration === d ? "text-white/80" : "text-muted-foreground")}>
                                            ({d === 5 ? '60' : '120'} ULC)
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button 
                            className="w-full h-16 rounded-2xl font-bold text-lg gap-3 shadow-xl shadow-primary/20"
                            disabled={!selectedImage || generating}
                            onClick={handleGenerate}
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    {tStudio('generating')}
                                </>
                            ) : (
                                <>
                                    <Play className="w-6 h-6 fill-current" />
                                    {t('generateVideo')} ({duration === 5 ? '60' : '120'} ULC)
                                </>
                            )}
                        </Button>
                        <p className="text-center text-[10px] text-muted-foreground mt-4 uppercase tracking-widest font-bold">
                            Kling Video v1.0 • {t('noAnimateForVideo')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Image Picker Modal */}
            {showPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden glass-card flex flex-col">
                        <header className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{t('selectFromContainer')}</h2>
                            <Button variant="ghost" size="icon" onClick={() => setShowPicker(false)}>×</Button>
                        </header>
                        <CardContent className="flex-1 overflow-y-auto p-6">
                            {loadingContainer ? (
                                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                            ) : containerItems.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground">{t('emptyStateTitle')}</div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {containerItems.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => { setSelectedImage(item); setShowPicker(false); }}
                                            className="aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary transition-all"
                                        >
                                            <img src={item.mediaUrl} className="w-full h-full object-cover" alt="item" />
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
