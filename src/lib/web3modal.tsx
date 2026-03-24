"use client";

import { createWeb3Modal } from '@web3modal/wagmi/react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { mainnet, base } from 'wagmi/chains'
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors'
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
  url: 'https://unverse-ai.vercel.app',
  icons: ['https://unverse-ai.vercel.app/icon.png']
}

export const config = createConfig({
  chains: [base, mainnet],
  multiInjectedProviderDiscovery: true,
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
  connectors: [
    coinbaseWallet({ 
      appName: 'Unverse',
      preference: 'all', // Shows both Smart Wallet and Extension
    }),
    walletConnect({ projectId, metadata, showQrModal: false }),
    injected({ shimDisconnect: true }),
  ],
})

// 3. Create modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
  enableOnramp: true,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#0052FF',
    '--w3m-border-radius-master': '2px'
  }
});

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
