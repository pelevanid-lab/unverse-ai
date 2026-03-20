
"use client";

import { ReactNode } from 'react';
import { Web3ModalProvider } from '@/lib/web3modal';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

export function CombinedProviders({ children }: { children: ReactNode }) {
    return (
        <Web3ModalProvider>
            <TonConnectUIProvider manifestUrl="https://unverse-ai.vercel.app/api/tonconnect-manifest">
                {children}
            </TonConnectUIProvider>
        </Web3ModalProvider>
    );
}
