
import { copyFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// Resolve paths relative to where the script is executed (Project Root)
const iconSource = resolve('icon.png');
const splashSourceSpecific = resolve('splash_icon.png'); // New separate file for splash
const androidRes = resolve('android', 'app', 'src', 'main', 'res');

console.log('\n🎨 --- STARTING ADVANCED ICON & SPLASH UPDATE ---');

// 1. Determine Sources
if (!existsSync(iconSource)) {
    console.error('❌ FATAL ERROR: icon.png not found in project root!');
    process.exit(1);
}

// Check if user provided a specific splash icon, otherwise fallback to main icon
let finalSplashSource = iconSource;
if (existsSync(splashSourceSpecific)) {
    console.log('✨ Found custom splash_icon.png! Using it for Splash Screen.');
    finalSplashSource = splashSourceSpecific;
} else {
    console.log('ℹ️ No splash_icon.png found. Using icon.png for both App Icon and Splash.');
}

console.log(`📂 App Icon Source: ${iconSource}`);
console.log(`📂 Splash Image Source: ${finalSplashSource}`);
console.log(`📂 Target Resource Folder: ${androidRes}`);

if (!existsSync(androidRes)) {
    console.error('❌ Android resources folder not found.');
    if (process.argv.includes('--force')) process.exit(0);
    process.exit(1);
}

// 2. XML Content for Splash Screen (White background + Centered Image)
const splashXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#ffffff"/>
        </shape>
    </item>
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_img" />
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
            // A. Copy the SPLASH SOURCE as "splash_img.png"
            try {
                copyFileSync(finalSplashSource, join(folderPath, 'splash_img.png'));
            } catch (e) { console.warn(`   ⚠️ Error copying splash_img to ${folder}`); }

            // B. Delete conflicting "splash.png"
            const oldSplash = join(folderPath, 'splash.png');
            if (existsSync(oldSplash)) {
                try { unlinkSync(oldSplash); } catch (e) {}
            }

            // C. Create XML
            if (folder === 'drawable' || folder === 'drawable-port') {
                try {
                    writeFileSync(join(folderPath, 'splash.xml'), splashXmlContent);
                    console.log(`   ✅ Created Native XML Splash in: ${folder}`);
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

    console.log('✅ Resources updated successfully.');

} catch (e) {
    console.error('❌ Error processing resource directories:', e);
}

console.log('🚀 ICON CONFIG COMPLETE.\n');
