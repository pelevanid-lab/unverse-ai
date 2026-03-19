
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Wand2, Lightbulb, Coins, Clock } from 'lucide-react';
import { creatorCopilotFlow } from '@/ai/flows/creator-copilot-flow';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface AICreatorCopilotProps {
    contentType: 'public' | 'premium' | 'limited';
    creatorName: string;
    onApply: (data: { caption: string; price?: number }) => void;
}

export function AICreatorCopilot({ contentType, creatorName, onApply }: AICreatorCopilotProps) {
    const [idea, setIdea] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ caption: string; teaser: string; suggestedPriceULC: number; explanation: string } | null>(null);
    const { toast } = useToast();

    const handleGenerate = async () => {
        // Disabled for now as per request
        return;
        
        if (!idea.trim()) {
            toast({ title: "Idea Required", description: "Please enter a short description of your content." });
            return;
        }

        setLoading(true);
        try {
            const response = await creatorCopilotFlow({ idea, contentType, creatorName });
            setResult(response);
        } catch (error) {
            console.error("AI Generation failed:", error);
            toast({ variant: "destructive", title: "Copilot Error", description: "AI could not reach the Unverse at this moment." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-primary/20 bg-primary/5 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 shadow-lg shadow-primary/5">
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                        <div className="bg-primary p-1.5 rounded-lg">
                            <Sparkles className="w-4 h-4 text-white fill-current" />
                        </div>
                        <span className="font-headline font-black text-sm uppercase tracking-widest">Creator Copilot</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-widest">
                        Coming Soon
                    </Badge>
                </div>

                {!result ? (
                    <div className="space-y-3 opacity-60 pointer-events-none">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">What is your content about?</Label>
                            <Textarea 
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                placeholder="Describe your photo or video in a few words..."
                                className="bg-background/50 border-white/10 text-xs resize-none h-16 rounded-xl"
                                disabled
                            />
                        </div>
                        <Button disabled className="w-full h-10 rounded-xl bg-muted text-muted-foreground font-bold text-xs gap-2">
                            <Clock className="w-4 h-4" />
                            Coming Soon
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        {/* result state UI preserved just in case */}
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Suggested Caption</Label>
                                <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="h-6 text-[10px] opacity-50">Reset</Button>
                             </div>
                             <p className="text-xs text-white leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">{result.caption}</p>
                        </div>
                        {/* ... (rest of the result state UI) */}
                    </div>
                )}
                
                <p className="text-[9px] text-center text-muted-foreground italic">
                    AI Creator Copilot is being fine-tuned for better performance.
                </p>
            </CardContent>
        </Card>
    );
}
