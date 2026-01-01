
import { exec } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve();
const androidAppDir = join(projectRoot, 'android', 'app');
const keystorePath = join(androidAppDir, 'release.keystore');
const propertiesPath = join(projectRoot, 'android', 'keystore.properties');
const buildGradlePath = join(androidAppDir, 'build.gradle');

const ALIAS = 'halalscan-release';
const PASS = 'halal-scanner-secure-pass'; // In a real app, ask user or use env var.

const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) { reject(error); return; }
            resolve(stdout);
        });
    });
};

const patchBuildGradle = () => {
    console.log('🔧 Patching android/app/build.gradle with signing config...');
    
    if (!existsSync(buildGradlePath)) {
        console.error('❌ build.gradle not found!');
        return;
    }

    let content = readFileSync(buildGradlePath, 'utf-8');
    let modified = false;

    // 1. Add keystore.properties loader if missing
    const loaderCode = `
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;
    if (!content.includes('def keystoreProperties = new Properties()')) {
        content = loaderCode + content;
        modified = true;
    }

    // 2. Add Signing Config block
    const signingBlock = `
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }`;

    if (!content.includes('signingConfigs {') && content.includes('buildTypes {')) {
        content = content.replace('buildTypes {', `signingConfigs {\n        release {\n            keyAlias keystoreProperties['keyAlias']\n            keyPassword keystoreProperties['keyPassword']\n            storeFile file(keystoreProperties['storeFile'])\n            storePassword keystoreProperties['storePassword']\n        }\n    }\n    buildTypes {`);
        modified = true;
    }

    // 3. Apply signing config to release build type
    if (content.includes('buildTypes {') && content.includes('release {') && !content.includes('signingConfig signingConfigs.release')) {
        // Look for release block and inject signingConfig
        content = content.replace(/release\s*{/, 'release {\n            signingConfig signingConfigs.release');
        modified = true;
    }

    if (modified) {
        writeFileSync(buildGradlePath, content);
        console.log('✅ build.gradle patched successfully with release signing!');
    } else {
        console.log('👍 build.gradle already has signing configuration.');
    }
};

const main = async () => {
    console.log('\n🔐 Setting up Release Keystore for Google Play...\n');

    // 1. Check if keystore exists
    if (!existsSync(keystorePath)) {
        console.log('🆕 Generating new release.keystore...');
        try {
            // Generate valid keystore
            await runCommand(`keytool -genkey -v -keystore "${keystorePath}" -alias ${ALIAS} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${PASS} -keypass ${PASS} -dname "CN=Halal Scanner,O=HalalApp,C=SA"`);
            console.log('✅ Keystore created at: android/app/release.keystore');
        } catch (e) {
            console.error('❌ Failed to create keystore. Is Java installed?');
            console.error(e.message);
            process.exit(1);
        }
    } else {
        console.log('👍 release.keystore already exists.');
    }

    // 2. Create keystore.properties (Standard Android practice)
    if (!existsSync(propertiesPath)) {
        const props = `storePassword=${PASS}\nkeyPassword=${PASS}\nkeyAlias=${ALIAS}\nstoreFile=release.keystore`;
        writeFileSync(propertiesPath, props);
        console.log('✅ Created android/keystore.properties');
    }

    // 3. Patch Gradle File
    patchBuildGradle();

    // 4. Extract and Print SHA-1 (CRITICAL FOR GOOGLE LOGIN IN PRODUCTION)
    console.log('\n📢 EXTRACTING RELEASE SHA-1 FINGERPRINT...');
    try {
        const stdout = await runCommand(`keytool -list -v -keystore "${keystorePath}" -alias ${ALIAS} -storepass ${PASS}`);
        const lines = stdout.split('\n');
        let sha1 = '';
        lines.forEach(line => {
            if (line.trim().startsWith('SHA1:')) sha1 = line.trim().replace('SHA1: ', '');
        });

        if (sha1) {
            console.log('\n⚠️  IMPORTANT ACTION REQUIRED ⚠️');
            console.log('====================================================');
            console.log('To make Google Sign-In work in the Play Store version,');
            console.log('you MUST add this SHA-1 to your Firebase/Google Cloud Console:');
            console.log('\n\x1b[32m%s\x1b[0m', sha1); 
            console.log('\n====================================================\n');
        }
    } catch (e) {
        console.warn('Could not extract SHA-1 automatically. Please run keytool manually.');
    }

    console.log('🚀 Ready to build App Bundle!');
};

main();
