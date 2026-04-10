#!/usr/bin/env node
/**
 * 🎮 Unverse: The Infinite Hunt — Firestore Seed Script
 * Seeds the Alexandria Library universe with 6 treasure chests.
 *
 * Usage: node scripts/seed-game.mjs
 *
 * Requires env: NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

// ── Init Admin ──────────────────────────────────────────────
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    .replace(/^"(.*)"$/, '$1');

if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase env vars. Check .env.local');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

// ── Helpers ─────────────────────────────────────────────────
function hashAnswer(answer) {
    const normalized = answer.toLowerCase().trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ── UNIVERSE ────────────────────────────────────────────────
const UNIVERSE = {
    id: 'alexandria',
    name: 'Library of Alexandria',
    tagline: 'Ancient secrets hidden in the folds of time await you.',
    description: 'Built in the 3rd century BC, this legendary library housed humanity\'s greatest knowledge. Some works lost in the fire were never found — until now.',
    lore: 'In 48 BC when Caesar\'s armies entered Alexandria, chief archivist Apollodorus and five assistants hid the most valuable manuscripts. Among them was a papyrus that would change humanity\'s future — a precursor to what Satoshi Nakamoto would one day write. This papyrus maintains its connection to the digital age. Find it. Open it. Earn it.',
    atmosphereType: 'ancient',
    status: 'active',
    coverImageUrl: '/game/universe-alexandria-cover.jpg',
    ambientTheme: '#b7971a',
    totalChests: 6,
    chestsOpened: 0,
    totalRewardULC: 0,
    createdAt: Date.now(),
    sortOrder: 1,
};

// ── CHESTS ──────────────────────────────────────────────────
const CHESTS = [
    {
        id: 'chest-alexandria-001',
        universeId: 'alexandria',
        name: "Satoshi's Papyrus",
        description: "The oldest version of a manifesto that shaped humanity's economic destiny is hidden here.",
        lore: "Apollodorus placed this papyrus in a separate room from the others. It bore seven seals — each a mathematical question. When the last seal was broken, the knowledge would transfer to the digital realm.",
        rarity: 'genesis',
        status: 'sealed',
        baseRewardULC: 50000,
        explorerBonusULC: 500,
        clues: [
            {
                id: 'clue-001-1',
                order: 1,
                text: 'The oldest record in the archive points to a number sequence: 21, 18, 15, 12... What is the next link?',
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-001-2',
                order: 2,
                text: 'The Greek inscription on the seal says: "Peer-to-peer design for secure communication over insecure channels." In what year was this written?',
                costULC: 10,
                burnRatio: 1.0,
            },
            {
                id: 'clue-001-3',
                order: 3,
                text: 'Final clue: Satoshi Nakamoto sent a white paper titled "Bitcoin: A Peer-to-Peer Electronic Cash System" to a cryptography mailing list. What was the exact date? (DD/MM/YYYY)',
                costULC: 50,
                burnRatio: 0.5,
            },
        ],
        answerHash: hashAnswer('31 10 2008'),
        nftRewardId: 'nft-genesis-scroll-001',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 1,
    },
    {
        id: 'chest-alexandria-002',
        universeId: 'alexandria',
        name: "Euclid's Lost Theorem",
        description: "Was the missing 14th book of Euclid's 'Elements' on this shelf?",
        lore: "Mathematics history's greatest mystery: Euclid wrote 13 books. But some historians mention a 14th. This chest contains the last chapter of that lost book.",
        rarity: 'legendary',
        status: 'sealed',
        baseRewardULC: 10000,
        explorerBonusULC: 200,
        clues: [
            {
                id: 'clue-002-1',
                order: 1,
                text: 'In Euclidean geometry, what is the ratio of a circle\'s circumference to its diameter? (write as symbol)',
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-002-2',
                order: 2,
                text: 'The number on the left side of the shelf: 2, 3, 5, 8, 13, 21... What comes next?',
                costULC: 10,
                burnRatio: 1.0,
            },
            {
                id: 'clue-002-3',
                order: 3,
                text: "Final clue: How many books does Euclid's 'Elements' consist of?",
                costULC: 50,
                burnRatio: 0.5,
            },
        ],
        answerHash: hashAnswer('13'),
        nftRewardId: 'nft-eulers-lens',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 2,
    },
    {
        id: 'chest-alexandria-003',
        universeId: 'alexandria',
        name: "Cleopatra's Seal",
        description: "A sealed scroll stored in the Pharaoh's private archive, carrying royal secrets.",
        lore: "Cleopatra VII was considered the library's patron. Documents stored in her secret archive contain her true name — the Hellenic version in her birth record.",
        rarity: 'rare',
        status: 'sealed',
        baseRewardULC: 5000,
        explorerBonusULC: 100,
        clues: [
            {
                id: 'clue-003-1',
                order: 1,
                text: "What is Cleopatra VII's full Hellenic name? (first word only)",
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-003-2',
                order: 2,
                text: 'In hieroglyphic writing, which symbol represents the sun god Ra? (A: Sun Disk / B: Eagle / C: Scarab / D: Uraeus)',
                costULC: 10,
                burnRatio: 1.0,
            },
        ],
        answerHash: hashAnswer('kleopatra'),
        nftRewardId: 'nft-asp-dagger',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 3,
    },
    {
        id: 'chest-alexandria-004',
        universeId: 'alexandria',
        name: "Helena's Journal",
        description: "The personal journal of the library's first female archivist was long thought lost.",
        lore: "Helena never surrendered the key to the library's most secret room. She had encoded the name of this room in her journal — the name was also that of a mythological character.",
        rarity: 'uncommon',
        status: 'sealed',
        baseRewardULC: 2000,
        explorerBonusULC: 50,
        clues: [
            {
                id: 'clue-004-1',
                order: 1,
                text: "In Greek mythology, what is the name of the beauty who caused the Trojan War?",
                costULC: 0,
                burnRatio: 0,
            },
        ],
        answerHash: hashAnswer('helena'),
        nftRewardId: 'nft-scholars-robe',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 4,
    },
    {
        id: 'chest-alexandria-005',
        universeId: 'alexandria',
        name: "Alexander's Map",
        description: "A mysterious map showing Alexander's conquered territories — with coded coordinates.",
        lore: "Alexander built a library in every territory he conquered. This map is not just geographic — each coordinate corresponds to the title of a book. The final coordinate is the heart of the library.",
        rarity: 'rare',
        status: 'sealed',
        baseRewardULC: 5000,
        explorerBonusULC: 100,
        clues: [
            {
                id: 'clue-005-1',
                order: 1,
                text: "After conquering which city did Alexander the Great found Alexandria? (nearby city)",
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-005-2',
                order: 2,
                text: "Who was Alexander's tutor, considered the father of logic and philosophy?",
                costULC: 10,
                burnRatio: 1.0,
            },
        ],
        answerHash: hashAnswer('aristotle'),
        nftRewardId: 'nft-conquerors-helm',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 5,
    },
    {
        id: 'chest-alexandria-006',
        universeId: 'alexandria',
        name: "The Secret of Hermes Trismegistus",
        description: "A mystical tablet attributed to the founder of alchemy and hermetic science.",
        lore: '"As above, so below." — Hermes Trismegistus. This tablet claims all of science can be reduced to a single sentence.',
        rarity: 'legendary',
        status: 'sealed',
        baseRewardULC: 10000,
        explorerBonusULC: 200,
        clues: [
            {
                id: 'clue-006-1',
                order: 1,
                text: "In what language is the sacred hermetic text 'The Emerald Tablet' claimed to have been written?",
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-006-2',
                order: 2,
                text: "\"As above, so below\" is the core principle of hermeticism. What is the one-word Latin name for this principle?",
                costULC: 10,
                burnRatio: 1.0,
            },
        ],
        answerHash: hashAnswer('hermeticism'),
        nftRewardId: 'nft-emerald-tablet',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 6,
    },
];

// ── Difficulty config default ───────────────────────────────
const DIFFICULTY_STATE = {
    baseDifficulty: 1.0,
    currentDifficulty: 1.0,
    activeHunters: 0,
    totalChestsOpened: 0,
    lastAdjustmentAt: Date.now(),
    adjustmentPeriod: 100,
};

// ── Seed ────────────────────────────────────────────────────
async function seed() {
    console.log('🌌 Seeding Alexandria Library universe...\n');

    // Universe
    await db.doc(`universes/${UNIVERSE.id}`).set(UNIVERSE);
    console.log(`✅ Universe: ${UNIVERSE.name}`);

    // Chests
    for (const chest of CHESTS) {
        await db.doc(`chests/${chest.id}`).set(chest);
        console.log(`  📦 Chest ${chest.sortOrder}: ${chest.name} (${chest.rarity}) — ${chest.baseRewardULC.toLocaleString()} ULC`);
    }

    // Difficulty config (only if not exists)
    const diffRef = db.doc('config/game_difficulty');
    const diffSnap = await diffRef.get();
    if (!diffSnap.exists) {
        await diffRef.set(DIFFICULTY_STATE);
        console.log('\n✅ Difficulty config initialized (1.0x)');
    } else {
        console.log('\n⚠️  Difficulty config already exists — skipped');
    }

    console.log('\n🎉 Seed complete! 1 universe + 6 chests ready.\n');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
