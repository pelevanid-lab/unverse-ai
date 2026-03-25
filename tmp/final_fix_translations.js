const fs = require('fs');
const path = require('path');

const enPath = 'c:\\Users\\enesp\\unverse-ai\\messages\\en.json';
const trPath = 'c:\\Users\\enesp\\unverse-ai\\messages\\tr.json';

const PRO_KEYS = [
    "directorMode", "directorModeDesc", "unlockPro", "unlockProDesc", "clothingFlex",
    "sheerLingerie", "satinSilks", "wetShirt", "provocativeLace", "highLegBodysuit",
    "strategicCoverage", "sultryBoudoir", "exoticBeachwear", "distressedDenim",
    "leatherLace", "deepPlunge", "ultraHighCut", "openFront", "monokiniExotic",
    "eroticPoses", "backReveal", "strategicCover", "silkProne", "sultryArch",
    "kneelingSeduction", "sideRecumbent", "leaningSilhouette", "recliningPose", "proActive"
];

function fixFile(filePath, isTR) {
    let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // 1. Move Pro Keys to Muse if they exist elsewhere, or ensure they are in Muse
    if (!data.Muse) data.Muse = {};
    
    const translations = isTR ? {
        directorMode: "Yönetmen Modu",
        directorModeDesc: "Kusursuz çekim için kompozisyon, açı, ruh hali ve ışığı kontrol edin.",
        unlockPro: "Uniq Pro'yu Aktif Et",
        unlockProDesc: "Erotik ve ekzotik yaratıcı kontrolleri etkinleştir.",
        clothingFlex: "Kıyafet Esnekliği",
        sheerLingerie: "Şeffaf Dantel",
        satinSilks: "Saten İpek",
        wetShirt: "Islak Gömlek",
        provocativeLace: "Kışkırtıcı Dantel",
        highLegBodysuit: "Yüksek Kesim Bodysuit",
        strategicCoverage: "Stratejik Kapama",
        sultryBoudoir: "Seksi Yatak Odası",
        exoticBeachwear: "Egzotik Plaj Giyimi",
        distressedDenim: "Üstsüz & Denim",
        leatherLace: "Deri ve Dantel",
        deepPlunge: "Derin Dekolte",
        ultraHighCut: "Yüksek Bacak Kesim",
        openFront: "Önü Açık Tasarım",
        monokiniExotic: "Egzotik Monokini",
        eroticPoses: "İleri Seviye Pozlar",
        backReveal: "Omuz Üstü Bakış",
        strategicCover: "Artistik Kapama",
        silkProne: "İpek Üstünde",
        sultryArch: "Seksi Kavis",
        kneelingSeduction: "Diz Çökmüş",
        sideRecumbent: "Yan Yatan",
        leaningSilhouette: "Gölge Silüet",
        recliningPose: "Arkaya Yaslanan",
        proActive: "Uniq Pro Aktif"
    } : {
        directorMode: "Director Mode",
        directorModeDesc: "Control composition, angle, mood, and lighting for the perfect shot.",
        unlockPro: "Unlock Uniq Pro",
        unlockProDesc: "Enable erotic and exotic creative controls.",
        clothingFlex: "Clothing Flexibility",
        sheerLingerie: "Sheer Lingerie",
        satinSilks: "Satin Silks",
        wetShirt: "Wet Shirt",
        provocativeLace: "Provocative Lace",
        highLegBodysuit: "High-Leg Bodysuit",
        strategicCoverage: "Strategic Coverage",
        sultryBoudoir: "Sultry Boudoir",
        exoticBeachwear: "Exotic Beachwear",
        distressedDenim: "Distressed Denim",
        leatherLace: "Leather & Lace",
        deepPlunge: "Deep Plunge",
        ultraHighCut: "Ultra-High Cut",
        openFront: "Open Front",
        monokiniExotic: "Exotic Monokini",
        eroticPoses: "Advanced Poses",
        backReveal: "Back Reveal",
        strategicCover: "Strategic Cover",
        silkProne: "Prone on Silk",
        sultryArch: "Sultry Arch",
        kneelingSeduction: "Kneeling",
        sideRecumbent: "Side Recumbent",
        leaningSilhouette: "Leaning Silhouette",
        recliningPose: "Reclining",
        proActive: "Uniq Pro Active"
    };

    PRO_KEYS.forEach(key => {
        data.Muse[key] = translations[key];
        // Remove from other namespaces
        if (data.MyPage) delete data.MyPage[key];
        if (data.EditMedia) delete data.EditMedia[key];
    });
    
    // Remove duplicates/old keys in Muse
    delete data.Muse.semiNude;
    delete data.Muse.wetLook;
    delete data.Muse.changeOutfit;
    delete data.Muse.saveAndVariations; // Redundant if variationOptions is there

    // 2. Fix MyPage Dashboard keys
    if (!data.MyPage) data.MyPage = {};
    data.MyPage.creatorPanel = isTR ? "Yaratıcı Paneli" : "Creator Panel";
    data.MyPage.becomeCreator = isTR ? "Yaratıcı Ol" : "Become a Creator";
    data.MyPage.myWallet = isTR ? "Cüzdanım" : "My Wallet";
    data.MyPage.availableBalance = isTR ? "Mevcut Bakiye" : "Available Balance";
    data.MyPage.totalEarnings = isTR ? "Toplam Kazanç" : "Total Earnings";
    data.MyPage.totalSpent = isTR ? "Toplam Harcanan" : "Total Spent";

    // 3. Fix EditMedia
    if (!data.EditMedia) data.EditMedia = {};
    data.EditMedia.proContentRestriction = isTR ? "Uniq Pro İçerik Kısıtlaması" : "Uniq Pro Content Restriction";

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

fixFile(enPath, false);
fixFile(trPath, true);
console.log('Fixed both en.json and tr.json');
