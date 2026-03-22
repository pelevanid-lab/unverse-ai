"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Upload, Wand2, ChevronLeft, ChevronRight, MessageSquare, Image as ImageIcon, Video } from "lucide-react"
import { Link } from "@/i18n/routing"
import { useRouter } from "next/navigation"

export default function CopilotStudioPage() {
    const router = useRouter();

    const tools = [
        {
            title: "Copilot Asistan",
            desc: "Yapay zeka asistanınızla strateji geliştirin ve otomasyonu yönetin.",
            icon: <MessageSquare className="w-6 h-6 text-primary" />,
            href: "/creator/copilot",
            color: "bg-primary/10",
            hover: "hover:border-primary/40"
        },
        {
            title: "İçerik Yükle",
            desc: "Bilgisayarınızdan fotoğraf veya video yükleyin, manuel veya AI ile düzenleyin.",
            icon: <Upload className="w-6 h-6 text-blue-400" />,
            href: "/creator/upload",
            color: "bg-blue-500/10",
            hover: "hover:border-blue-500/40"
        },
        {
            title: "AI Muse",
            desc: "Karakterinizi sabitleyin ve kusursuz yapay zeka içerikleri üretin.",
            icon: <Wand2 className="w-6 h-6 text-fuchsia-400" />,
            href: "/creator/muse",
            color: "bg-fuchsia-500/10",
            hover: "hover:border-fuchsia-500/40"
        }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in duration-500">
            <header className="flex items-center gap-4 border-b pb-10 border-white/10">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => router.push('/creator')} 
                    className="h-10 w-10 rounded-full bg-white/5 shrink-0"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-4xl font-headline font-bold gradient-text tracking-tighter">Copilot Stüdyo</h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">İçerik Üretme ve Yönetim Merkezi</p>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4">
                {tools.map((tool, i) => (
                    <Link key={i} href={tool.href} className="group">
                        <Card className={`glass-card border-white/10 ${tool.hover} transition-all bg-white/[0.02] overflow-hidden relative`}>
                            <CardContent className="p-8 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className={`p-4 ${tool.color} rounded-2xl group-hover:scale-110 transition-transform`}>
                                        {tool.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold">{tool.title}</h3>
                                        <p className="text-sm text-muted-foreground max-w-md">{tool.desc}</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h4 className="font-bold text-lg">Neden Copilot Stüdyo?</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Üretim süreçlerinizi tek bir noktada topladık. İster kendi çekimlerinizi yükleyin, 
                        ister AI Muse ile hayali karakterler yaratın; Copilot her adımda size asistanlık eder.
                    </p>
                </div>
            </div>
        </div>
    )
}
