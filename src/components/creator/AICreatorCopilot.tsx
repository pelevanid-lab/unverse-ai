
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, Wand2, Lightbulb, Coins, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { generateCaption } from '@/lib/CopilotEngine';

interface AICreatorCopilotProps {
    contentType: 'public' | 'premium' | 'limited';
    creatorName: string;
    onApply: (data: { caption: string; price?: number }) => void;
}

export function AICreatorCopilot({ contentType, creatorName, onApply }: AICreatorCopilotProps) {
    const [result, setResult] = useState<string | null>(null);

    const handleGenerate = () => {
        // DETERMINISTIC RULE-BASED GENERATION
        const caption = generateCaption("", contentType);
        setResult(caption);
    };

    return (
        <Card className="border-primary/20 bg-primary/5 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500 shadow-lg shadow-primary/5">
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                        <div className="bg-primary p-1.5 rounded-lg">
                            <Sparkles className="w-4 h-4 text-white fill-current" />
                        </div>
                        <span className="font-headline font-black text-sm uppercase tracking-widest">Creator Uniq</span>
                    </div>
                </div>

                {!result ? (
                    <div className="space-y-3">
                        <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                            Need help with a caption? Uniq can generate one based on your content type.
                        </p>
                        <Button onClick={handleGenerate} className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs gap-2">
                            <Wand2 className="w-4 h-4" />
                            Generate Caption
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Suggested Caption</Label>
                                <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="h-6 text-[10px] opacity-50 flex gap-1 items-center">
                                    <RotateCcw size={10} /> Reset
                                </Button>
                             </div>
                             <p className="text-xs text-white leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">{result}</p>
                        </div>

                        <Button onClick={() => onApply({ caption: result })} className="w-full h-10 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-xs uppercase tracking-widest">
                            Apply to Post
                        </Button>
                    </div>
                )}
                
                <p className="text-[9px] text-center text-muted-foreground italic opacity-60">
                    Rule-based Premium mode active. No AI tokens used.
                </p>
            </CardContent>
        </Card>
    );
}
