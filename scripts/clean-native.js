
import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';

const androidDir = resolve('android');
const manifestPath = join(androidDir, 'app/src/main/AndroidManifest.xml');
const appBuildGradle = join(androidDir, 'app/build.gradle');
const resPath = join(androidDir, 'app/src/main/res');

console.log('🔍 Checking Android platform integrity...');

if (existsSync(androidDir)) {
    // If manifest, app-level build.gradle, or res folder is missing, consider corrupt
    const isCorrupt = !existsSync(manifestPath) || !existsSync(appBuildGradle) || !existsSync(resPath);
    
    if (isCorrupt) {
        console.log('⚠️ Android platform detected as CORRUPT (missing Manifest, Gradle, or Res).');
        console.log('🔥 Deleting ./android folder to allow fresh regeneration by Capacitor...');
        try {
            rmSync(androidDir, { recursive: true, force: true });
            console.log('✅ Deleted corrupted android directory.');
        } catch (e) {
            console.error('❌ Failed to delete android directory:', e);
        }
    } else {
        console.log('✅ Android platform seems valid.');
    }
} else {
    console.log('ℹ️ No Android platform found (will be created).');
}
