
"use client";

import { ReactNode, useEffect, useState } from 'react';
import { Web3ModalProvider } from '@/lib/web3modal';
import { TonConnectUIProvider as OriginalTonConnectUIProvider } from '@tonconnect/ui-react';

export function CombinedProviders({ children }: { children: ReactNode }) {
    // We render everything but use a flag to handle TON Connect hydration specifically
    const [tonMounted, setTonMounted] = useState(false);

    useEffect(() => {
        setTonMounted(true);
    }, []);

    return (
        <Web3ModalProvider>
            {tonMounted ? (
                <OriginalTonConnectUIProvider manifestUrl="https://unverse-ai.vercel.app/api/tonconnect-manifest">
                    {children}
                </OriginalTonConnectUIProvider>
            ) : (
                <>{children}</>
            )}
        </Web3ModalProvider>
    );
}
