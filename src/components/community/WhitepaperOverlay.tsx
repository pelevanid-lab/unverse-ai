"use client"

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Book, Globe, Download, MousePointer2, ShieldCheck, Zap, Coins, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from 'next-intl';

interface WhitepaperOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WhitepaperOverlay({ isOpen, onClose }: WhitepaperOverlayProps) {
    const defaultLocale = useLocale();
    const [activeLang, setActiveLang] = useState<'en' | 'tr' | 'ru'>(
        defaultLocale === 'ru' ? 'ru' : (defaultLocale === 'tr' ? 'tr' : 'en')
    );
    const [activeSection, setActiveSection] = useState('vision');

    // Prevent scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const sections = [
        { id: 'vision', en: '1. Vision', tr: '1. Vizyon', ru: '1. Видение' },
        { id: 'principles', en: '2. Core Principles', tr: '2. Temel İlkeler', ru: '2. Принципы' },
        { id: 'architecture', en: '3. Product Architecture', tr: '3. Mimari', ru: '3. Архитектура' },
        { id: 'tokenomics', en: '4. Tokenomics ($ULC)', tr: '4. Tokenomi ($ULC)', ru: '4. Токеномика' },
        { id: 'flywheel', en: '5. Revenue Flywheel', tr: '5. Gelir Modeli', ru: '5. Доходность' },
        { id: 'staking', en: '6. Staking Model', tr: '6. Staking & Gelir', ru: '6. Стейкинг' },
        { id: 'reserve', en: '7. Reserve Pool', tr: '7. Rezerv Havuzu', ru: '7. Резерв' },
        { id: 'distribution', en: '8. Distribution', tr: '8. Dağılım', ru: '8. Распределение' },
        { id: 'roadmap', en: '9. Roadmap', tr: '9. Yol Haritası', ru: '9. Карта' },
    ];

    const scrollToSection = (id: string) => {
        const element = document.getElementById(`wp-${id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setActiveSection(id);
        }
    };

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col md:flex-row h-screen overflow-hidden"
            >
                {/* Sidebar Navigation */}
                <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col gap-8 bg-black/40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                                <Book className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-headline font-bold text-white leading-none">WHITEPAPER</h3>
                                <p className="text-[10px] text-primary font-bold tracking-widest mt-1">VERSION 1.0</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden text-white hover:bg-white/10">
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Language / Dil / Язык</p>
                        <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                            <button 
                                onClick={() => setActiveLang('en')}
                                className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeLang === 'en' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-white'}`}
                            >
                                EN
                            </button>
                            <button 
                                onClick={() => setActiveLang('tr')}
                                className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeLang === 'tr' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-white'}`}
                            >
                                TR
                            </button>
                            <button 
                                onClick={() => setActiveLang('ru')}
                                className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeLang === 'ru' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-white'}`}
                            >
                                RU
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Chapters</p>
                        {sections.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => scrollToSection(s.id)}
                                className={`flex items-center justify-between p-3 rounded-xl text-left transition-all group ${activeSection === s.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
                            >
                                <span className="text-[11px] font-bold">{activeLang === 'ru' ? s.ru : (activeLang === 'tr' ? s.tr : s.en)}</span>
                                <ChevronRight className={`w-4 h-4 transition-transform ${activeSection === s.id ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                            </button>
                        ))}
                    </div>

                    <div className="mt-auto pt-6 border-t border-white/10">
                         <div className="bg-gradient-to-br from-primary/20 to-blue-600/20 p-4 rounded-2xl border border-primary/20 relative overflow-hidden group/card">
                            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover/card:scale-110 transition-transform">
                                <ShieldCheck className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-[10px] font-bold text-primary mb-1 uppercase tracking-tighter">Economic Seal</p>
                            <p className="text-[11px] text-white/70 leading-relaxed font-medium">Verified Base Laws. Immutable & Transparent.</p>
                         </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-950/50">
                    <div className="max-w-3xl mx-auto px-6 py-12 md:py-20 space-y-20 text-zinc-300">
                        
                        {/* Vision */}
                        <section id="wp-vision" className="scroll-mt-20">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest mb-6">
                                <Zap className="w-3 h-3" /> {activeLang === 'ru' ? 'Стратегическое видение' : (activeLang === 'tr' ? 'Stratejik Vizyon' : 'Strategic Vision')}
                            </div>
                            <h2 className="text-4xl md:text-5xl font-headline font-bold text-white mb-8">
                                {activeLang === 'ru' ? 'Суверенная экономика создателей' : (activeLang === 'tr' ? 'Egemen Yaratıcı Ekonomisi' : 'The Sovereign Creator Economy')}
                            </h2>
                            <div className="space-y-6 text-lg leading-relaxed font-medium text-white/70">
                                {activeLang === 'ru' ? (
                                    <>
                                        <p>Unverse AI — это экосистема нового поколения, которая объединяет создание контента на базе ИИ, децентрализованное распространение и монетизацию в единую экономическую систему.</p>
                                        <div className="grid md:grid-cols-2 gap-6 mt-12">
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h4 className="text-white font-bold mb-3">Создатели в центре</h4>
                                                <p className="text-sm">85% всей выручки поступает напрямую создателю контента, меняя саму природу платформ.</p>
                                            </div>
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h4 className="text-white font-bold mb-3">ИИ как уравнитель</h4>
                                                <p className="text-sm">AI Studio снижает порог входа, позволяя любому мгновенно создавать контент студийного качества.</p>
                                            </div>
                                        </div>
                                    </>
                                ) : activeLang === 'tr' ? (
                                    <>
                                        <p>Unverse AI; içerik üretimini, dağıtımını ve monetizasyonunu tek bir ekonomik sistemde birleştiren, yapay zeka destekli yeni nesil bir ekosistemdir.</p>
                                        <div className="grid md:grid-cols-2 gap-6 mt-12">
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h4 className="text-white font-bold mb-3">Merkezde Yaratıcı</h4>
                                                <p className="text-sm">Tüm gelirin %85\'i doğrudan yaratıcıya akar; bu, eski platformların sömürücü yapısını tersine çevirir.</p>
                                            </div>
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h4 className="text-white font-bold mb-3">Eşitleyici Olarak AI</h4>
                                                <p className="text-sm">AI Studio üretim bariyerini yıkarak herkesin anında stüdyo kalitesinde içerik üretmesini sağlar.</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p>Unverse AI is a next-generation ecosystem that merges AI-driven content production, decentralized distribution, and revenue-backed monetization into a single system.</p>
                                        <div className="grid md:grid-cols-2 gap-6 mt-12">
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h4 className="text-white font-bold mb-3">Creators at the Center</h4>
                                                <p className="text-sm">85% of all revenue flows directly to the creator, reversing the exploitative nature of legacy platforms.</p>
                                            </div>
                                            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                                <h4 className="text-white font-bold mb-3">AI as an Equalizer</h4>
                                                <p className="text-sm">AI Studio lowers the barrier to entry, allowing anyone to produce studio-quality content instantly.</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>

                        {/* Principles */}
                        <section id="wp-principles" className="scroll-mt-20">
                             <h3 className="text-2xl font-headline font-bold text-white mb-6 border-l-4 border-primary pl-4 uppercase tracking-tight">
                                {activeLang === 'ru' ? 'Основные Принципы' : (activeLang === 'tr' ? 'Temel İlkeler' : 'Core Principles')}
                            </h3>
                            <ul className="space-y-8">
                                <li className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center font-black text-primary border border-primary/20">1</div>
                                    <div>
                                        <h4 className="text-white font-bold text-lg">{activeLang === 'ru' ? 'Экономика создателей' : (activeLang === 'tr' ? 'Önce Yaratıcı Ekonomisi' : 'Creator-First Economics')}</h4>
                                        <p className="mt-1 text-white/50">{activeLang === 'ru' ? '85% чистой выручки распределяется создателям.' : (activeLang === 'tr' ? 'Net gelirin %85\'i doğrudan yaratıcılara ayrılır.' : '85% net revenue allocated directly to creators.')}</p>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center font-black text-primary border border-primary/20">2</div>
                                    <div>
                                        <h4 className="text-white font-bold text-lg">{activeLang === 'ru' ? 'Невидимый Web3' : (activeLang === 'tr' ? 'Görünmez Web3' : 'Invisible Web3')}</h4>
                                        <p className="mt-1 text-white/50">{activeLang === 'ru' ? 'Платежи в USDC без комиссий за газ через Base Network.' : (activeLang === 'tr' ? 'Base Network üzerinde USDC ödemeleri ve gazsız işlemler.' : 'USDC native and gas-less transactions via Base Network.')}</p>
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* Tokenomics */}
                        <section id="wp-tokenomics" className="scroll-mt-20 p-8 rounded-[2rem] bg-gradient-to-br from-zinc-900 to-black border border-white/10 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Coins className="w-40 h-40" />
                            </div>
                            <h3 className="text-3xl font-headline font-bold text-white mb-8">
                                {activeLang === 'ru' ? 'Токеномика ($ULC)' : (activeLang === 'tr' ? 'Tokenomi ($ULC)' : 'Tokenomics ($ULC)')}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{activeLang === 'en' ? 'Symbol' : (activeLang === 'tr' ? 'Sembol' : 'Символ')}</p>
                                    <p className="text-lg font-black text-primary">$ULC</p>
                                    <p className="text-[9px] text-primary/50 font-bold uppercase mt-1">Unlock Currency</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{activeLang === 'en' ? 'Total Supply' : (activeLang === 'tr' ? 'Arz' : 'Предложение')}</p>
                                    <p className="text-lg font-black text-white">1,000,000,000</p>
                                    <p className="text-[9px] text-white/50 font-bold uppercase mt-1">Fixed / Fixed</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{activeLang === 'en' ? 'Network' : (activeLang === 'tr' ? 'Ağ' : 'Сеть')}</p>
                                    <p className="text-lg font-black text-white">Base (L2)</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{activeLang === 'en' ? 'Type' : (activeLang === 'tr' ? 'Tür' : 'Тип')}</p>
                                    <p className="text-lg font-black text-white">Utility</p>
                                </div>
                            </div>
                        </section>

                        {/* Flywheel with Russian punchline */}
                        <section id="wp-flywheel" className="scroll-mt-20">
                            <h3 className="text-2xl font-headline font-bold text-white mb-8 flex items-center gap-3">
                                <TrendingUp className="w-6 h-6 text-primary" />
                                {activeLang === 'ru' ? 'Доходный маховик' : (activeLang === 'tr' ? 'Gelir Döngüsü' : 'Revenue Flywheel')}
                            </h3>
                            <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/20 space-y-6">
                                <ol className="list-decimal list-inside space-y-4 text-sm font-medium text-white/80">
                                    <li>{activeLang === 'ru' ? 'Пользователи тратят USDC' : (activeLang === 'tr' ? 'Kullanıcılar USDC harcar' : 'Users spend USDC')}</li>
                                    <li>{activeLang === 'ru' ? 'Платформа берет маржу 15%' : (activeLang === 'tr' ? 'Platform %15 margin alır' : 'Platform takes 15% margin')}</li>
                                    <li>{activeLang === 'ru' ? '5% выручки идет на обратный выкуп $ULC' : (activeLang === 'tr' ? '%5 toplam gelir ile geri alım yapılır' : '5% total revenue for $ULC Buybacks')}</li>
                                    <li>{activeLang === 'ru' ? '100% выкупа идет в пулы стейкинга' : (activeLang === 'tr' ? 'Geri alımların %100\'ü Stake Havuzlarına aktarılır' : '100% of buybacks to Staking Pools')}</li>
                                </ol>
                                <div className="p-6 bg-primary/10 rounded-2xl border border-primary/20 mt-8">
                                    <p className="text-primary font-bold italic leading-relaxed">
                                        {activeLang === 'ru'
                                            ? '«По мере роста доходов платформы давление на обратный выкуп увеличивается, создавая устойчивый спрос на $ULC при одновременном сокращении предложения.»'
                                            : activeLang === 'tr'
                                            ? '“Platform geliri arttıkça, geri alım baskısı da artar; bu durum $ULC için sürdürülebilir bir talep oluşturur.”'
                                            : '“As platform revenue grows, buyback pressure increases, creating sustained demand for $ULC.”'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Burn & Deflation */}
                        <section id="wp-burn" className="scroll-mt-20">
                            <h3 className="text-2xl font-headline font-bold text-white mb-6 uppercase tracking-tight">
                                {activeLang === 'ru' ? 'Механизмы сжигания' : (activeLang === 'tr' ? 'Yakım Mekanizmaları' : 'Burn Mechanisms')}
                            </h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5">
                                    <h4 className="text-red-400 font-black text-lg mb-2">30% BURN</h4>
                                    <p className="text-sm text-white/60">{activeLang === 'ru' ? 'За каждую генерацию ИИ' : (activeLang === 'tr' ? 'Her AI üretimi ücretinden' : 'On every AI generation fee')}</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5">
                                    <h4 className="text-red-400 font-black text-lg mb-2">5% BURN</h4>
                                    <p className="text-sm text-white/60">{activeLang === 'ru' ? 'При разблокировке контента' : (activeLang === 'tr' ? 'İçerik kilitlerinden' : 'On content unlocks')}</p>
                                </div>
                            </div>
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl mt-6">
                                <p className="text-emerald-400 font-bold italic text-sm">
                                    {activeLang === 'ru'
                                        ? '«Протокол разработан так, чтобы становиться все более дефляционным по мере масштабирования использования.»'
                                        : (activeLang === 'tr' ? '“Protokol, kullanım ölçeklendikçe giderek daha fazla deflasyonist olacak şekilde tasarlanmıştır.”' : '“The protocol is designed to become increasingly deflationary as usage scales.”')}
                                </p>
                            </div>
                        </section>

                        {/* Staking with Russian punchline */}
                        <section id="wp-staking" className="scroll-mt-20">
                            <h3 className="text-2xl font-headline font-bold text-white mb-6 uppercase tracking-tight">
                                {activeLang === 'ru' ? 'Стейкинг' : (activeLang === 'tr' ? 'Staking' : 'Staking')}
                            </h3>
                            <div className="space-y-6">
                                <p className="text-white/60">{activeLang === 'ru' ? 'Запуск одновременно с основной сетью Base.' : (activeLang === 'tr' ? 'Mainnet ile eş zamanlı aktif edilecektir.' : 'Launching simultaneously with Mainnet.')}</p>
                                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20">
                                    <p className="text-primary font-bold italic leading-relaxed">
                                        {activeLang === 'ru'
                                            ? '«Стейкинг действует как поглотитель ликвидности, снижая давление на продажу и согласовывая долгосрочные стимулы.»'
                                            : (activeLang === 'tr' ? '“Staking, bir likidite havuzu görevi görerek satış baskısını azaltır.”' : '“Staking acts as a liquidity sink, reducing sell pressure.”')}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Reserve Pool & Vesting Table */}
                        <section id="wp-reserve" className="scroll-mt-20">
                            <h3 className="text-2xl font-headline font-bold text-white mb-6 uppercase tracking-tight">
                                {activeLang === 'ru' ? '20-летняя стратегия' : (activeLang === 'tr' ? '20 Yıllık Strateji' : '20-Year Strategy')}
                            </h3>
                            <p className="text-white/70 mb-8 leading-relaxed">
                                {activeLang === 'ru' 
                                    ? 'Резерв в 420M $ULC заблокирован. С 10-го года управление переходит к DAO сообщества.'
                                    : (activeLang === 'tr' ? '420M $ULC Rezerv Havuzu kilitlidir. 10. yıldan itibaren yönetim DAO\'ya geçer.' : 'The 420M $ULC Reserve is locked. From Year 10, management transitions to Community DAO.')}
                            </p>
                            
                            <div className="overflow-x-auto rounded-3xl border border-white/10">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white/5 text-muted-foreground uppercase text-[10px] font-bold">
                                        <tr>
                                            <th className="p-4">{activeLang === 'en' ? 'Phase' : (activeLang === 'tr' ? 'Aşama' : 'Фаза')}</th>
                                            <th className="p-4">{activeLang === 'en' ? 'Duration' : (activeLang === 'tr' ? 'Süre' : 'Срок')}</th>
                                            <th className="p-4">{activeLang === 'en' ? 'Rate' : (activeLang === 'tr' ? 'Oran' : 'Квота')}</th>
                                            <th className="p-4">{activeLang === 'en' ? 'Focus' : (activeLang === 'tr' ? 'Odak' : 'Фокус')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <tr className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold text-white">Cliff</td>
                                            <td className="p-4">1 yr</td>
                                            <td className="p-4">0%</td>
                                            <td className="p-4 text-xs font-medium text-white/50">Bootstrap</td>
                                        </tr>
                                        <tr className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold text-white">Genesis</td>
                                            <td className="p-4">2-5 yr</td>
                                            <td className="p-4">15%</td>
                                            <td className="p-4 text-xs font-medium text-white/50">R&D</td>
                                        </tr>
                                        <tr className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-bold text-white">Expansion</td>
                                            <td className="p-4">6-10 yr</td>
                                            <td className="p-4">25%</td>
                                            <td className="p-4 text-xs font-medium text-white/50">Scaling</td>
                                        </tr>
                                        <tr className="hover:bg-white/5 transition-colors bg-primary/5">
                                            <td className="p-4 font-bold text-primary">DAO Era</td>
                                            <td className="p-4">11-20 yr</td>
                                            <td className="p-4">60%</td>
                                            <td className="p-4 text-xs font-medium text-primary/50">Community</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Final Statement */}
                        <section className="text-center py-20 border-t border-white/5">
                            <p className="text-4xl md:text-6xl font-headline font-bold text-primary mb-6 leading-none">
                                UNVERSE AI
                            </p>
                            <p className="text-xl md:text-2xl font-medium text-white/50 max-w-lg mx-auto leading-relaxed">
                                {activeLang === 'ru' 
                                    ? 'Суверенный экономический двигатель с 20-летним видением.' 
                                    : (activeLang === 'tr' ? '20 yıllık vizyon için egemen ekonomik motor.' : 'The sovereign economic engine for a 20-year vision.')}
                            </p>
                            <Button size="lg" onClick={onClose} className="mt-12 h-14 rounded-full px-12 bg-primary text-black font-black hover:scale-105 transition-all text-sm uppercase tracking-widest">
                                {activeLang === 'ru' ? 'Вернуться' : (activeLang === 'tr' ? 'Dön' : 'Back')}
                            </Button>
                        </section>
                    </div>
                </div>

                {/* Close Button - Desktop */}
                <button 
                    onClick={onClose}
                    className="hidden md:flex absolute top-8 right-8 w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full items-center justify-center text-white transition-all hover:rotate-90"
                >
                    <X className="w-6 h-6" />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
