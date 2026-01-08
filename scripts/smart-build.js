
import { spawn, execSync } from 'child_process';
import { readdirSync, existsSync, chmodSync } from 'fs';
import { join, resolve } from 'path';

console.log('\n🚀 Starting Smart Android Build...\n');

// 1. Find compatible Java (Priority: 17 > 21 > 11)
const jvmBaseDir = '/usr/lib/jvm';
let javaHome = process.env.JAVA_HOME;
let foundCompatibleJDK = false;

if (existsSync(jvmBaseDir)) {
    try {
        const entries = readdirSync(jvmBaseDir);
        const candidates = entries.filter(e => {
            const lower = e.toLowerCase();
            return (lower.includes('17') || lower.includes('21') || lower.includes('11')) && 
                   !lower.includes('common') && 
                   !lower.includes('doc') &&
                   !e.startsWith('.') &&
                   !e.endsWith('.jinfo');
        }).sort();

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

// 2. Prepare Environment
const env = { ...process.env };
if (foundCompatibleJDK && javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${join(javaHome, 'bin')}:${env.PATH}`;
}

const androidDir = resolve('android');
const isWin = process.platform === 'win32';
let gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
const wrapperPath = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');

// 3. Ensure Gradle Wrapper Exists
if (!existsSync(wrapperPath)) {
    console.warn(`⚠️ Gradle Wrapper missing. Generating one (v8.4)...`);
    try {
        // We use system gradle to generate the wrapper with a specific version
        // Gradle 8.4 is stable and compatible with AGP 8.2
        execSync(`gradle wrapper --gradle-version 8.4`, { 
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

const args = ['clean', 'assembleDebug', '--stacktrace'];

console.log(`🔨 Executing Gradle in: ${androidDir}`);
console.log(`👉 Command: ${gradleCmd} ${args.join(' ')}`);

const buildProcess = spawn(gradleCmd, args, {
    cwd: androidDir,
    stdio: 'inherit',
    env: env
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
