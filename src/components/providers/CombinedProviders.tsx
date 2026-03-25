
"use client";

import { ReactNode } from 'react';
import { Web3ModalProvider } from '@/lib/web3modal';

export function CombinedProviders({ children }: { children: ReactNode }) {
    return (
        <Web3ModalProvider>
            {children}
        </Web3ModalProvider>
    );
}
