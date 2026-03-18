
"use client";

import { ReactNode } from 'react';
import { Web3ModalProvider } from '@/lib/web3modal';
import { TonConnectUIProvider as OriginalTonConnectUIProvider } from '@tonconnect/ui-react';

export function CombinedProviders({ children }: { children: ReactNode }) {
    return (
        <Web3ModalProvider>
            <OriginalTonConnectUIProvider manifestUrl="https://unverse-ai.vercel.app/api/tonconnect-manifest">
                {children}
            </OriginalTonConnectUIProvider>
        </Web3ModalProvider>
    );
}
