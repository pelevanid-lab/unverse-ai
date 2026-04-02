const fs = require('fs');

let content = fs.readFileSync('src/app/[locale]/creator/muse/page.tsx', 'utf-8');

content = content.replace(
    /Digital Twin Required/g,
    "{t('digitalTwinRequired')}"
);
content = content.replace(
    /Uniq Muse requires an active Digital Twin\. Unlock yours on the Uniq page to start generating identity-consistent content\./g,
    "{t('digitalTwinRequiredDesc')}"
);
content = content.replace(
    /Go to Uniq →/g,
    "{t('goToUniq')}"
);
content = content.replace(
    /Training Dataset \(15 Photos\)/g,
    "{t('trainingDataset')}"
);
content = content.replace(
    /Slot \{i \+ 1\}/g,
    "{t('slot')} {i + 1}"
);
content = content.replace(
    />Upload close-ups, medium shots, and different lighting conditions to ensure perfect neural capture\. Avoid group photos\.</g,
    ">{t('trainingDatasetDesc')}<"
);
content = content.replace(
    />Start Neural Learning</g,
    ">{t('startNeuralLearning')}<"
);
content = content.replace(
    />Neural Learning Active</g,
    ">{t('neuralLearningActive')}<"
);
content = content.replace(
    />\s*Your Digital Twin is currently being processed by the neural engine\. This process takes approximately 30 minutes\.\s*You can safely close this page\.\s*</g,
    ">{t('neuralLearningActiveDesc')}<"
);
content = content.replace(
    />\s*View Progress in Dashboard\s*</g,
    ">{t('viewProgressInDashboard')}<"
);


fs.writeFileSync('src/app/[locale]/creator/muse/page.tsx', content);
console.log('MusePage patched completely.');
