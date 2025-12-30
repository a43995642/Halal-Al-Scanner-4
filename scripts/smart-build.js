import { spawn } from 'child_process';
import { readdirSync, existsSync, chmodSync } from 'fs';
import { join, resolve } from 'path';

console.log('\n🚀 Starting Smart Android Build (Java Fix)...\n');

// 1. Find compatible Java (Priority: 17 > 21 > 11)
const jvmBaseDir = '/usr/lib/jvm';
let javaHome = process.env.JAVA_HOME;
let foundCompatibleJDK = false;

if (existsSync(jvmBaseDir)) {
    try {
        const entries = readdirSync(jvmBaseDir);
        // Filter for valid JDK folders
        const candidates = entries.filter(e => {
            const lower = e.toLowerCase();
            return (lower.includes('17') || lower.includes('21') || lower.includes('11')) && 
                   !lower.includes('common') && 
                   !lower.includes('doc') &&
                   !e.startsWith('.') &&       // FIX: Ignore hidden files/folders
                   !e.endsWith('.jinfo');      // FIX: Ignore .jinfo files
        }).sort();

        // Try to pick Java 17 specifically as it's the most stable for AGP 8.x
        const bestMatch = candidates.find(c => c.includes('17')) || 
                          candidates.find(c => c.includes('21')) || 
                          candidates[0];

        if (bestMatch) {
            javaHome = join(jvmBaseDir, bestMatch);
            foundCompatibleJDK = true;
            console.log(`✅ FORCE USING COMPATIBLE JDK: ${javaHome}`);
        }
    } catch (e) {
        console.warn("⚠️ Could not scan /usr/lib/jvm, using system default.");
    }
}

// 2. Prepare Environment with Forced JAVA_HOME
const env = { ...process.env };
if (foundCompatibleJDK && javaHome) {
    env.JAVA_HOME = javaHome;
    // Prepend to PATH to ensure 'java' command uses this version
    env.PATH = `${join(javaHome, 'bin')}:${env.PATH}`;
}

// 3. Run Gradle Wrapper
const androidDir = resolve('android');
const isWin = process.platform === 'win32';
const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
const args = ['clean', 'assembleDebug', '--stacktrace'];

// Ensure executable permission
if (!isWin) {
    try {
        chmodSync(join(androidDir, 'gradlew'), '755');
    } catch (e) {
        console.warn("⚠️ Could not chmod gradlew, hoping for the best.");
    }
}

console.log(`🔨 Executing Gradle in: ${androidDir}`);
console.log(`👉 Command: ${gradleCmd} ${args.join(' ')}`);

const buildProcess = spawn(gradleCmd, args, {
    cwd: androidDir,
    stdio: 'inherit', // Show output directly in terminal
    env: env          // Pass the modified environment with correct JAVA_HOME
});

buildProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n🎉 APK Build Successful!');
        console.log('👉 check android/app/build/outputs/apk/debug/app-debug.apk');
    } else {
        console.error(`\n❌ Build Failed with code ${code}. See logs above.`);
        process.exit(code);
    }
});