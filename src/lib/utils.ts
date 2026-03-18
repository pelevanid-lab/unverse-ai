import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getTxUrl = (txHash: string, network?: string) => {
    if (network === 'TON') {
        return `https://tonscan.org/tx/${txHash}`;
    }
    // Default to TRON
    return `https://tronscan.org/#/transaction/${txHash}`;
};

export const formatAddress = (address: string, start = 6, end = 4) => {
    if (!address) return ''
    return `${address.substring(0, start)}...${address.substring(address.length - end)}`
};