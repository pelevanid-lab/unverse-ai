"use client"

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
    Sparkles,
    Lock as LockIcon
} from 'lucide-react'
import { useRouter } from "next/navigation"
import { Link } from "@/i18n/routing"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useWallet } from "@/hooks/use-wallet"
import { db, storage } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { getSystemConfig, recordTransaction } from '@/lib/ledger'
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage"
import { Uniq } from "@/lib/uniq"

export default function ContentUploadPage() {
    const t = useTranslations('Upload')
    const router = useRouter()
    const { toast } = useToast()
    const { user } = useWallet()
    const [fileType, setFileType] = useState<'image' | 'video' | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewBase64, setPreviewBase64] = useState<string | null>(null)
    const [mediaCount, setMediaCount] = useState(0)
    const [isLimitReached, setIsLimitReached] = useState(false)
    const [editMode, setEditMode] = useState<'manual' | 'ai'>('manual')
    const [rotation, setRotation] = useState(0)
    const [activeFilter, setActiveFilter] = useState('none')
    const [cropAspect, setCropAspect] = useState<number | null>(null) // null = original, 1 = square, 0.8 = portrait, 1.77 = wide
    const [aiPrompt, setAiPrompt] = useState('')
    const [aiSubMode, setAiSubMode] = useState<'initial' | 'selection'>('initial')
    const [isSaving, setIsSaving] = useState(false)
    const [isAILoading, setIsAILoading] = useState(false)
    const [isSegmenting, setIsSegmenting] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [brushSize, setBrushSize] = useState(40)
    const [isPainting, setIsPainting] = useState(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const maskCanvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Check media limit on load
    useEffect(() => {
        if (!user?.uid) return;
        const fetchCount = async () => {
            const { query, collection, where, getDocs } = await import('firebase/firestore');
            const q = query(
                collection(db, 'creator_media'),
                where('creatorId', '==', user.uid)
            );
            const snap = await getDocs(q);
            setMediaCount(snap.size);
            if (snap.size >= 60) {
                setIsLimitReached(true);
                toast({ 
                    variant: 'destructive', 
                    title: "Konteyner Dolu (60/60)", 
                    description: "Maksimum 60 medya sınırına ulaştınız. Yeni yükleme yapmak için eskilerini silin veya paylaşın." 
                });
            }
        };
        fetchCount();
    }, [user?.uid]);
    
    useEffect(() => {
        const checkAdmin = async () => {
            if (user?.walletAddress) {
                const config = await getSystemConfig()
                if (config?.admin_wallet_address && 
                    user.walletAddress.toLowerCase() === config.admin_wallet_address.toLowerCase()) {
                    setIsAdmin(true)
                }
            }
        }
        checkAdmin()
    }, [user])

    const filters = [
        { name: t('filterNatural'), value: 'none' },
        { name: t('filterArtist'), value: 'contrast(1.2) brightness(1.1) saturate(1.2)' },
        { name: t('filterRetro'), value: 'sepia(0.3) contrast(1.1) brightness(0.9)' },
        { name: t('filterSoft'), value: 'brightness(1.1) saturate(0.8) blur(0.2px)' },
        { name: t('filterNeon'), value: 'hue-rotate(15deg) saturate(1.5) contrast(1.2)' },
        { name: t('filterBW'), value: 'grayscale(1)' }
    ]

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLimitReached) {
            toast({ 
                variant: 'destructive', 
                title: "Limit Aşıldı", 
                description: "En fazla 60 medya saklayabilirsiniz. Lütfen yer açın." 
            });
            return;
        }
        const file = e.target.files?.[0]
        if (!file) return

        if (file.type.startsWith('image/')) {
            setFileType('image')
        } else if (file.type.startsWith('video/')) {
            setFileType('video')
        } else {
            toast({ variant: 'destructive', title: t('unsupportedFile'), description: t('unsupportedFileDesc') })
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
        
        // 🗑️ Cleanup AI preview if resetting
        if (previewUrl && previewUrl.includes('firebasestorage.googleapis.com')) {
            deleteObject(ref(storage, previewUrl)).catch(() => {});
        }

        if (fileInputRef.current) fileInputRef.current.value = ''
        
        // Clear mask
        if (maskCanvasRef.current) {
            const ctx = maskCanvasRef.current.getContext('2d')
            if (ctx) ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height)
        }
    }

    const startPainting = (e: React.MouseEvent | React.TouchEvent) => {
        setIsPainting(true)
        paint(e)
    }

    const stopPainting = () => setIsPainting(false)

    const paint = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isPainting || editMode !== 'ai' || !maskCanvasRef.current) return

        const canvas = maskCanvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        let x, y
        
        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left
            y = e.touches[0].clientY - rect.top
        } else {
            x = e.clientX - rect.left
            y = e.clientY - rect.top
        }

        // Scale coordinates if canvas display size differs from internal size
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        
        // Use internal canvas resolution for painting
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(x * scaleX, y * scaleY, (brushSize / 2) * scaleX, 0, Math.PI * 2) 
        ctx.fill()
    }

    const handleAutoSelectBackground = async () => {
        if (!previewUrl || !user?.uid) return
        setIsSegmenting(true)
        
        try {
            let imageToSend = previewUrl
            
            // 🛡️ SECURITY: Fetch image as blob first to avoid CORS/Tainted Canvas
            const response = await fetch(previewUrl)
            const blob = await response.blob()
            
            // 🚀 OPTIMIZATION: Resize image to max 1024px to ensure segmentation reliability
            imageToSend = await new Promise<string>((resolve) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    let width = img.width
                    let height = img.height
                    const maxDim = 1024
                    
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height *= maxDim / width
                            width = maxDim
                        } else {
                            width *= maxDim / height
                            height = maxDim
                        }
                    }
                    
                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')
                    ctx?.drawImage(img, 0, 0, width, height)
                    resolve(canvas.toDataURL('image/jpeg', 0.85))
                }
                img.src = URL.createObjectURL(blob)
            })

            const res = await fetch('/api/ai/segment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageToSend })
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || errData.detail || "Segmentation failed")
            }
            const { maskBase64 } = await res.json()

            // 🎯 CORS BYPASS: Use base64 directly
            const img = new Image()
            img.src = maskBase64
            await new Promise((resolve) => { img.onload = resolve })

            const maskCanvas = maskCanvasRef.current
            if (maskCanvas) {
                const ctx = maskCanvas.getContext('2d')
                if (ctx) {
                    // Start clean
                    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
                    
                    // 📐 Draw invisible "nobg" to a temporary canvas to read pixels
                    const tempCanvas = document.createElement('canvas')
                    tempCanvas.width = maskCanvas.width
                    tempCanvas.height = maskCanvas.height
                    const tempCtx = tempCanvas.getContext('2d')
                    if (tempCtx) {
                        tempCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height)
                        const imageData = tempCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
                        const data = imageData.data
                        
                        // 🧬 Generate Mask: Where Alpha is 0 (Transparent = Background), we want White (Change)
                        // Where Alpha is > 0 (Subject), we want Black (Keep - already clear)
                        const resultData = ctx.createImageData(maskCanvas.width, maskCanvas.height)
                        for (let i = 0; i < data.length; i += 4) {
                            const alpha = data[i+3]
                            if (alpha < 10) { // Threshold for "Background"
                                resultData.data[i] = 255     // R
                                resultData.data[i+1] = 255   // G
                                resultData.data[i+2] = 255   // B
                                resultData.data[i+3] = 255   // A
                            } else {
                                resultData.data[i] = 0
                                resultData.data[i+1] = 0
                                resultData.data[i+2] = 0
                                resultData.data[i+3] = 0
                            }
                        }
                        ctx.putImageData(resultData, 0, 0)
                    }
                }
            }

            setAiSubMode('selection')
            toast({ title: t('aiPerfect'), description: t('autoSelectDesc') })
        } catch (e: any) {
            console.error(e)
            toast({ variant: 'destructive', title: t('error'), description: t('segmentFailed') })
        } finally {
            setIsSegmenting(false)
        }
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

            // 🗑️ Cleanup previous AI-edited preview if we are doing a new one
            if (previewUrl && previewUrl.includes('firebasestorage.googleapis.com')) {
                try {
                    const oldRef = ref(storage, previewUrl);
                    await deleteObject(oldRef);
                } catch (e) {
                    console.warn("Failed to delete previous AI edit preview:", e);
                }
            }

            // 1. Translate / Enhance prompt (Digital Pivot)
            const uniq = new Uniq(user.uid)
            await uniq.init()
            const enhancedPrompt = await uniq.translatePrompt(aiPrompt)

            // 2. Extract Mask (Always required by Fal in-painting)
            let maskDataUrl = ""
            if (maskCanvasRef.current) {
                const canvas = maskCanvasRef.current
                const tempCanvas = document.createElement('canvas')
                tempCanvas.width = canvas.width
                tempCanvas.height = canvas.height
                const tempCtx = tempCanvas.getContext('2d')!
                
                tempCtx.fillStyle = 'black'
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
                
                // If the user hasn't painted, we make the mask ALL WHITE (Global Edit)
                // We check if the mask canvas is empty (transparent)
                const maskCtx = canvas.getContext('2d')!
                const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data
                let hasBrushStroke = false
                for (let i = 0; i < maskData.length; i += 4) {
                    if (maskData[i + 3] > 0) { // Alpha > 0
                        hasBrushStroke = true
                        break
                    }
                }

                if (!hasBrushStroke) {
                    tempCtx.fillStyle = 'white'
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
                } else {
                    tempCtx.drawImage(canvas, 0, 0)
                }
                
                maskDataUrl = tempCanvas.toDataURL('image/png')
            }

            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    translation: enhancedPrompt,
                    userId: user.uid,
                    image: imageToSend,
                    mask: maskDataUrl, // ⚡ Professional Masking support
                    cost: 8
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "AI Edit failed")
            }
            const data = await res.json()
            setPreviewUrl(data.mediaUrl)
            if (data.mediaBase64) {
                setPreviewBase64(data.mediaBase64)
            }
            setEditMode('manual') 
            toast({ title: t('aiPerfect'), description: t('aiPerfectDesc') })
        } catch (e: any) {
            console.error("AI Edit failed:", e)
            toast({ variant: 'destructive', title: t('error'), description: e.message })
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
                let imgSource = previewUrl
                
                // 🛡️ CORS BYPASS: Use base64 if available to avoid "Failed to fetch"
                if (previewBase64) {
                    imgSource = previewBase64
                } else if (previewUrl.startsWith('https://firebasestorage.googleapis.com')) {
                    // Fallback attempt: Fetch as blob (might still fail if CORS is missing)
                    try {
                        const response = await fetch(previewUrl)
                        const blob = await response.blob()
                        imgSource = URL.createObjectURL(blob)
                    } catch (fetchErr) {
                        console.warn("CORS/Fetch failed, trying direct load with anonymous...", fetchErr)
                    }
                }

                const img = new Image()
                img.crossOrigin = "anonymous" // Still helpful for non-base64
                img.src = imgSource
                await new Promise((resolve, reject) => { 
                    img.onload = resolve 
                    img.onerror = () => reject(new Error("Failed to load image into canvas. CORS or Format issue."))
                })
                
                if (imgSource.startsWith('blob:')) {
                    URL.revokeObjectURL(imgSource)
                }

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
            const response = await fetch('/api/ai/save-to-container', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    mediaUrl: downloadUrl,
                    mediaType: fileType,
                    source: 'user',
                    priceULC: 0,
                    contentType: 'public'
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Save failed");
            }

            toast({ title: t('savedSuccess'), description: t('savedSuccessDesc') })
            router.push('/creator?tab=container')
        } catch (e: any) {
            console.error("Save failed detailed error:", e)
            // 🚀 Professional Error Capture (Avoid [object Object])
            const errorDetail = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e))
            toast({ variant: 'destructive', title: t('saveFailed'), description: errorDetail })
        } finally {
            setIsSaving(false)
        }
    }

    if (!fileType) {
        return (
            <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator')} className="rounded-full bg-white/5">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-3xl font-headline font-bold">{t('title')}</h1>
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
                                <h3 className="text-xl font-bold">{t('photoTitle')}</h3>
                                <p className="text-sm text-muted-foreground">{t('photoSubtitle')}</p>
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
                                <h3 className="text-xl font-bold">{t('videoTitle')}</h3>
                                <p className="text-sm text-muted-foreground">{t('videoSubtitle')}</p>
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
                        <h1 className="text-xl font-black tracking-tight uppercase">{t('editCenter')}</h1>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                            {fileType === 'image' ? t('photo') : t('video')}: {t('uploadedContent')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={reset} disabled={isSaving || isAILoading} className="rounded-xl font-bold">{t('cancel')}</Button>
                    <Button 
                        className="rounded-xl font-bold gap-2 px-8"
                        onClick={bakeAndSave}
                        disabled={isSaving || isAILoading}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : (editMode === 'manual' ? <Save size={16} /> : <Wand2 size={16} />)}
                        {t('saveToPool')}
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
                                        onLoad={(e) => {
                                            const img = e.currentTarget;
                                            if (maskCanvasRef.current) {
                                                maskCanvasRef.current.width = img.naturalWidth;
                                                maskCanvasRef.current.height = img.naturalHeight;
                                                // Clear existing mask if image source changed meaningfully
                                                const ctx = maskCanvasRef.current.getContext('2d');
                                                if (ctx) ctx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
                                            }
                                        }}
                                    />
                                ) : (
                                    <video src={previewUrl!} controls className="w-full h-full object-contain" />
                                )}
                                
                                {/* 🎨 BRUSH MASK LAYER */}
                                {editMode === 'ai' && !isAILoading && (
                                    <canvas
                                        ref={maskCanvasRef}
                                        onMouseDown={startPainting}
                                        onMouseMove={paint}
                                        onMouseUp={stopPainting}
                                        onMouseLeave={stopPainting}
                                        onTouchStart={startPainting}
                                        onTouchMove={paint}
                                        onTouchEnd={stopPainting}
                                        className="absolute inset-0 w-full h-full cursor-crosshair opacity-60 pointer-events-auto touch-none"
                                        style={{ 
                                            mixBlendMode: 'screen',
                                            filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))'
                                        }}
                                    />
                                )}
                            </div>

                            {isAILoading && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-50">
                                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                    <p className="text-white font-bold tracking-tighter text-xl italic uppercase">{t('aiEditing')}</p>
                                    <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                                        {t('aiEditingDesc')}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold text-white flex items-center gap-2">
                            {editMode === 'manual' ? <Scissors size={12} className="text-muted-foreground" /> : <Sparkles size={12} className="text-primary animate-pulse" />}
                            {editMode === 'manual' ? t('manualMode') : t('aiEditMode')}
                        </div>
                    </Card>
                </div>

                {/* Controls Column */}
                <div className="space-y-6">
                    {fileType === 'image' ? (
                        <>
                            <Tabs value={editMode} onValueChange={(v) => setEditMode(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl h-12">
                                    <TabsTrigger value="manual" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white">{t('manualEdit')}</TabsTrigger>
                                    <TabsTrigger value="ai" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white gap-2">{t('aiEdit')} <Badge className="ml-1 text-[8px] px-1 bg-amber-500 border-none">BETA</Badge></TabsTrigger>
                                </TabsList>

                                <TabsContent value="manual" className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Manual controls (rotation, crop, filters) */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('basicTools')}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button 
                                                variant={rotation !== 0 ? 'default' : 'secondary'} 
                                                onClick={() => setRotation((r: number) => (r + 90) % 360)} 
                                                className="h-14 rounded-2xl flex-col gap-1 hover:bg-white/10 border-white/5"
                                            >
                                                <RefreshCcw size={20} className={cn(rotation !== 0 ? "text-white" : "text-muted-foreground")} />
                                                <span className="text-[10px] font-bold uppercase">{t('rotate')}</span>
                                            </Button>
                                            <div className="relative group">
                                                <Button 
                                                    variant={cropAspect !== null ? 'default' : 'secondary'} 
                                                    className="h-14 w-full rounded-2xl flex-col gap-1 hover:bg-white/10 border-white/5"
                                                >
                                                    <Scissors size={20} className={cn(cropAspect !== null ? "text-white" : "text-muted-foreground")} />
                                                    <span className="text-[10px] font-bold uppercase">{t('crop')}</span>
                                                </Button>
                                                
                                                {/* Simple Hover Menu for Crop */}
                                                <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 grid grid-cols-2 gap-1 text-[10px] font-bold">
                                                    <button onClick={() => setCropAspect(null)} className={cn("p-1 rounded hover:bg-white/10", !cropAspect && "text-primary")}>{t('none')}</button>
                                                    <button onClick={() => setCropAspect(1)} className={cn("p-1 rounded hover:bg-white/10", cropAspect === 1 && "text-primary")}>1:1</button>
                                                    <button onClick={() => setCropAspect(0.8)} className={cn("p-1 rounded hover:bg-white/10", cropAspect === 0.8 && "text-primary")}>4:5</button>
                                                    <button onClick={() => setCropAspect(1.777)} className={cn("p-1 rounded hover:bg-white/10", cropAspect === 1.777 && "text-primary")}>16:9</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t('filters')}</h4>
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
                                    {!isAdmin ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-center space-y-5 bg-white/5 border border-white/10 rounded-[2rem] animate-in zoom-in-95 duration-500">
                                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-2xl shadow-primary/20">
                                                <LockIcon size={32} />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">
                                                    {t('aiComingSoon')}
                                                </h3>
                                                <p className="text-xs text-muted-foreground max-w-[200px] font-medium leading-relaxed">
                                                    {t('aiComingSoonDesc')}
                                                </p>
                                            </div>
                                            <div className="pt-2">
                                                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/20 font-black px-4 py-1">
                                                    PRIVATE BETA
                                                </Badge>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                                <div className="flex gap-3 text-amber-500">
                                                    <Sparkles size={18} className="shrink-0 mt-0.5" />
                                                    <p className="text-[11px] leading-relaxed">
                                                        <span dangerouslySetInnerHTML={{ __html: t.raw('aiEditInfo') }} />
                                                    </p>
                                                </div>
                                            </div>

                                            {aiSubMode === 'initial' ? (
                                                <div className="space-y-4 py-8 text-center animate-in fade-in zoom-in-95 duration-500">
                                                    <div className="relative inline-block group">
                                                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-500 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                                        <Button 
                                                            size="lg"
                                                            onClick={handleAutoSelectBackground}
                                                            disabled={isSegmenting}
                                                            className="relative h-20 px-8 rounded-full bg-black hover:bg-black/80 border border-white/10 flex flex-col items-center justify-center gap-1 group shadow-2xl"
                                                        >
                                                            {isSegmenting ? (
                                                                <>
                                                                    <Loader2 size={24} className="text-primary animate-spin" />
                                                                    <span className="text-[10px] font-black uppercase text-primary tracking-tighter">{t('uniqCutting')}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2">
                                                                        <Monitor size={20} className="text-primary" />
                                                                        <span className="text-lg font-black tracking-tighter text-white uppercase">{t('changeBackground')}</span>
                                                                    </div>
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none translate-y-1">{t('autoSelectDesc')}</span>
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                    
                                                    <p className="text-[10px] text-muted-foreground italic max-w-[200px] mx-auto opacity-60">
                                                        {t('aiEditingDesc')}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                    {/* 🛠️ BRUSH CONTROLS */}
                                                    <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('brushTitle')}</h4>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => {
                                                                    const canvas = maskCanvasRef.current
                                                                    const ctx = canvas?.getContext('2d')
                                                                    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height)
                                                                }}
                                                                className="text-[10px] h-6 px-2 text-amber-500 hover:text-amber-400"
                                                            >
                                                                {t('clearBtn')}
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <Scissors size={14} className="text-muted-foreground" />
                                                            <input 
                                                                type="range" 
                                                                min="10" 
                                                                max="150" 
                                                                value={brushSize}
                                                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                                                className="flex-1 accent-primary h-1.5 rounded-full bg-white/10"
                                                            />
                                                            <span className="text-[10px] font-bold w-8">{brushSize}px</span>
                                                        </div>
                                                    </div>

                                                    {/* 🧙 BACKGROUND WIZARD */}
                                                    <div className="space-y-4">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('bgWizardTitle')}</h4>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[
                                                                { id: 'Studio', label: t('scenarioStudio'), prompt: t('scenarioStudioPrompt') },
                                                                { id: 'Paris', label: t('scenarioParis'), prompt: t('scenarioParisPrompt') },
                                                                { id: 'Neon', label: t('scenarioNeon'), prompt: t('scenarioNeonPrompt') },
                                                                { id: 'Nature', label: t('scenarioNature'), prompt: t('scenarioNaturePrompt') }
                                                            ].map((preset) => (
                                                                <Button
                                                                    key={preset.id}
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => setAiPrompt(prev => {
                                                                        const base = preset.prompt
                                                                        return prev.includes(base) ? prev : `${base}, ${prev}`
                                                                    })}
                                                                    className="h-10 text-[10px] font-bold rounded-xl border border-white/5 bg-white/5 hover:bg-white/10"
                                                                >
                                                                    {preset.label}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('aiPromptLabel')}</h4>
                                                        <textarea 
                                                            value={aiPrompt}
                                                            onChange={(e) => setAiPrompt(e.target.value)}
                                                            placeholder={t('aiPromptPlaceholder')}
                                                            className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none shadow-inner"
                                                        />
                                                        
                                                        <Button 
                                                            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-bold gap-2 text-sm shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                                            onClick={handleAIEdit}
                                                            disabled={!aiPrompt || isAILoading}
                                                        >
                                                            {isAILoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                                            {t('aiEditBtn', { cost: 8 })}
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setAiSubMode('initial')}
                                                            className="w-full text-[10px] text-muted-foreground hover:text-white"
                                                        >
                                                            ← {t('cancel')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : (
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
                                <Film size={32} className="text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">{t('videoModeTitle')}</h3>
                                <p className="text-sm text-muted-foreground">{t('videoModeDesc')}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
