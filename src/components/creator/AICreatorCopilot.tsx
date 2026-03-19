
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Wand2, Lightbulb, Coins } from 'lucide-react';
import { creatorCopilotFlow } from '@/ai/flows/creator-copilot-flow';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

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
        if (!idea.trim()) {
            toast({ title: "Idea Required", description: "Please enter a short description of your content." });
            return;
        }

        setLoading(true);
        try {
            // Using Genkit flow directly from client (if configured) or via server action
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
                <div className="flex items-center gap-2 text-primary">
                    <div className="bg-primary p-1.5 rounded-lg">
                        <Sparkles className="w-4 h-4 text-white fill-current" />
                    </div>
                    <span className="font-headline font-black text-sm uppercase tracking-widest">Creator Copilot</span>
                </div>

                {!result ? (
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">What is your content about?</Label>
                            <Textarea 
                                value={idea}
                                onChange={(e) => setIdea(e.target.value)}
                                placeholder="Describe your photo or video in a few words..."
                                className="bg-background/50 border-white/10 text-xs resize-none h-16 rounded-xl"
                            />
                        </div>
                        <Button onClick={handleGenerate} disabled={loading} className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs gap-2">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                            Generate with AI
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Suggested Caption</Label>
                                <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="h-6 text-[10px] opacity-50">Reset</Button>
                             </div>
                             <p className="text-xs text-white leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">{result.caption}</p>
                        </div>

                        {contentType !== 'public' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Coins className="w-3 h-3 text-primary" /> Suggested Price</Label>
                                    <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 font-black text-primary text-center">
                                        {result.suggestedPriceULC} ULC
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Lightbulb className="w-3 h-3 text-yellow-400" /> Advice</Label>
                                    <p className="text-[9px] text-muted-foreground leading-tight italic">{result.explanation}</p>
                                </div>
                            </div>
                        )}

                        <Button onClick={() => onApply({ caption: result.caption, price: result.suggestedPriceULC })} className="w-full h-10 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-xs uppercase tracking-widest">
                            Apply to Post
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
