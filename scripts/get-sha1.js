
import { exec } from 'child_process';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, unlinkSync } from 'fs';

console.log('\n🔐 Managing Android Keystore for Consistent Signing...\n');

// Paths
const projectRoot = resolve();
const projectKeystorePath = join(projectRoot, 'debug.keystore');
const fingerprintFile = join(projectRoot, 'sha1_fingerprint.txt');

// The system location where Gradle expects the debug keystore
const home = homedir();
const systemAndroidDir = join(home, '.android');
const systemKeystorePath = join(systemAndroidDir, 'debug.keystore');

// Helper to run shell commands
const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
};

const main = async () => {
    // 0. Validate existing keystore if present
    if (existsSync(projectKeystorePath)) {
        try {
            // Try to list keys to check if file is valid
            await runCommand(`keytool -list -keystore "${projectKeystorePath}" -storepass android`);
            console.log('✅ Found valid debug.keystore in project root.');
        } catch (e) {
            console.log('⚠️ Found CORRUPTED or INVALID debug.keystore. Deleting to regenerate...');
            try {
                unlinkSync(projectKeystorePath);
            } catch (delErr) {
                console.error('❌ Could not delete corrupted file. Please delete debug.keystore manually.');
                process.exit(1);
            }
        }
    }

    // 1. Generate or Import if missing
    if (!existsSync(projectKeystorePath)) {
        console.log('⚠️ No stable keystore found in project root. Checking system...');
        
        // If user has one in system (e.g. local dev), import it to project
        if (existsSync(systemKeystorePath)) {
            // Check if system one is valid too
            try {
                 await runCommand(`keytool -list -keystore "${systemKeystorePath}" -storepass android`);
                 console.log('📥 Importing system debug.keystore to project root...');
                 copyFileSync(systemKeystorePath, projectKeystorePath);
            } catch (e) {
                console.log('⚠️ System keystore is also invalid. Generating fresh one...');
                // Fallthrough to generation
            }
        }
        
        // If still missing (was invalid or didn't exist)
        if (!existsSync(projectKeystorePath)) {
            console.log('🆕 Generating NEW stable debug.keystore in project root...');
            try {
                await runCommand(`keytool -genkey -v -keystore "${projectKeystorePath}" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"`);
            } catch (e) {
                console.error('❌ Failed to generate keystore. Is Java (JDK) installed?');
                console.error(e.message);
                process.exit(1);
            }
        }
    }

    // 2. Sync Project Keystore -> System Keystore (Crucial for CI/CD and Gradle)
    if (!existsSync(systemAndroidDir)) {
        mkdirSync(systemAndroidDir, { recursive: true });
    }
    
    // Always overwrite system keystore with our project one to ensure consistency
    console.log('🔄 Syncing keystore to system path for Gradle build...');
    try {
        copyFileSync(projectKeystorePath, systemKeystorePath);
    } catch (e) {
        console.warn('⚠️ Could not sync to system folder (permission error?). Gradle might use a different key.');
    }

    // 3. Extract and Print SHA-1
    console.log('\n🔑 Extracting SHA-1 Fingerprint from PROJECT keystore...\n');

    try {
        const stdout = await runCommand(`keytool -list -v -keystore "${projectKeystorePath}" -alias androiddebugkey -storepass android -keypass android`);
        
        const lines = stdout.split('\n');
        let sha1 = '';
        
        lines.forEach(line => {
            if (line.trim().startsWith('SHA1:')) {
                sha1 = line.trim().replace('SHA1: ', '');
            }
        });

        if (sha1) {
            console.log('====================================================');
            console.log('💎 THIS IS YOUR STABLE SHA-1 FINGERPRINT:');
            console.log('\x1b[32m%s\x1b[0m', sha1); 
            console.log('====================================================');
            
            // SAVE TO FILE for GitHub Artifacts with explicit instructions
            const fileContent = `SHA-1 FINGERPRINT (DEBUG):\n${sha1}\n\n` +
                                `==================================================================\n` +
                                `INSTRUCTIONS:\n` +
                                `1. Copy the SHA-1 above.\n` +
                                `2. Go to Google Cloud Console > APIs & Services > Credentials.\n` +
                                `3. Add/Update your Android Client ID with this fingerprint.\n` +
                                `4. IMPORTANT: If this keystore was generated fresh in CI (GitHub Actions),\n` +
                                `   download 'debug.keystore' from the artifacts and COMMIT IT to your\n` +
                                `   project root. Otherwise, a new key (and new SHA-1) will be\n` +
                                `   generated on every build, breaking Google Sign-In.\n` +
                                `==================================================================`;
            
            writeFileSync(fingerprintFile, fileContent);
            console.log(`📄 SHA-1 saved to: ${fingerprintFile}`);
        } else {
            console.log('⚠️ Could not find SHA1 in keytool output.');
            console.log(stdout);
        }
    } catch (e) {
        console.error(`❌ Error reading keystore: ${e.message}`);
    }
};

main();
