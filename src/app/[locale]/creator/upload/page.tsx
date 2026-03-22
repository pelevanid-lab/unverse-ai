"use client"

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Image as ImageIcon, Video, Upload, ChevronLeft, RefreshCcw, Save, Scissors, Wand2, Sparkles, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Link } from "@/i18n/routing"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWallet } from "@/hooks/use-wallet"
import { db, storage } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadString, getDownloadURL } from "firebase/storage"

export default function ContentUploadPage() {
    const router = useRouter()
    const { toast } = useToast()
    const { user } = useWallet()
    const [fileType, setFileType] = useState<'photo' | 'video' | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [editMode, setEditMode] = useState<'manual' | 'ai'>('manual')
    const [rotation, setRotation] = useState(0)
    const [activeFilter, setActiveFilter] = useState('none')
    const [aiPrompt, setAiPrompt] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isAILoading, setIsAILoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const filters = [
        { name: 'Doğal', value: 'none' },
        { name: 'Artist', value: 'contrast(1.2) brightness(1.1) saturate(1.2)' },
        { name: 'Retro', value: 'sepia(0.3) contrast(1.1) brightness(0.9)' },
        { name: 'Soft', value: 'brightness(1.1) saturate(0.8) blur(0.2px)' },
        { name: 'Neon', value: 'hue-rotate(15deg) saturate(1.5) contrast(1.2)' },
        { name: 'Siyah Beyaz', value: 'grayscale(1)' }
    ]

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.type.startsWith('image/')) {
            setFileType('photo')
        } else if (file.type.startsWith('video/')) {
            setFileType('video')
        } else {
            toast({ variant: 'destructive', title: "Desteklenmeyen Dosya", description: "Lütfen fotoğraf veya video yükleyin." })
            return
        }

        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        setActiveFilter('none')
        setRotation(0)
    }

    const reset = () => {
        setFileType(null)
        setPreviewUrl(null)
        setEditMode('manual')
        setRotation(0)
        setActiveFilter('none')
        setAiPrompt('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleAIEdit = async () => {
        if (!previewUrl || !aiPrompt || !user?.uid) return
        setIsAILoading(true)

        try {
            // In a real app, we'd upload the current image to a temp storage and pass the URL to the AI
            // For now, let's assume the regenerate/edit API takes the current image
            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    userId: user.uid,
                    image: previewUrl, // This should be a direct URL or base64
                    cost: 8
                })
            })

            if (!res.ok) throw new Error("AI Edit failed")
            const data = await res.json()
            setPreviewUrl(data.mediaUrl)
            setEditMode('manual') // Back to manual to allow further tweaks or saving
            toast({ title: "Mükemmel!", description: "AI fotoğrafınızı yeniden yorumladı." })
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Hata", description: e.message })
        } finally {
            setIsAILoading(false)
        }
    }

    const bakeAndSave = async () => {
        if (!previewUrl || !user?.uid) return
        setIsSaving(true)

        try {
            let finalImageUrl = previewUrl

            // Helper to get base64 from blob URL if needed
            const getBase64FromBlob = async (blobUrl: string) => {
                const response = await fetch(blobUrl)
                const blob = await response.blob()
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                })
            }

            if (fileType === 'photo') {
                const img = new Image()
                img.crossOrigin = "anonymous"
                img.src = previewUrl
                await new Promise((resolve, reject) => { 
                    img.onload = resolve 
                    img.onerror = reject
                })

                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                
                // Adjust for rotation
                if (rotation % 180 === 90) {
                    canvas.width = img.height
                    canvas.height = img.width
                } else {
                    canvas.width = img.width
                    canvas.height = img.height
                }

                ctx.filter = activeFilter
                ctx.translate(canvas.width / 2, canvas.height / 2)
                ctx.rotate((rotation * Math.PI) / 180)
                ctx.drawImage(img, -img.width / 2, -img.height / 2)
                
                finalImageUrl = canvas.toDataURL('image/jpeg', 0.9)
            } else if (previewUrl.startsWith('blob:')) {
                // For videos or unedited photos that are still blobs
                finalImageUrl = await getBase64FromBlob(previewUrl)
            }

            // 2. Upload to Storage
            const extension = fileType === 'photo' ? 'jpg' : 'mp4'
            const fileName = `manual_${Date.now()}.${extension}`
            const storageRef = ref(storage, `creator-media/${user.uid}/${fileName}`)
            
            // uploadString works with data_url
            await uploadString(storageRef, finalImageUrl, 'data_url')
            const downloadUrl = await getDownloadURL(storageRef)

            // 3. Save to Firestore
            await addDoc(collection(db, 'creator_media'), {
                creatorId: user.uid,
                mediaUrl: downloadUrl,
                mediaType: fileType,
                status: 'draft',
                createdAt: serverTimestamp(),
                source: 'user',
                priceULC: 0,
                contentType: 'public'
            })

            toast({ title: "Havuza Kaydedildi!", description: "İçeriğiniz artık panelinizde görünüyor." })
            router.push('/creator?tab=container')
        } catch (e: any) {
            console.error("Save failed:", e)
            toast({ variant: 'destructive', title: "Kayıt Başarısız", description: e.message })
        } finally {
            setIsSaving(false)
        }
    }

    if (!fileType) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator/studio')} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-3xl font-headline font-bold">İçerik Yükle</h1>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card 
                        className="glass-card border-white/10 hover:border-primary/40 transition-all cursor-pointer group bg-white/[0.02]"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-6">
                            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-10 h-10 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">Fotoğraf Yükle</h3>
                                <p className="text-sm text-muted-foreground">Düzenle, Metin Yaz veya AI ile Güzelleştir</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card 
                        className="glass-card border-white/10 hover:border-blue-500/40 transition-all cursor-pointer group bg-white/[0.02]"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-6">
                            <div className="w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Video className="w-10 h-10 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">Video Yükle</h3>
                                <p className="text-sm text-muted-foreground">Kısa Videolar ve Hikayeler için</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*,video/*"
                />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4 mt-6 animate-in slide-in-from-bottom-4">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={reset} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-headline font-bold">Düzenleme Merkezi</h1>
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                            {fileType === 'photo' ? 'Fotoğraf' : 'Video'}: Yüklenen İçerik
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={reset} disabled={isSaving || isAILoading} className="rounded-xl font-bold">Vazgeç</Button>
                    <Button 
                        className="rounded-xl font-bold gap-2 px-8"
                        onClick={bakeAndSave}
                        disabled={isSaving || isAILoading}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : (editMode === 'manual' ? <Save size={16} /> : <Wand2 size={16} />)}
                        Havuza Kaydet
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Preview Column */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="glass-card border-white/10 bg-black/40 overflow-hidden relative group">
                        <div className="aspect-[4/5] md:aspect-video w-full flex items-center justify-center overflow-hidden">
                            {fileType === 'photo' ? (
                                <img 
                                    src={previewUrl!} 
                                    alt="Preview" 
                                    className="w-full h-full object-contain transition-all duration-300" 
                                    style={{ 
                                        transform: `rotate(${rotation}deg)`,
                                        filter: activeFilter
                                    }}
                                />
                            ) : (
                                <video src={previewUrl!} controls className="w-full h-full object-contain" />
                            )}

                            {isAILoading && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-50">
                                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                    <p className="text-white font-bold tracking-tighter text-xl italic uppercase">AI Yeniden Düzenliyor...</p>
                                    <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                                        Arka plan siliniyor ve objeler hayalinize göre yerleşiyor.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold text-white flex items-center gap-2">
                            {editMode === 'manual' ? <Scissors size={12} className="text-muted-foreground" /> : <Sparkles size={12} className="text-primary animate-pulse" />}
                            {editMode === 'manual' ? 'MANUEL MOD' : 'AI EDIT MOD (BETA)'}
                        </div>
                    </Card>
                </div>

                {/* Controls Column */}
                <div className="space-y-6">
                    <Tabs defaultValue="manual" value={editMode} onValueChange={(v: any) => setEditMode(v)} className="w-full">
                        <TabsList className="grid grid-cols-2 bg-white/5 border border-white/5 p-1 rounded-2xl h-12">
                            <TabsTrigger value="manual" className="rounded-xl text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-black">
                                Manuel Edit
                            </TabsTrigger>
                            <TabsTrigger value="ai" className="rounded-xl text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white gap-2">
                                AI Edit <Badge className="bg-amber-500 text-white text-[8px] h-3.5 px-1 uppercase">Beta</Badge>
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-6 space-y-6">
                            <TabsContent value="manual" className="space-y-6 animate-in fade-in">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Temel Araçlar</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button 
                                            variant={rotation !== 0 ? 'default' : 'secondary'} 
                                            onClick={() => setRotation(r => (r + 90) % 360)} 
                                            className="h-14 rounded-2xl flex-col gap-1 hover:bg-white/10 border-white/5"
                                        >
                                            <RefreshCcw size={20} className={cn(rotation !== 0 ? "text-white" : "text-muted-foreground")} />
                                            <span className="text-[10px] font-bold uppercase">DÖNDÜR</span>
                                        </Button>
                                        <Button variant="secondary" className="h-14 rounded-2xl flex-col gap-1 opacity-50 cursor-not-allowed border-white/5">
                                            <Scissors size={20} className="text-muted-foreground" />
                                            <span className="text-[10px] font-bold uppercase">KIRP</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Filtreler</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {filters.map(f => (
                                            <Button 
                                                key={f.name} 
                                                variant={activeFilter === f.value ? 'default' : 'outline'} 
                                                onClick={() => setActiveFilter(f.value)}
                                                className={cn(
                                                    "h-10 text-[9px] font-bold rounded-xl border-white/5 transition-all",
                                                    activeFilter === f.value ? "bg-primary text-white" : "bg-white/5 text-muted-foreground"
                                                )}
                                            >
                                                {f.name}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <Card className="bg-primary/5 border-primary/20 rounded-2xl">
                                    <CardContent className="p-4 flex items-center gap-3">
                                        <Wand2 className="text-primary w-5 h-5 shrink-0" />
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold uppercase text-primary">Profesyonel misin?</p>
                                            <p className="text-[9px] text-muted-foreground">Arka planı silmek veya objeleri değiştirmek için AI Edit moduna geç.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="ai" className="space-y-6 animate-in fade-in">
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
                                    <RefreshCcw className="text-amber-500 w-5 h-5 shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        AI Edit modunda fotoğrafın üzerinde değişiklik yapmak için profesyonel komutlar kullanabilirsin. 
                                        Bu işlem **8 ULC** (Regen: 4 ULC) ile ücretlendirilir.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Değişim Komutu (Prompt)</label>
                                    <textarea 
                                        placeholder="Örn: Arka planı tropikal bir plaj yap, kıyafetini kırmızı bir elbise ile değiştir..."
                                        className="w-full min-h-[100px] bg-black/40 border-white/10 rounded-2xl resize-none p-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        disabled={isAILoading}
                                    />
                                </div>

                                <Button 
                                    className="w-full h-12 rounded-2xl font-bold gap-2 bg-primary text-white"
                                    onClick={handleAIEdit}
                                    disabled={!aiPrompt || isAILoading}
                                >
                                    {isAILoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    AI İle Yeniden Düzenle (8 ULC)
                                </Button>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
