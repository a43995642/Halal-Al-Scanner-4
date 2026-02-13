
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

console.log('☕ Searching dynamically for a compatible JDK (17/21/11)...');

let selectedJavaPath = null;

// Helper to check if a path looks like a valid JDK home
const isValidJdkHome = (path) => {
    if (!path || !existsSync(path)) return false;
    // Check if bin/java exists
    return existsSync(join(path, 'bin', 'java'));
};

const findJdkInDir = (baseDir) => {
    if (!existsSync(baseDir)) return null;
    try {
        const entries = readdirSync(baseDir);
        // Filter for versioned folders
        const candidates = entries.filter(e => {
            const lower = e.toLowerCase();
            return (lower.includes('17') || lower.includes('21') || lower.includes('11') || lower.includes('1.8')) && 
                   !lower.includes('common') && 
                   !lower.includes('doc') && 
                   !e.startsWith('.');
        }).sort();

        // Prefer 17, then 21, then others
        const bestMatch = candidates.find(c => c.includes('17')) || 
                          candidates.find(c => c.includes('21')) || 
                          candidates[0];
        
        if (bestMatch) return join(baseDir, bestMatch);
    } catch (e) {
        return null;
    }
    return null;
};

// 1. Search Standard Paths
const searchPaths = ['/usr/lib/jvm', '/usr/java', '/opt/java', '/usr/local/openjdk'];
for (const dir of searchPaths) {
    if (selectedJavaPath) break;
    selectedJavaPath = findJdkInDir(dir);
}

// 2. Try update-alternatives if still not found
if (!selectedJavaPath && process.platform === 'linux') {
    try {
        const output = execSync('update-alternatives --list java', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        const lines = output.split('\n');
        const validLine = lines.find(l => l.includes('17') || l.includes('21') || l.includes('11'));
        if (validLine) {
            // Convert /usr/lib/jvm/java-17.../bin/java to JAVA_HOME
            selectedJavaPath = validLine.replace(/\/bin\/java$/, '').replace(/\/bin\/java.exe$/, '');
        }
    } catch (e) {}
}

// 3. AUTO-INSTALL if missing (Specific for Codespaces/Linux)
if (!selectedJavaPath && process.platform === 'linux') {
    console.log('⚠️ No compatible JDK found. Attempting auto-install of OpenJDK 17...');
    try {
        console.log('📦 Installing openjdk-17-jdk-headless (this may take a moment)...');
        // Update apt cache quietly
        try { execSync('sudo apt-get update -qq', { stdio: 'inherit' }); } catch(e) {}
        
        // Install JDK 17
        execSync('sudo apt-get install -y -qq openjdk-17-jdk-headless', { stdio: 'inherit' });
        console.log('✅ Installation complete.');
        
        // Direct check for the standard installation path
        const standardPath = '/usr/lib/jvm/java-17-openjdk-amd64';
        if (isValidJdkHome(standardPath)) {
            selectedJavaPath = standardPath;
        } else {
            // Re-scan /usr/lib/jvm if path differs
            selectedJavaPath = findJdkInDir('/usr/lib/jvm');
        }
    } catch (e) {
        console.error('❌ Auto-install failed. Please install JDK 17 manually.', e.message);
    }
}

// 4. Apply Configuration
if (selectedJavaPath && isValidJdkHome(selectedJavaPath)) {
    console.log(`✅ Selected JDK: ${selectedJavaPath}`);
    
    const propertiesPath = join('android', 'gradle.properties');
    let content = '';
    if (existsSync(propertiesPath)) content = readFileSync(propertiesPath, 'utf-8');

    const propertyLine = `org.gradle.java.home=${selectedJavaPath}`;
    
    // Update or Append
    if (content.includes('org.gradle.java.home')) {
        content = content.replace(/org\.gradle\.java\.home=.*/g, propertyLine);
    } else {
        content += `\n${propertyLine}\n`;
    }
    
    writeFileSync(propertiesPath, content);
    console.log('🔄 Updated android/gradle.properties with JDK path.');
} else {
    console.warn('⚠️ CRITICAL: Could not find or install JDK 17/21. The build will likely fail if the system Java is v25 (Class 69).');
}
