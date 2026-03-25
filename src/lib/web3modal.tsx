"use client";

import { createWeb3Modal, defaultWagmiConfig } from '@web3modal/wagmi/react'
import { mainnet, base } from 'wagmi/chains'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react';

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get a project ID from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'a733f5f390c757fdad16512459e2286c'

// 2. Create wagmiConfig
const metadata = {
  name: 'Unverse',
  description: 'Unverse - AI-Powered Content Universe',
  url: 'https://unverse.me',
  icons: ['https://unverse.me/icon.png']
}

export const config = defaultWagmiConfig({
  chains: [base, mainnet],
  projectId,
  metadata,
  ssr: true, // Enable SSR support
})

// 3. Create modal - Initialize only on client at module level
export let modal: any = null;

if (typeof window !== 'undefined') {
  modal = createWeb3Modal({
    wagmiConfig: config,
    projectId,
    enableAnalytics: true,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#0052FF',
      '--w3m-border-radius-master': '2px'
    }
  });
}

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted && children}
        {!mounted && <div className="hidden">{children}</div>}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
