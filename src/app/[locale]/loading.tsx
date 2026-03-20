
import { Loader2, Zap } from 'lucide-react';

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="Unverse" className="w-full h-full object-cover scale-[1.6]" style={{ mixBlendMode: 'screen' }} />
          </div>
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-headline font-bold animate-pulse">Synchronizing Unverse</h2>
        <p className="text-sm text-muted-foreground font-mono">Ledger confirmation in progress...</p>
      </div>
    </div>
  );
}
