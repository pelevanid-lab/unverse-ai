const fs = require('fs');
const path = require('path');

const pagePath = path.join('c:', 'Users', 'enesp', 'unverse-ai', 'src', 'app', 'page.tsx');
const tokenomicsPath = path.join('c:', 'Users', 'enesp', 'unverse-ai', 'src', 'app', 'tokenomics', 'page.tsx');

let pageContent = fs.readFileSync(pagePath, 'utf8');
let tokenomicsContent = fs.readFileSync(tokenomicsPath, 'utf8');

const heroRegex = /([ \t]*\{\/\* Hero Section \*\/\}\r?\n[ \t]*<section className="relative pt-10 md:pt-20 overflow-hidden">[\s\S]*?<\/section>\r?\n\r?\n)/m;

const match = pageContent.match(heroRegex);
if (!match) {
  console.error("Hero section not found on page.tsx!");
  process.exit(1);
}

const heroCode = match[1];

// 1. Remove from page.tsx
pageContent = pageContent.replace(heroCode, '');

// update imports in page.tsx
pageContent = pageContent.replace(
  /import \{ Sparkles, Zap, ShieldCheck, TrendingUp, Globe, Coins, ArrowRight, Play \} from 'lucide-react';\r?\nimport Image from 'next\/image';\r?\nimport \{ AnimatedText \} from '@\/components\/landing\/AnimatedText';/,
  "import { Sparkles, ShieldCheck, TrendingUp, Globe, Coins, ArrowRight } from 'lucide-react';"
);

// 2. Add to tokenomics.tsx
// Add imports
const newImports = `import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';
import { AnimatedText } from '@/components/landing/AnimatedText';
import { Play, ArrowRight, Zap } from 'lucide-react';
`;
tokenomicsContent = tokenomicsContent.replace(
  /"use client"\r?\n\r?\n/,
  `"use client"\n\n${newImports}`
);

// Add component body
tokenomicsContent = tokenomicsContent.replace(
  /export default function TokenomicsPage\(\) \{\r?\n  return \(\r?\n    <div className="space-y-12 pb-20">\r?\n      <header/,
  `export default function TokenomicsPage() {
  const { isConnected, connectWallet } = useWallet();

  return (
    <div className="space-y-12 pb-20">
${heroCode}      <header`
);

fs.writeFileSync(pagePath, pageContent, 'utf8');
fs.writeFileSync(tokenomicsPath, tokenomicsContent, 'utf8');
console.log("Migration script complete.");
