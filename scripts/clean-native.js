
import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';

const androidDir = resolve('android');
const manifestPath = join(androidDir, 'app/src/main/AndroidManifest.xml');
const appBuildGradle = join(androidDir, 'app/build.gradle');

console.log('🔍 Checking Android platform integrity...');

if (existsSync(androidDir)) {
    // If manifest or app-level build.gradle is missing, the folder is likely corrupt/incomplete
    const isCorrupt = !existsSync(manifestPath) || !existsSync(appBuildGradle);
    
    if (isCorrupt) {
        console.log('⚠️ Android platform detected as CORRUPT (missing Manifest or app/build.gradle).');
        console.log('🔥 Deleting ./android folder to allow fresh regeneration by Capacitor...');
        try {
            rmSync(androidDir, { recursive: true, force: true });
            console.log('✅ Deleted corrupted android directory.');
        } catch (e) {
            console.error('❌ Failed to delete android directory:', e);
            // Don't exit process, try to continue, maybe setup-android can fix it or user has permissions issue
        }
    } else {
        console.log('✅ Android platform seems valid.');
    }
} else {
    console.log('ℹ️ No Android platform found (will be created).');
}
