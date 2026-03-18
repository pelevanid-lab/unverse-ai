"use client"; // Mark this as a Client Component

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'

import { WagmiProvider } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react';

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get a project ID from https://cloud.reown.com (formerly walletconnect)
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'a733f5f390c757fdad16512459e2286c'

// 2. Create wagmiConfig
const metadata = {
  name: 'Unverse',
  description: 'Unverse - AI-Powered Content Universe',
  url: 'https://unverse-ai.vercel.app',
  icons: ['https://unverse-ai.vercel.app/icon.png']
}

const chains = [mainnet, sepolia] as const
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// 3. Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: true
});

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
