"use client"

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
    ChevronLeft, 
    Upload, 
    Image as ImageIcon, 
    Video,
    Film, 
    RotateCcw, 
    Monitor,
    RefreshCcw, 
    Scissors, 
    Wand2, 
    Save, 
    Loader2, 
    Check,
    X,
    Filter,
    Sparkles
} from 'lucide-react'
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
    const [fileType, setFileType] = useState<'image' | 'video' | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [editMode, setEditMode] = useState<'manual' | 'ai'>('manual')
    const [rotation, setRotation] = useState(0)
    const [activeFilter, setActiveFilter] = useState('none')
    const [cropAspect, setCropAspect] = useState<number | null>(null) // null = original, 1 = square, 0.8 = portrait, 1.77 = wide
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
            setFileType('image')
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
        setCropAspect(null)
        setAiPrompt('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleAIEdit = async () => {
        if (!previewUrl || !aiPrompt || !user?.uid) return
        setIsAILoading(true)

        try {
            let imageToSend = previewUrl
            
            // If it's a local blob, convert to base64
            if (previewUrl.startsWith('blob:')) {
                const response = await fetch(previewUrl)
                const blob = await response.blob()
                imageToSend = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                })
            }

            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    userId: user.uid,
                    image: imageToSend,
                    cost: 8
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "AI Edit failed")
            }
            const data = await res.json()
            setPreviewUrl(data.mediaUrl)
            setEditMode('manual') 
            toast({ title: "Mükemmel!", description: "AI fotoğrafınızı yeniden yorumladı." })
        } catch (e: any) {
            console.error("AI Edit failed:", e)
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

            if (fileType === 'image') {
                const img = new Image()
                img.crossOrigin = "anonymous"
                img.src = previewUrl
                await new Promise((resolve, reject) => { 
                    img.onload = resolve 
                    img.onerror = reject
                })

                // Calculate dimensions based on cropAspect
                let targetWidth = img.width
                let targetHeight = img.height
                
                if (cropAspect) {
                    if (img.width / img.height > cropAspect) {
                        // Image is wider than crop
                        targetWidth = img.height * cropAspect
                    } else {
                        // Image is taller than crop
                        targetHeight = img.width / cropAspect
                    }
                }

                // Adjust for rotation (90/270 swap dimensions)
                const isRotated90 = rotation % 180 === 90
                const canvasWidth = isRotated90 ? targetHeight : targetWidth
                const canvasHeight = isRotated90 ? targetWidth : targetHeight

                const canvas = document.createElement('canvas')
                canvas.width = canvasWidth
                canvas.height = canvasHeight
                const ctx = canvas.getContext('2d')!
                
                ctx.filter = activeFilter
                ctx.translate(canvas.width / 2, canvas.height / 2)
                ctx.rotate((rotation * Math.PI) / 180)
                
                // Draw centered
                ctx.drawImage(img, -img.width / 2, -img.height / 2)
                
                finalImageUrl = canvas.toDataURL('image/jpeg', 0.9)
            } else if (previewUrl.startsWith('blob:')) {
                // For videos or unedited photos that are still blobs
                finalImageUrl = await getBase64FromBlob(previewUrl)
            }

            // 2. Upload to Storage
            const extension = fileType === 'image' ? 'jpg' : 'mp4'
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
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={reset} className="rounded-full">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                        <Monitor size={20} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight uppercase">Düzenleme Merkezi</h1>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                            {fileType === 'image' ? 'Fotoğraf' : 'Video'}: Yüklenen İçerik
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
                            <div 
                                className="relative transition-all duration-500 ease-in-out"
                                style={{ 
                                    aspectRatio: cropAspect || 'auto',
                                    height: '100%',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {fileType === 'image' ? (
                                    <img 
                                        src={previewUrl!} 
                                        alt="Preview" 
                                        className={cn(
                                            "transition-all duration-300",
                                            cropAspect ? "w-full h-full object-cover" : "max-w-full max-h-full object-contain"
                                        )}
                                        style={{ 
                                            transform: `rotate(${rotation}deg)`,
                                            filter: activeFilter
                                        }}
                                    />
                                ) : (
                                    <video src={previewUrl!} controls className="w-full h-full object-contain" />
                                )}
                            </div>

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
                    {fileType === 'image' ? (
                        <>
                            <Tabs value={editMode} onValueChange={(v) => setEditMode(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl h-12">
                                    <TabsTrigger value="manual" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Manuel Edit</TabsTrigger>
                                    <TabsTrigger value="ai" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white gap-2">AI Edit <Badge className="ml-1 text-[8px] px-1 bg-amber-500 border-none">BETA</Badge></TabsTrigger>
                                </TabsList>

                                <TabsContent value="manual" className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Manual controls (rotation, crop, filters) */}
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
                                            <div className="relative group">
                                                <Button 
                                                    variant={cropAspect !== null ? 'default' : 'secondary'} 
                                                    className="h-14 w-full rounded-2xl flex-col gap-1 hover:bg-white/10 border-white/5"
                                                >
                                                    <Scissors size={20} className={cn(cropAspect !== null ? "text-white" : "text-muted-foreground")} />
                                                    <span className="text-[10px] font-bold uppercase">KIRP</span>
                                                </Button>
                                                
                                                {/* Simple Hover Menu for Crop */}
                                                <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 grid grid-cols-2 gap-1 text-[10px] font-bold">
                                                    <button onClick={() => setCropAspect(null)} className={cn("p-1 rounded hover:bg-white/10", !cropAspect && "text-primary")}>YOK</button>
                                                    <button onClick={() => setCropAspect(1)} className={cn("p-1 rounded hover:bg-white/10", cropAspect === 1 && "text-primary")}>1:1</button>
                                                    <button onClick={() => setCropAspect(0.8)} className={cn("p-1 rounded hover:bg-white/10", cropAspect === 0.8 && "text-primary")}>4:5</button>
                                                    <button onClick={() => setCropAspect(1.777)} className={cn("p-1 rounded hover:bg-white/10", cropAspect === 1.777 && "text-primary")}>16:9</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Filtreler</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            {filters.map((f) => (
                                                <button
                                                    key={f.name}
                                                    onClick={() => setActiveFilter(f.value)}
                                                    className={cn(
                                                        "p-3 rounded-xl border text-[10px] font-bold uppercase transition-all",
                                                        activeFilter === f.value 
                                                            ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105" 
                                                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
                                                    )}
                                                >
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="ai" className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                        <div className="flex gap-3 text-amber-500">
                                            <RotateCcw size={18} className="shrink-0 mt-0.5" />
                                            <p className="text-[11px] leading-relaxed">
                                                AI Edit modunda fotoğrafın üzerinde değişiklik yapmak için profesyonel komutlar kullanabilirsin. Bu işlem **8 ULC** (Regen: 4 ULC) ile ücretlendirilir.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">DEĞİŞİM KOMUTU (PROMPT)</h4>
                                        <textarea 
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            placeholder="Arka planı değiştir, saçı kızıl yap..."
                                            className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                                        />
                                        
                                        <Button 
                                            className="w-full h-12 rounded-xl bg-primary hover:opacity-90 font-bold gap-2 text-sm shadow-lg shadow-primary/20"
                                            onClick={handleAIEdit}
                                            disabled={!aiPrompt || isAILoading}
                                        >
                                            {isAILoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                            AI İle Yeniden Düzenle (8 ULC)
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : (
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                                <Film size={32} className="text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Video Modu</h3>
                                <p className="text-sm text-muted-foreground">Videolar için düzenleme şu an desteklenmemektedir. İçeriği doğrudan havuza kaydedebilirsiniz.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
