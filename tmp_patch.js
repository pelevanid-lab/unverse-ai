const fs = require('fs');

let content = fs.readFileSync('src/app/[locale]/uniq/page.tsx', 'utf-8');

// Replace features data structure
content = content.replace(
    /title: 'Strategic Intelligence',\s*desc: 'AI-powered daily content strategy and optimization insights tailored to your niche\.',/g,
    "titleKey: 'feat1Title',\n        descKey: 'feat1Desc',"
);
content = content.replace(
    /title: '2-Week Content Calendar',\s*desc: 'Smart scheduling that places your media at peak engagement times automatically\.',/g,
    "titleKey: 'feat2Title',\n        descKey: 'feat2Desc',"
);
content = content.replace(
    /title: 'Digital Twin Creation',\s*desc: 'Your identity, recreated with pixel-perfect fidelity across infinite scenes and styles\.',/g,
    "titleKey: 'feat3Title',\n        descKey: 'feat3Desc',"
);
content = content.replace(
    /title: 'Director Mode \(Pro\)',\s*desc: 'Full cinematic control: composition, angle, mood, lighting, outfit\. Every frame, your way\.',/g,
    "titleKey: 'feat4Title',\n        descKey: 'feat4Desc',"
);

// Replace f.title and f.desc in render
content = content.replace(
    /<h3 className="text-lg font-headline font-black uppercase tracking-tight mb-1">\{f\.title\}<\/h3>/g,
    '<h3 className="text-lg font-headline font-black uppercase tracking-tight mb-1">{t(f.titleKey)}</h3>'
);
content = content.replace(
    /<p className="text-sm text-muted-foreground leading-relaxed">\{f\.desc\}<\/p>/g,
    '<p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>'
);

// Hero section replacements
content = content.replace(
    /Identity-Consistent AI Engine/g,
    "{t('badge1')}"
);
content = content.replace(
    /Your Digital[\s\S]*?<span className="text-primary">Twin<\/span>\{' '\}[\s\S]*?<span className="text-muted-foreground\/40">Awaits<\/span>/g,
    "{t('title1')}\n                        <br />\n                        <span className=\"text-primary\">{t('titleHighlight')}</span>{' '}\n                        <span className=\"text-muted-foreground/40\">{t('titleSuffix')}</span>"
);
content = content.replace(
    /Upload your photos or describe a dream character — Uniq trains a LoRA model that captures your exact identity and recreates you across infinite scenes with pixel-perfect consistency\./g,
    "{t('desc1')}"
);
content = content.replace(
    /Create My Digital Twin/g,
    "{t('btnCreate')}"
);
content = content.replace(
    /See How It Works/g,
    "{t('btnSeeHow')}"
);
content = content.replace(
    /↑ Powered by your Digital Twin — every image is consistently you/g,
    "{t('poweredBy')}"
);

// Features Summary section
content = content.replace(
    /What's Included/g,
    "{t('whatsIncluded')}"
);
content = content.replace(
    /Everything You <span className="text-primary">Need<\/span>/g,
    "{t('everythingYouNeed')} <span className=\"text-primary\">{t('need')}</span>"
);
content = content.replace(
    /Strategic intelligence and calendar tools are free\. Digital Twin creation requires a one-time unlock\./g,
    "{t('featuresDesc')}"
);

// How it works
content = content.replace(
    /The Process/g,
    "{t('theProcess')}"
);
content = content.replace(
    /How Uniq <span className="text-primary">Works<\/span>/g,
    "{t('howUniqWorks')} <span className=\"text-primary\">{t('works')}</span>"
);
// How it works steps array
content = content.replace(
    /title: 'Unlock',\s*desc: 'One-time ULC payment activates your Digital Twin engine\.',/g,
    "titleKey: 'step1Title',\n            descKey: 'step1Desc',"
);
content = content.replace(
    /title: 'Learn',\s*desc: 'Upload 15\+ photos or describe your ideal character\. Our neural engine evaluates quality\.',/g,
    "titleKey: 'step2Title',\n            descKey: 'step2Desc',"
);
content = content.replace(
    /title: 'Train',\s*desc: 'fal\.ai LoRA model trains \(~30min\) to capture your exact facial features and style\.',/g,
    "titleKey: 'step3Title',\n            descKey: 'step3Desc',"
);
content = content.replace(
    /title: 'Create',\s*desc: 'Your Digital Twin is ready\. Generate yourself in any scene with perfect consistency\.',/g,
    "titleKey: 'step4Title',\n            descKey: 'step4Desc',"
);
content = content.replace(
    /<h3 className="font-headline font-black uppercase tracking-tight text-lg">\{s\.title\}<\/h3>/g,
    '<h3 className="font-headline font-black uppercase tracking-tight text-lg">{t(s.titleKey)}</h3>'
);
content = content.replace(
    /<p className="text-sm text-muted-foreground leading-relaxed">\{s\.desc\}<\/p>/g,
    '<p className="text-sm text-muted-foreground leading-relaxed">{t(s.descKey)}</p>'
);

// Unlock section
content = content.replace(
    /One-Time Unlock/g,
    "{t('oneTimeUnlock')}"
);
content = content.replace(
    /Choose Your <span className="text-primary">Path<\/span>/g,
    "{t('chooseYourPath')} <span className=\"text-primary\">{t('pathTitle')}</span>"
);
content = content.replace(
    /No monthly fees\. One single unlock gives you permanent access to your Digital Twin engine\./g,
    "{t('pathDesc')}"
);
content = content.replace(
    />Real Identity</g,
    ">{t('realIdentity')}<"
);
content = content.replace(
    />My Real Photos</g,
    ">{t('myRealPhotos')}<"
);
content = content.replace(
    /Upload 15\+ real photos of yourself\. Uniq's neural engine selects the best ones, evaluates quality, and trains a LoRA model that captures your exact facial features and style\./g,
    "{t('photosPathDesc')}"
);
content = content.replace(
    /\['15\+ photos evaluated by AI', 'Quality & diversity scoring', 'LoRA training \(~30 min\)', 'Perfect face consistency'\]/g,
    "[t('photosBullet1'), t('photosBullet2'), t('photosBullet3'), t('photosBullet4')]"
);
content = content.replace(
    /Unlock with My Photos — 500 ULC/g,
    "{t('unlockWithPhotos')}"
);
// Imaginary Path
content = content.replace(
    />Imaginary Character</g,
    ">{t('imaginaryCharacter')}<"
);
content = content.replace(
    />My Dream Character</g,
    ">{t('myDreamCharacter')}<"
);
content = content.replace(
    /Describe a character that exists only in your imagination\. Uniq generates 15 high-quality reference images across different angles and conditions, then trains a LoRA model from them\./g,
    "{t('imaginaryPathDesc')}"
);
content = content.replace(
    /\['AI generates 15 reference images', 'Multiple angles & lighting', 'LoRA training from generated refs', 'Fully fictional, infinitely scalable'\]/g,
    "[t('imaginaryBullet1'), t('imaginaryBullet2'), t('imaginaryBullet3'), t('imaginaryBullet4')]"
);
content = content.replace(
    /Unlock Dream Character — 700 ULC/g,
    "{t('unlockDream')}"
);
// common
content = content.replace(
    />ONE-TIME</g,
    ">{t('oneTime')}<"
);
content = content.replace(
    />Connect Wallet to Unlock</g,
    ">{t('connectWallet')}<"
);
content = content.replace(
    /> Processing\.\.\.</g,
    "> {t('processing')}<"
);
content = content.replace(
    /Balance: \{\(user\?\.ulcBalance\?\.available \?\? 0\)\.toFixed\(0\)\} ULC/g,
    "{t('balance', { amount: (user?.ulcBalance?.available ?? 0).toFixed(0) })}"
);
content = content.replace(
    /ULC retail price: \$0\.015 \/ ULC.*? Each AI generation session is billed separately at standard rates\./s,
    "{t('finePrint')}"
);

// Dashobard section
content = content.replace(
    />Uniq <span className="text-primary">Dashboard<\/span>/g,
    ">{t('uniqDashboard')}<"
);
content = content.replace(
    /Digital Twin Engine — \{uniqData\.twin_path === 'photos' \? 'Real Identity' : 'Imaginary Character'\}/g,
    "{t('digitalTwinEngine', { type: uniqData.twin_path === 'photos' ? t('realIdentity') : t('imaginaryCharacter') })}"
);
content = content.replace(
    /isReady \? 'Twin Ready' : twinStatus === 'training' \? 'LoRA Training in Progress' : 'Neural Learning Active'/g,
    "isReady ? t('twinReady') : twinStatus === 'training' ? t('loraTraining') : t('neuralLearningActive')"
);
content = content.replace(
    />Neural Learning Progress</g,
    ">{t('neuralLearningProgress')}<"
);
content = content.replace(
    /twinStatus === 'learning'[\s\S]*?\?' Waiting for your \$\{uniqData\.twin_path === 'photos' \? 'photo uploads to begin training' : 'character description to generate references'\}'[\s\S]*?: 'LoRA model training on fal\.ai infrastructure\.\.\.'/g,
    "twinStatus === 'learning'\n                                        ? (uniqData.twin_path === 'photos' ? t('trainingWaitPhotos') : t('trainingWaitImaginary'))\n                                        : t('loraModelTraining')"
);
content = content.replace(
    /Open Uniq Muse/g,
    "{t('openUniqMuse')}"
);
content = content.replace(
    /Upload Photos & Start Training/g,
    "{t('uploadAndTrain')}"
);
content = content.replace(
    /Describe Your Character/g,
    "{t('describeCharacter')}"
);

// Stat cards
content = content.replace(
    /label: 'Path',\s*value: uniqData\.twin_path === 'photos' \? 'Real Photos' : 'Imaginary Character',/g,
    "label: t('pathLabel'),\n                        value: uniqData.twin_path === 'photos' ? t('realPhotos') : t('imaginaryCharacter'),"
);
content = content.replace(
    /label: 'Status',\s*value: isReady \? 'Twin Active' : twinStatus === 'training' \? 'Training' : 'Learning',/g,
    "label: t('statusLabel'),\n                        value: isReady ? t('statusActive') : twinStatus === 'training' ? t('statusTraining') : t('statusLearning'),"
);
content = content.replace(
    /label: 'Resets',\s*value: `\$\{uniqData\.character_reset_count \?\? 0\} used`,/g,
    "label: t('resetsLabel'),\n                        value: t('resetsUsed', { count: uniqData.character_reset_count ?? 0 }),"
);

// Next Steps
content = content.replace(
    /Next Steps/g,
    "{t('nextSteps')}"
);
content = content.replace(
    /<Step n=\{1\} done=\{false\} text="Go to Uniq Muse and upload 15\+ clear, high-quality photos" \/>/g,
    '<Step n={1} done={false} text={t("nStepP1")} />'
);
content = content.replace(
    /<Step n=\{2\} done=\{false\} text="Our neural engine will evaluate and select the best 15" \/>/g,
    '<Step n={2} done={false} text={t("nStepP2")} />'
);
content = content.replace(
    /<Step n=\{3\} done=\{false\} text="Click 'Create Digital Twin' to start LoRA training \(~30 min\)" \/>/g,
    '<Step n={3} done={false} text={t("nStepP3")} />'
);
content = content.replace(
    /<Step n=\{4\} done=\{false\} text="Return here — your twin will be ready to generate scenes!" \/>/g,
    '<Step n={4} done={false} text={t("nStepP4")} />'
);

content = content.replace(
    /<Step n=\{1\} done=\{false\} text="Go to Uniq Muse and describe your dream character in detail" \/>/g,
    '<Step n={1} done={false} text={t("nStepI1")} />'
);
content = content.replace(
    /<Step n=\{2\} done=\{false\} text="Uniq generates 15 reference images across different angles" \/>/g,
    '<Step n={2} done={false} text={t("nStepI2")} />'
);
content = content.replace(
    /<Step n=\{3\} done=\{false\} text="LoRA model trains on your character references \(~30 min\)" \/>/g,
    '<Step n={3} done={false} text={t("nStepI3")} />'
);
content = content.replace(
    /<Step n=\{4\} done=\{false\} text="Your imaginary character twin becomes your permanent identity" \/>/g,
    '<Step n={4} done={false} text={t("nStepI4")} />'
);


fs.writeFileSync('src/app/[locale]/uniq/page.tsx', content);
console.log('UniqPage patched completely.');
