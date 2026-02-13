
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

console.log('☕ Searching dynamically for a compatible JDK (17/21/11)...');

let selectedJavaPath = null;

// Helper to check if a path looks like a valid JDK home
const isValidJdkHome = (path) => {
    if (!path || !existsSync(path)) return false;
    const lower = path.toLowerCase();
    // Check for version numbers in the path
    const hasVersion = lower.includes('17') || lower.includes('21') || lower.includes('11') || lower.includes('1.8');
    // Check if bin/java exists
    const hasBinJava = existsSync(join(path, 'bin', 'java'));
    return hasVersion && hasBinJava;
};

// 1. Try standard Linux directories
const searchPaths = ['/usr/lib/jvm', '/usr/java', '/opt/java', '/usr/local/openjdk'];

for (const baseDir of searchPaths) {
    if (!selectedJavaPath && existsSync(baseDir)) {
        try {
            const entries = readdirSync(baseDir);
            console.log(`🔎 Scanning ${baseDir}:`, entries);
            
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
                const fullPath = join(baseDir, bestMatch);
                if (existsSync(join(fullPath, 'bin', 'java'))) {
                    selectedJavaPath = fullPath;
                    console.log(`✅ Discovered JDK via directory search: ${selectedJavaPath}`);
                }
            }
        } catch (e) {
            console.warn(`⚠️ Could not scan ${baseDir}:`, e.message);
        }
    }
}

// 2. Try update-alternatives (Linux specific)
if (!selectedJavaPath && process.platform === 'linux') {
    try {
        const output = execSync('update-alternatives --list java', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        const lines = output.split('\n');
        console.log('🔎 update-alternatives candidates:', lines);
        
        // Find a line that has 17, 21, or 11
        // Lines usually look like: /usr/lib/jvm/java-17-openjdk-amd64/bin/java
        const validLine = lines.find(l => l.includes('17') || l.includes('21') || l.includes('11'));
        
        if (validLine) {
            // Strip '/bin/java' from the end to get JAVA_HOME
            selectedJavaPath = validLine.replace(/\/bin\/java$/, '').replace(/\/bin\/java.exe$/, '');
            console.log(`✅ Discovered JDK via update-alternatives: ${selectedJavaPath}`);
        }
    } catch (e) {
        // update-alternatives might fail if only one java is installed or command missing
        console.log('ℹ️ update-alternatives check skipped or failed.');
    }
}

// 3. Fallback: Check environment variables
if (!selectedJavaPath) {
    if (process.env.JAVA_HOME && isValidJdkHome(process.env.JAVA_HOME)) {
        selectedJavaPath = process.env.JAVA_HOME;
        console.log(`✅ Using existing JAVA_HOME: ${selectedJavaPath}`);
    } else if (process.env.JAVA_HOME_17_X64 && isValidJdkHome(process.env.JAVA_HOME_17_X64)) {
        selectedJavaPath = process.env.JAVA_HOME_17_X64;
        console.log(`✅ Using env JAVA_HOME_17_X64: ${selectedJavaPath}`);
    }
}

// 4. Apply Configuration
if (selectedJavaPath) {
    const propertiesPath = join('android', 'gradle.properties');
    let content = '';
    
    if (existsSync(propertiesPath)) {
        content = readFileSync(propertiesPath, 'utf-8');
    }

    const propertyLine = `org.gradle.java.home=${selectedJavaPath}`;

    if (content.includes('org.gradle.java.home')) {
        content = content.replace(/org\.gradle\.java\.home=.*/, propertyLine);
        console.log('🔄 Updated org.gradle.java.home in gradle.properties');
    } else {
        content += `\n${propertyLine}\n`;
        console.log('➕ Added org.gradle.java.home to gradle.properties');
    }
    
    writeFileSync(propertiesPath, content);
    
    // Also verify java version of the selected path
    try {
        const javaBin = join(selectedJavaPath, 'bin', 'java');
        const versionOut = execSync(`"${javaBin}" -version`, { encoding: 'utf8', stdio: 'pipe' }); // java -version outputs to stderr usually
    } catch (e) {
        // java -version writes to stderr, so execSync might throw if it treats stderr as error, 
        // but usually just returns output. If it fails, ignore.
    }

} else {
    console.warn('⚠️ CRITICAL: No specific JDK 17/21/11 found. Gradle will use system default.');
    console.warn('   If the system default is Java 25 (Class file 69), the build WILL FAIL.');
    console.warn('   SOLUTION: Install OpenJDK 17 manually: sudo apt-get install openjdk-17-jdk');
    
    // Attempt to clear org.gradle.java.home if it points to a bad location? 
    // No, better to leave it or user might have set it manually.
}
