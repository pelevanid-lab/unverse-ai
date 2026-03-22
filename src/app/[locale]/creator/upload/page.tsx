"use client"

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Image as ImageIcon, Video, Upload, ChevronLeft, RefreshCcw, Save, Scissors, Wand2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { Link } from "@/i18n/routing"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function ContentUploadPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [fileType, setFileType] = useState<'photo' | 'video' | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [editMode, setEditMode] = useState<'manual' | 'ai'>('manual')
    const fileInputRef = useRef<HTMLInputElement>(null)

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
    }

    const reset = () => {
        setFileType(null)
        setPreviewUrl(null)
        setEditMode('manual')
        if (fileInputRef.current) fileInputRef.current.value = ''
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
                    <Button variant="outline" onClick={reset} className="rounded-xl font-bold">Vazgeç</Button>
                    <Button className="rounded-xl font-bold gap-2 px-8">
                        {editMode === 'manual' ? <Save size={16} /> : <Wand2 size={16} />}
                        Havuza Kaydet
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Preview Column */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="glass-card border-white/10 bg-black/40 overflow-hidden relative group">
                        <div className="aspect-[4/5] md:aspect-video w-full flex items-center justify-center">
                            {fileType === 'photo' ? (
                                <img src={previewUrl!} alt="Preview" className="w-full h-full object-contain" />
                            ) : (
                                <video src={previewUrl!} controls className="w-full h-full object-contain" />
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
                                        <Button variant="secondary" className="h-14 rounded-2xl flex-col gap-1 hover:bg-white/10 border-white/5">
                                            <Scissors size={20} className="text-muted-foreground" />
                                            <span className="text-[10px] font-bold">KIRP</span>
                                        </Button>
                                        <Button variant="secondary" className="h-14 rounded-2xl flex-col gap-1 hover:bg-white/10 border-white/5">
                                            <RefreshCcw size={20} className="text-muted-foreground" />
                                            <span className="text-[10px] font-bold">DÖNDÜR</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Filtreler</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Doğal', 'Artist', 'Retro', 'Soft', 'Neon', 'Siyah Beyaz'].map(f => (
                                            <Button key={f} variant="outline" className="h-10 text-[9px] font-bold rounded-xl border-white/5 bg-white/5">
                                                {f}
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
                                        className="w-full min-h-[100px] bg-black/40 border-white/10 rounded-2xl resize-none p-4 text-sm"
                                    />
                                </div>

                                <Button className="w-full h-12 rounded-2xl font-bold gap-2 bg-primary text-white">
                                    <Sparkles size={16} />
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
