# Unverse AI: Kapsamlı Tokenomik ve Ledger Denetim Raporu

Bu rapor, Unverse platformunun ekonomik temelini, hakediş (vesting) yapılarını ve teknik uygulama tutarlılığını doğrulamak amacıyla hazırlanmıştır. Kod tabanı (Cloud Functions & Frontend) ve canlı veritabanı (Firestore) arasındaki uyum %100'dür.

---

## 1. Toplam Arz ve Havuz Dağılımı (Total Supply: 1 Milyar ULC)

Ekonomi mühürlendiğinde (Seal) toplam 1.000.000.000 ULC baz alınır. Dağılım aşağıdaki gibidir:

| Havuz Adı | Miktar (Milyon ULC) | Pay (%) | Kullanım Amacı |
| :--- | :--- | :--- | :--- |
| **Reserve** | 420.0M | 42% | Ekosistem güvenliği ve uzun vadeli sürdürülebilirlik. |
| **Team** | 130.0M | 13% | Çekirdek ekip ve geliştirme teşvikleri. |
| **Creators** | 120.0M | 12% | Yaratıcı teşvikleri ve milestone ödülleri. |
| **Presale** | 100.0M | 10% | Ön satış yatırımcıları. |
| **Staking** | 80.0M | 8% | Platform içi stake ödülleri. |
| **Liquidity** | 60.0M | 6% | DEX/CEX likidite havuzları. |
| **Promo** | 50.0M | 5% | Hoş geldin bonusları ve anlık teşvikler. |
| **Exchanges** | 40.0M | 4% | Borsa listelemeleri. |

> [!IMPORTANT]
> **Kontrol Sonucu:** `src/lib/ledger.ts` (SyncAction) ve Firestore `config/system` verileri tam uyumludur.

---

## 2. Hakediş ve Kilit Mekanizmaları (Vesting & Cliff)

Yatırımcı koruması ve kıtlık yönetimi için uygulanan vesting kuralları:

| Havuz | Bekleme (Cliff) | Süre (Duration) | Salınım Tipi |
| :--- | :--- | :--- | :--- |
| **Reserve** | 0 Ay | 240 Ay (20 Yıl) | Doğrusal (Linear) |
| **Team** | 0 Ay | 36 Ay (3 Yıl) | Doğrusal (Linear) |
| **Creators** | 0 Ay | 24 Ay (2 Yıl) | Doğrusal (Linear) |
| **Presale** | 12 Ay | 24 Ay (2 Yıl) | Cliff + Doğrusal |
| **Incentive** | 0 Ay | 24 Ay (2 Yıl) | Doğrusal (%70'lik kilitli kısım) |

---

## 3. İlk 100 Yaratıcı Teşvik Programı (Milestones)

Programın teknik split (bölünme) ve ödül mantığı:

*   **Hoş Geldin Ödülü:** 200 ULC.
*   **Milestone Ödülü:** Her 20 benzersiz premium kilit açma için +200 ULC.
*   **Maksimum Kapasite:** Yaratıcı başına toplam 1.000 ULC.
*   **Bölünme (Split):**
    *   **%30 (60 ULC):** Anında kullanılabilir (`pools.promo`'dan düşer).
    *   **%70 (140 ULC):** 24 ay vesting ile kilitli (`pools.creators`'dan düşer).

> [!TIP]
> Bu yapı, anlık likidite sağlarken aynı zamanda yaratıcıyı platformda 2 yıl boyunca tutacak bir sadakat mekanizması işlevi görür.

---

## 4. Dinamik Protokol Taban Fiyatı (M-Floor)

Fiyat hesaplama algoritması Firestore tarafında mühürlenmiştir:

*   **Formül:** `Price = Hedef_Kapitalizasyon (15M USDT) / (İlk_Arz (1B) - Yakılan)`
*   **Yakım Mekanizması:**
    *   AI Üretimi: 5 ULC (%70 Hazine / %30 Yakım -> 1.5 ULC yakılır).
    *   Premium Unlock: %15 platform payının %33'ü yakılır (~%5 toplam yakım).
*   **Fiyat Koruma:** Fiyat bu değerin altına düşerse, hazinedeki USDT bakiyesiyle otomatik geri alım (Buyback) tetiklenir.

---

## 5. Ledger (Defter) Kayıt Yapısı

Her ekonomik hareket `ledger` koleksiyonuna benzersiz bir `type` ile kaydedilir:
*   `genesis_allocation`: Havuzların başlatılması.
*   `creator_welcome_reward`: Teşvik programına katılım.
*   `creator_milestone_reward`: Performans ödülü.
*   `subscription_payment`: USDT bazlı abonelik geliri.
*   `ai_generation`: ULC bazlı üretim maliyeti.

---

## Sonuç ve Onay

Hem kod tarafındaki sabitler (`VESTING_PRESETS`) hem de Firestore'daki canlı konfigürasyon (`isSealed: false` durumunda bile) birbiriyle tutarlıdır. Ekonomi tasarlandığı gibi "Seal" tuşuna basıldığında otomatik olarak dinamik fiyatlama ve buyback moduna girmeye hazırdır.

**Durum:** 🚀 Görücüye çıkmaya hazır.
