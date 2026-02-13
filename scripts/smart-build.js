
import { spawn, execSync } from 'child_process';
import { readdirSync, existsSync, chmodSync, readFileSync, writeFileSync, mkdirSync, rmSync, renameSync } from 'fs';
import { join, resolve } from 'path';
import { platform, homedir } from 'os';

// Get Build Mode from arguments
const mode = process.argv[2] || 'debug'; // 'debug', 'release', or 'bundle'

console.log(`\n🚀 Starting Smart Android Build [Mode: ${mode.toUpperCase()}]...\n`);

const androidDir = resolve('android');
const gradlePropsPath = join(androidDir, 'gradle.properties');
const localPropsPath = join(androidDir, 'local.properties');

// --- STEP 1: DETECT JAVA (Needed for SDK Manager) ---
console.log('☕ Checking Java Environment...');

let javaHome = process.env.JAVA_HOME;
let foundCompatibleJDK = false;

// Check gradle.properties first (set by force-java script)
if (existsSync(gradlePropsPath)) {
    const props = readFileSync(gradlePropsPath, 'utf-8');
    const match = props.match(/org\.gradle\.java\.home=(.*)/);
    if (match && match[1]) {
        const configuredHome = match[1].trim();
        if (existsSync(configuredHome)) {
            javaHome = configuredHome;
            foundCompatibleJDK = true;
            console.log(`✅ Using configured JDK: ${javaHome}`);
        }
    }
}

// Fallback search
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
                console.log(`✅ Detected JDK: ${javaHome}`);
            }
        } catch (e) {}
    }
}

if (!javaHome) {
    console.error("❌ Java not found. Please run 'npm run force-java' first.");
    process.exit(1);
}

// --- STEP 2: ENSURE ANDROID SDK ---
console.log('🔍 Checking Android SDK environment...');

let sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

// 1. Search common locations
if (!sdkPath || !existsSync(sdkPath)) {
    const candidates = [
        join(process.cwd(), 'android-sdk'), // Local project SDK
        join(homedir(), 'Android', 'Sdk'), 
        join(homedir(), 'android-sdk'),
        '/usr/lib/android-sdk', 
        '/opt/android-sdk',
        '/Library/Android/sdk', 
        join(homedir(), 'AppData', 'Local', 'Android', 'Sdk')
    ];

    for (const cand of candidates) {
        if (cand && existsSync(cand)) {
            // Validate it has platforms
            if (existsSync(join(cand, 'platforms')) || existsSync(join(cand, 'cmdline-tools'))) {
                sdkPath = cand;
                console.log(`✅ Found Android SDK at: ${sdkPath}`);
                break;
            }
        }
    }
}

// 2. Install Portable SDK if missing
if (!sdkPath) {
    console.log('⚠️  Android SDK not found. Installing portable version (~150MB)...');
    console.log('   This is a one-time setup for this environment.');
    
    const portableSdkDir = join(process.cwd(), 'android-sdk');
    const cmdlineToolsZip = join(process.cwd(), 'cmdline-tools.zip');
    
    if (!existsSync(portableSdkDir)) mkdirSync(portableSdkDir);

    try {
        // A. Download Command Line Tools
        console.log('⬇️  Downloading Command Line Tools...');
        execSync(`curl -L -o "${cmdlineToolsZip}" "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"`, { stdio: 'inherit' });

        // B. Extract
        console.log('📦 Extracting...');
        // Ensure unzip exists
        try { execSync('unzip -v', { stdio: 'ignore' }); } 
        catch { 
            console.log('   Installing unzip...');
            execSync('sudo apt-get update && sudo apt-get install -y unzip', { stdio: 'ignore' }); 
        }
        
        execSync(`unzip -q "${cmdlineToolsZip}" -d "${portableSdkDir}"`);
        try { rmSync(cmdlineToolsZip); } catch(e){}

        // C. Fix Directory Structure for sdkmanager
        // sdkmanager expects to be in cmdline-tools/latest/bin
        const rawCmdline = join(portableSdkDir, 'cmdline-tools');
        const tempName = join(portableSdkDir, 'temp_latest');
        
        // Move cmdline-tools to temp
        renameSync(rawCmdline, tempName);
        // Create correct structure
        mkdirSync(rawCmdline);
        // Move temp to latest
        renameSync(tempName, join(rawCmdline, 'latest'));

        // D. Install Platforms and Build Tools
        console.log('📲 Installing Platforms & Build Tools (Accepting Licenses)...');
        const sdkmanager = join(rawCmdline, 'latest', 'bin', 'sdkmanager');
        const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: portableSdkDir };
        
        // Make executable
        chmodSync(sdkmanager, '755');

        // Yes to licenses
        execSync(`yes | "${sdkmanager}" --licenses --sdk_root="${portableSdkDir}"`, { env, stdio: 'ignore' });
        
        // Install specific versions (matches variables.gradle)
        execSync(`"${sdkmanager}" "platforms;android-34" "build-tools;34.0.0" "platform-tools" --sdk_root="${portableSdkDir}"`, { env, stdio: 'inherit' });
        
        sdkPath = portableSdkDir;
        console.log('✅ Portable SDK setup complete.');

    } catch (e) {
        console.error('❌ Failed to install Android SDK:', e.message);
        process.exit(1);
    }
}

// 3. Write local.properties
if (sdkPath) {
    const escapedPath = process.platform === 'win32' ? sdkPath.replace(/\\/g, '\\\\') : sdkPath;
    const localContent = `sdk.dir=${escapedPath}\n`;
    writeFileSync(localPropsPath, localContent);
    console.log(`📄 Updated local.properties`);
}

// --- STEP 3: PREPARE BUILD ENVIRONMENT ---
const env = { ...process.env };
if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${join(javaHome, 'bin')}:${env.PATH}`;
}
if (sdkPath) {
    env.ANDROID_HOME = sdkPath;
    env.PATH = `${join(sdkPath, 'platform-tools')}:${env.PATH}`;
}

const isWin = process.platform === 'win32';
let gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
const wrapperPath = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');

// Ensure Gradle Wrapper Exists and is Executable
if (!existsSync(wrapperPath)) {
    console.warn(`⚠️ Gradle Wrapper missing. Generating...`);
    try {
        execSync(`gradle wrapper --gradle-version 8.12`, { cwd: androidDir, env, stdio: 'inherit' });
        if (!isWin) chmodSync(wrapperPath, '755');
    } catch (e) {
        gradleCmd = 'gradle'; // Fallback
    }
} else if (!isWin) {
    try { chmodSync(wrapperPath, '755'); } catch (e) {}
}

// --- STEP 4: EXECUTE BUILD ---
let args = [];
let outputMsg = '';

if (mode === 'bundle') {
    args = ['clean', 'bundleRelease'];
    outputMsg = '👉 check android/app/build/outputs/bundle/release/app-release.aab';
} else if (mode === 'release') {
    args = ['clean', 'assembleRelease'];
    outputMsg = '👉 check android/app/build/outputs/apk/release/app-release.apk';
} else {
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
        process.exit(code);
    }
});
