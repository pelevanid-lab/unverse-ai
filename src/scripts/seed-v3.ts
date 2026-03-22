import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const investor_v3 = {
  title: "Unverse AI",
  subtitle: "The Future of Creator Economy",
  slides: [
    {
      id: "inv-1",
      order: 1,
      title: "The Future of Creator Economy",
      description: "Traditional platforms exploit creators. Unverse makes creators owners.",
      slogan: "We combine creativity with financial freedom."
    },
    {
      id: "inv-2",
      order: 2,
      title: "M-Floor Protocol",
      description: "Dynamic price floor targeting 15M USDT ecosystem value.",
      bullets: [
        "Burn reduces supply",
        "Floor increases automatically",
        "Treasury-backed stability"
      ]
    },
    {
      id: "inv-3",
      order: 3,
      title: "Deflation Engine",
      description: "Every action reduces supply.",
      bullets: [
        "AI generation burns tokens",
        "Unlocks burn tokens",
        "Perfect edits burn tokens"
      ]
    },
    {
      id: "inv-4",
      order: 4,
      title: "Treasury & Buyback",
      description: "33% of platform revenue goes to buyback pool.",
      bullets: [
        "Continuous support",
        "Revenue-backed economy"
      ]
    },
    {
      id: "inv-5",
      order: 5,
      title: "Go-To-Market",
      bullets: [
        "3-phase presale",
        "Base network launch",
        "CEX listing strategy"
      ]
    },
    {
      id: "inv-6",
      order: 6,
      title: "Seal & Token Security",
      description: "Supply is permanently fixed.",
      bullets: [
        "No minting possible",
        "20-year vesting protection"
      ]
    }
  ]
};

const creator_v3 = {
  title: "Create. Monetize. Scale.",
  subtitle: "AI Powered Creator Economy",
  slides: [
    {
      id: "cre-1",
      order: 1,
      title: "Elite Creator Program",
      description: "Only first 100 creators join the elite club.",
      bullets: [
        "milestone rewards",
        "exclusive benefits",
        "early advantage"
      ]
    },
    {
      id: "cre-2",
      order: 2,
      title: "AI Studio",
      description: "No skills required. Just imagine.",
      bullets: [
        "instant content generation",
        "premium-ready visuals"
      ]
    },
    {
      id: "cre-3",
      order: 3,
      title: "85/15 Revenue Model",
      description: "You earn instantly.",
      bullets: [
        "85% creator share",
        "no delays",
        "direct earnings"
      ]
    },
    {
      id: "cre-4",
      order: 4,
      title: "Unverse Copilot",
      description: "Your AI manager.",
      bullets: [
        "content optimization",
        "trend analysis",
        "smart editing"
      ]
    },
    {
      id: "cre-5",
      order: 5,
      title: "Grow With the Platform",
      description: "Your tokens grow as ecosystem grows.",
      bullets: [
        "vesting benefits",
        "long-term value"
      ]
    }
  ]
};

async function seed() {
  try {
    await setDoc(doc(db, 'presentations', 'investor_v3'), investor_v3);
    await setDoc(doc(db, 'presentations', 'creator_v3'), creator_v3);
    console.log("Seeding v3 completed successfully.");
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seed();
