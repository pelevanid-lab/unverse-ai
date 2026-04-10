import crypto from 'crypto';
import { Universe, TreasureChest } from '@/lib/types';

// Helper: hash a normalized answer for the chest
function hashAnswer(answer: string): string {
    const normalized = answer.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ============================================================
// 🌌 İSKENDERİYE KÜTÜPHANESİ — Seed Data
// ============================================================

export const ALEXANDRIA_UNIVERSE: Omit<Universe, 'id'> = {
    name: 'İskenderiye Kütüphanesi',
    tagline: 'Zamanın kıvrımlarına gizlenmiş bilge sırları seni bekliyor.',
    description: 'M.Ö. 3. yüzyılda inşa edilen bu efsanevi kütüphane, insanlığın en büyük bilgi hazinesini barındırıyordu. Yangında kaybolan bazı eserler hiçbir zaman bulunamadı — ta ki şimdi kadar.',
    lore: `M.Ö. 48 yılında Sezar'ın orduları İskenderiye'ye girdiğinde, kütüphanenin baş arşivisti Apollodoros ve beş yardımcısı en değerli eserleri gizledi. Aralarında insanlığın geleceğini değiştirecek bir papirüs vardı — asırlarca sonra Satoshi Nakamoto'nun elinden çıkacak olan Bitcoin manifestosunun öncüsü. Bu papirüs, dijital çağın şifreli evreniyle bağlantısını koruyor. Bul, aç, kazan.`,
    atmosphereType: 'ancient',
    status: 'active',
    coverImageUrl: '/game/universe-alexandria-cover.jpg',
    ambientTheme: '#b7971a', // golden amber
    totalChests: 6,
    chestsOpened: 0,
    totalRewardULC: 0,
    createdAt: Date.now(),
    sortOrder: 1,
};

export const ALEXANDRIA_CHESTS: Omit<TreasureChest, 'id'>[] = [
    // ───────────────────────────────────────────
    // KASA 001 — Satoshi'nin Papirüsü (GENESIS)
    // ───────────────────────────────────────────
    {
        universeId: 'alexandria',
        name: "Satoshi'nin Papirüsü",
        description: 'İnsanlığın ekonomik kaderine damgasını vuran bir manifestonun en eski versiyonu burada gizli.',
        lore: 'Apollodoros, bu papirüsü diğerlerinden farklı bir odaya gömdü. Üzerinde yedi mühür vardı — her biri bir matematik sorusu. Son mühür kırıldığında, bilgiler dijital evrene aktarılmış olacaktı.',
        rarity: 'genesis',
        status: 'sealed',
        baseRewardULC: 50000,
        explorerBonusULC: 500,
        clues: [
            {
                id: 'clue-001-1',
                order: 1,
                text: 'Arşivideki en eski kayıt, bir sayı dizisine işaret ediyor: 21, 18, 15, 12... Son halka nedir?',
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-001-2',
                order: 2,
                text: 'Mühürün üzerindeki Yunanca yazıt şunu söylüyor: "Güvensiz kanallar üzerinde güvenli iletişim için eşdüzey tasarım." Bu hangi yılda yazıldı?',
                costULC: 10,
                burnRatio: 1.0, // 100% burn
            },
            {
                id: 'clue-001-3',
                order: 3,
                text: 'Son ipucu: "Satoshi Nakamoto", "Bitcoin: A Peer-to-Peer Electronic Cash System" başlıklı beyaz kağıdı bir e-posta listesine gönderdi. Tam tarih neydi? (GG/AA/YYYY)',
                costULC: 50,
                burnRatio: 0.5, // 50% burn, 50% treasury
            },
        ],
        answerHash: hashAnswer('31 10 2008'),   // 31/10/2008
        nftRewardId: 'nft-genesis-scroll-001',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 1,
    },

    // ───────────────────────────────────────────
    // KASA 002 — Öklid'in Kayıp Teoremi (LEGENDARY)
    // ───────────────────────────────────────────
    {
        universeId: 'alexandria',
        name: "Öklid'in Kayıp Teoremi",
        description: "Öklid'in 'Elementler' kitabından eksik olan 14. kitabı bu rafta mıydı?",
        lore: 'Matematik tarihinin en büyük gizemi: Öklid 13 kitap yazdı. Ama bazı tarihçiler 14. bir kitaptan söz eder. Bu kasa, o kayıp kitabın son bölümünü içeriyor.',
        rarity: 'legendary',
        status: 'sealed',
        baseRewardULC: 10000,
        explorerBonusULC: 200,
        clues: [
            {
                id: 'clue-002-1',
                order: 1,
                text: 'Öklid geometrisinde, bir çemberin çevresinin çapına oranı nedir? (Sembolle yaz)',
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-002-2',
                order: 2,
                text: 'Rafın sol tarafındaki sayı: 2, 3, 5, 8, 13, 21... Sıradaki nedir?',
                costULC: 10,
                burnRatio: 1.0,
            },
            {
                id: 'clue-002-3',
                order: 3,
                text: "Öklid'in doğum yeri olarak kabul edilen antik şehir — Megara. Soruya cevap: 'Elementler' kaç kitaptan oluşur?",
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

    // ───────────────────────────────────────────
    // KASA 003 — Kleopatra'nın Mühürü (RARE)
    // ───────────────────────────────────────────
    {
        universeId: 'alexandria',
        name: "Kleopatra'nın Mühürü",
        description: 'Firavunun özel arşivinde saklanan, kraliyet sırlarını taşıyan mühürlü bir tomar.',
        lore: 'Kleopatra VII, kütüphanenin hamisi sayılırdı. Gizli arşivinde sakladığı belgeler onun gerçek adını —doğum sicilindeki Hellence versiyonunu— içeriyor.',
        rarity: 'rare',
        status: 'sealed',
        baseRewardULC: 5000,
        explorerBonusULC: 100,
        clues: [
            {
                id: 'clue-003-1',
                order: 1,
                text: "Kleopatra VII'nin tam Hellence adı nedir? (İlk kelime yeterli)",
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-003-2',
                order: 2,
                text: 'Hiyeroglif yazısında güneş tanrısı Ra hangi sembolle temsil edilir? (A / B / C / D seçeneklerini düşün: Güneş diski, Kartal, Skarabeus, Uraeus)',
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

    // ───────────────────────────────────────────
    // KASA 004 — Helena'nın Günlüğü (UNCOMMON)
    // ───────────────────────────────────────────
    {
        universeId: 'alexandria',
        name: "Helena'nın Günlüğü",
        description: 'Kütüphanenin ilk kadın arşivcisinin kişisel günlüğü yıllarca kayıp sanıldı.',
        lore: 'Helena, kütüphanenin en gizli odasının anahtarını hiçbir zaman vermedi. Günlüğünde bu odanın adını şifrelemişti — onun adı aynı zamanda bir mitolojik karakterin adıydı.',
        rarity: 'uncommon',
        status: 'sealed',
        baseRewardULC: 2000,
        explorerBonusULC: 50,
        clues: [
            {
                id: 'clue-004-1',
                order: 1,
                text: 'Yunan mitolojisinde Truva Savaşı\'na neden olan güzelin adı nedir?',
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

    // ───────────────────────────────────────────
    // KASA 005 — Büyük İskender'in Haritası (RARE)
    // ───────────────────────────────────────────
    {
        universeId: 'alexandria',
        name: "Büyük İskender'in Haritası",
        description: 'İskender\'in fathettiği toprakları gösteren gizemli bir harita — üzerinde şifreli koordinatlar.',
        lore: 'İskender, fethettiği her toprakta kütüphane kurdu. Bu harita sadece coğrafi değil — her koordinat bir kitabın başlığına karşılık geliyor. Son koordinat kütüphanenin kalbi.',
        rarity: 'rare',
        status: 'sealed',
        baseRewardULC: 5000,
        explorerBonusULC: 100,
        clues: [
            {
                id: 'clue-005-1',
                order: 1,
                text: 'Büyük İskender hangi şehri fethettikten sonra İskenderiye\'yi kurdu? (Yakın şehir)',
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-005-2',
                order: 2,
                text: 'İskender\'in hocası, mantık ve felsefenin babası sayılan kişi kimdir?',
                costULC: 10,
                burnRatio: 1.0,
            },
        ],
        answerHash: hashAnswer('aristoteles'),
        nftRewardId: 'nft-conquerors-helm',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 5,
    },

    // ───────────────────────────────────────────
    // KASA 006 — Hermes Trismegistus'un Sırrı (LEGENDARY)
    // ───────────────────────────────────────────
    {
        universeId: 'alexandria',
        name: "Hermes Trismegistus'un Sırrı",
        description: 'Simya ve hermetik bilimin kurucusuna atfedilen mistik bir tablet.',
        lore: '"Yukarıdaki aşağıdaki gibidir, aşağıdaki yukarıdaki gibi." — Hermes Trismegistus. Bu tablet, tüm bilimin tek bir cümleye indirgenebildiğini iddia ediyor.',
        rarity: 'legendary',
        status: 'sealed',
        baseRewardULC: 10000,
        explorerBonusULC: 200,
        clues: [
            {
                id: 'clue-006-1',
                order: 1,
                text: 'Hermetizmin kutsal metni "Zümrüt Tablet" hangi dilde yazıldığı iddia edilir?',
                costULC: 0,
                burnRatio: 0,
            },
            {
                id: 'clue-006-2',
                order: 2,
                text: '"Hermes Trismegistus" adı Yunan harfleriyle yazıldığında kaç harf içerir? (hermes = 6, trismegistos = ?)',
                costULC: 10,
                burnRatio: 1.0,
            },
            {
                id: 'clue-006-3',
                order: 3,
                text: 'Zümrüt Tablet\'in içeriğini açıklayan tek kelime — Simyacıların en temel prensibi. Latincesi: "As above, so below" = Türkçesi nedir? (iki kelime)',
                costULC: 50,
                burnRatio: 0.5,
            },
        ],
        answerHash: hashAnswer('hermetizm'),
        nftRewardId: 'nft-emerald-tablet',
        totalAttempts: 0,
        totalExplorers: 0,
        createdAt: Date.now(),
        sortOrder: 6,
    },
];
