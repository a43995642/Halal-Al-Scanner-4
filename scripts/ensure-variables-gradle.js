
import { writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

console.log('🔧 Checking Android configuration files...');

const projectRoot = resolve();
const androidDir = join(projectRoot, 'android');
const variablesPath = join(androidDir, 'variables.gradle');

// Standard Capacitor 6 variables
const variablesContent = `ext {
    minSdkVersion = 22
    compileSdkVersion = 34
    targetSdkVersion = 34
    androidxActivityVersion = '1.8.0'
    androidxAppCompatVersion = '1.6.1'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreKTXVersion = '1.12.0'
    androidxFragmentVersion = '1.6.2'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.9.0'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.1.5'
    androidxEspressoCoreVersion = '3.5.1'
    cordovaAndroidVersion = '10.1.1'
}`;

if (existsSync(androidDir)) {
    if (!existsSync(variablesPath)) {
        console.log('⚠️ android/variables.gradle missing. Regenerating...');
        writeFileSync(variablesPath, variablesContent);
        console.log('✅ Created android/variables.gradle');
    } else {
        console.log('✅ android/variables.gradle exists.');
    }
} else {
    console.warn('⚠️ Android directory not found. Skipping variables check.');
}
