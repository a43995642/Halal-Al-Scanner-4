
import { spawn, execSync } from 'child_process';
import { readdirSync, existsSync, chmodSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { platform, homedir } from 'os';

// Get Build Mode from arguments
const mode = process.argv[2] || 'debug'; // 'debug', 'release', or 'bundle'

console.log(`\n🚀 Starting Smart Android Build [Mode: ${mode.toUpperCase()}]...\n`);

const androidDir = resolve('android');
const gradlePropsPath = join(androidDir, 'gradle.properties');
const localPropsPath = join(androidDir, 'local.properties');

// --- STEP 0: ENSURE ANDROID SDK ---
console.log('🔍 Checking Android SDK environment...');

let sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

if (!sdkPath || !existsSync(sdkPath)) {
    // Try common locations
    const candidates = [
        join(homedir(), 'Android', 'Sdk'), // Standard Linux/Mac
        join(homedir(), 'android-sdk'),
        '/usr/lib/android-sdk', // Common Linux apt package
        '/opt/android-sdk',
        '/Library/Android/sdk', // Mac standard
        join(homedir(), 'AppData', 'Local', 'Android', 'Sdk') // Windows
    ];

    for (const cand of candidates) {
        if (cand && existsSync(cand)) {
            sdkPath = cand;
            console.log(`✅ Found Android SDK at: ${sdkPath}`);
            break;
        }
    }
}

if (sdkPath) {
    // Write to local.properties
    // Escape backslashes for Windows
    const escapedPath = process.platform === 'win32' ? sdkPath.replace(/\\/g, '\\\\') : sdkPath;
    const localContent = `sdk.dir=${escapedPath}\n`;
    writeFileSync(localPropsPath, localContent);
    console.log(`📄 Generated local.properties with sdk.dir=${sdkPath}`);
} else {
    console.warn('⚠️  ANDROID SDK NOT FOUND AUTOMATICALLY.');
    console.warn('   The build might fail if "sdk.dir" is missing in local.properties or ANDROID_HOME is not set.');
    // We don't exit here, we let Gradle fail if it really can't find it, or maybe Gradle wrapper handles it.
}


// --- STEP 1: JAVA SETUP ---
// Priority: 
// 1. org.gradle.java.home in gradle.properties (set by force-java script)
// 2. JAVA_HOME environment variable
// 3. Dynamic search in /usr/lib/jvm

let javaHome = process.env.JAVA_HOME;
let foundCompatibleJDK = false;

// Check gradle.properties first
if (existsSync(gradlePropsPath)) {
    const props = readFileSync(gradlePropsPath, 'utf-8');
    const match = props.match(/org\.gradle\.java\.home=(.*)/);
    if (match && match[1]) {
        const configuredHome = match[1].trim();
        if (existsSync(configuredHome)) {
            javaHome = configuredHome;
            foundCompatibleJDK = true;
            console.log(`✅ Using configured JDK from gradle.properties: ${javaHome}`);
        }
    }
}

// Fallback search if not configured
if (!foundCompatibleJDK) {
    const jvmBaseDir = '/usr/lib/jvm';
    if (existsSync(jvmBaseDir)) {
        try {
            const entries = readdirSync(jvmBaseDir);
            const candidates = entries.filter(e => {
                const lower = e.toLowerCase();
                return (lower.includes('17') || lower.includes('21') || lower.includes('11')) && 
                       !lower.includes('common') && 
                       !lower.includes('doc') &&
                       !e.startsWith('.');
            }).sort();

            const bestMatch = candidates.find(c => c.includes('17')) || 
                              candidates.find(c => c.includes('21')) || 
                              candidates[0];

            if (bestMatch) {
                javaHome = join(jvmBaseDir, bestMatch);
                foundCompatibleJDK = true;
                console.log(`✅ FORCE USING DETECTED JDK: ${javaHome}`);
            }
        } catch (e) {
            console.warn("⚠️ Could not scan /usr/lib/jvm, using system default.");
        }
    }
}

// 2. Prepare Environment
const env = { ...process.env };
if (javaHome) {
    env.JAVA_HOME = javaHome;
    // Prepend to PATH to ensure 'java' command maps to this JDK
    env.PATH = `${join(javaHome, 'bin')}:${env.PATH}`;
}
if (sdkPath) {
    env.ANDROID_HOME = sdkPath;
}

const isWin = process.platform === 'win32';
let gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
const wrapperPath = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');

// 3. Ensure Gradle Wrapper Exists
if (!existsSync(wrapperPath)) {
    console.warn(`⚠️ Gradle Wrapper missing. Generating one (v8.12)...`);
    try {
        // Use the specific java env to run gradle if possible
        execSync(`gradle wrapper --gradle-version 8.12`, { 
            cwd: androidDir, 
            env: env,
            stdio: 'inherit' 
        });
        console.log('✅ Gradle Wrapper generated successfully.');
        
        if (!isWin) {
            chmodSync(wrapperPath, '755');
        }
    } catch (e) {
        console.error('❌ Failed to generate Gradle Wrapper. Trying fallback to system gradle.');
        gradleCmd = 'gradle';
    }
} else if (!isWin) {
    try { chmodSync(wrapperPath, '755'); } catch (e) {}
}

// 4. Determine Gradle Task based on Mode
let args = [];
let outputMsg = '';

if (mode === 'bundle') {
    args = ['clean', 'bundleRelease'];
    outputMsg = '👉 check android/app/build/outputs/bundle/release/app-release.aab';
} else if (mode === 'release') {
    args = ['clean', 'assembleRelease'];
    outputMsg = '👉 check android/app/build/outputs/apk/release/app-release.apk';
} else {
    // Debug (Default)
    args = ['clean', 'assembleDebug'];
    outputMsg = '👉 check android/app/build/outputs/apk/debug/app-debug.apk';
}

args.push('--stacktrace');

console.log(`🔨 Executing Gradle in: ${androidDir}`);
console.log(`👉 Command: ${gradleCmd} ${args.join(' ')}`);

const buildProcess = spawn(gradleCmd, args, {
    cwd: androidDir,
    stdio: 'inherit',
    env: env
});

buildProcess.on('close', (code) => {
    if (code === 0) {
        console.log(`\n🎉 ${mode.toUpperCase()} Build Successful!`);
        console.log(outputMsg);
    } else {
        console.error(`\n❌ Build Failed with code ${code}. See logs above.`);
        console.error(`💡 Tip: If error is "SDK location not found", ensure Android SDK is installed.`);
        process.exit(code);
    }
});
