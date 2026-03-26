"use client";
 
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const Web3ModalProvider = dynamic(
    () => import('@/lib/web3modal').then(m => m.Web3ModalProvider),
    { ssr: false }
);
 
export function CombinedProviders({ children }: { children: ReactNode }) {
    return (
        <Web3ModalProvider>
            {children}
        </Web3ModalProvider>
    );
}
