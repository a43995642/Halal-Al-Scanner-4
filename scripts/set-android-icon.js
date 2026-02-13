
import { copyFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// Resolve paths relative to where the script is executed (Project Root)
const iconSource = resolve('icon.png');
const androidRes = resolve('android', 'app', 'src', 'main', 'res');

console.log('\n🎨 --- STARTING BLACK SPLASH SCREEN UPDATE ---');

// 1. Determine Sources
if (!existsSync(iconSource)) {
    console.error('❌ FATAL ERROR: icon.png not found in project root!');
    process.exit(1);
}

console.log(`📂 App Icon Source: ${iconSource}`);
console.log(`📂 Target Resource Folder: ${androidRes}`);

if (!existsSync(androidRes)) {
    console.error('❌ Android resources folder not found.');
    if (process.argv.includes('--force')) process.exit(0);
    process.exit(1);
}

// 2. XML Content for Splash Screen (PURE BLACK BACKGROUND, NO IMAGE)
// We removed the <bitmap> item to ensure no logo is shown.
const splashXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#000000"/>
        </shape>
    </item>
</layer-list>`;

// 3. Process Folders
try {
    const resFolders = readdirSync(androidRes);
    
    resFolders.forEach(folder => {
        const folderPath = join(androidRes, folder);
        
        if (!statSync(folderPath).isDirectory()) return;

        // --- HANDLE SPLASH SCREEN (Drawable Folders) ---
        if (folder.startsWith('drawable')) {
            // A. Remove any existing splash images to be safe
            const oldSplashPng = join(folderPath, 'splash.png');
            const oldSplashImg = join(folderPath, 'splash_img.png');
            
            if (existsSync(oldSplashPng)) try { unlinkSync(oldSplashPng); } catch (e) {}
            if (existsSync(oldSplashImg)) try { unlinkSync(oldSplashImg); } catch (e) {}

            // B. Create XML (Solid Black)
            if (folder === 'drawable' || folder === 'drawable-port') {
                try {
                    writeFileSync(join(folderPath, 'splash.xml'), splashXmlContent);
                    console.log(`   ✅ Created Pure Black XML Splash in: ${folder}`);
                } catch (e) {
                    console.error(`   ❌ Failed to write XML in ${folder}`, e);
                }
            }
        }

        // --- HANDLE APP ICON (Mipmap Folders) ---
        // Always use icon.png for the launcher
        if (folder.startsWith('mipmap') && !folder.includes('anydpi')) {
            try {
                // Delete old default files
                const existingFiles = readdirSync(folderPath);
                existingFiles.forEach(f => {
                    if (f.startsWith('ic_launcher')) unlinkSync(join(folderPath, f));
                });
                // Copy new files from icon.png
                copyFileSync(iconSource, join(folderPath, 'ic_launcher.png'));
                copyFileSync(iconSource, join(folderPath, 'ic_launcher_round.png'));
                copyFileSync(iconSource, join(folderPath, 'ic_launcher_foreground.png'));
            } catch (e) {
                console.warn(`   ⚠️ Could not update icons in ${folder}`);
            }
        }
    });

    // Clean up 'anydpi' to prevent XML overrides of the icon
    const anyDpiFolder = join(androidRes, 'mipmap-anydpi-v26');
    if (existsSync(anyDpiFolder)) {
         rmSync(anyDpiFolder, { recursive: true, force: true });
    }

    console.log('✅ Splash Screen is now SOLID BLACK (No Logo).');

} catch (e) {
    console.error('❌ Error processing resource directories:', e);
}

console.log('🚀 CONFIG COMPLETE.\n');
