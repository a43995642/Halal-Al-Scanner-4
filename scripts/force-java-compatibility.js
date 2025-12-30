
import { appendFileSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('☕ Searching dynamically for a compatible JDK (17/21/11)...');

let selectedJavaPath = null;
const jvmBaseDir = '/usr/lib/jvm';

try {
    if (existsSync(jvmBaseDir)) {
        const entries = readdirSync(jvmBaseDir);
        
        // Filter for directories that look like java homes (containing 17, 21, or 11)
        // We prioritize 17 as it's the standard for Android builds currently.
        const candidates = entries.filter(e => {
            const lower = e.toLowerCase();
            return (lower.includes('17') || lower.includes('21') || lower.includes('11')) && 
                   !lower.includes('common') && // skip shortcut folders
                   !lower.includes('doc') &&
                   !e.startsWith('.') &&       // FIX: Ignore hidden files/folders like .temurin-17...
                   !e.endsWith('.jinfo');      // FIX: Ignore .jinfo metadata files
        }).sort(); // Sorting helps ensure deterministic selection

        console.log('🔎 Found candidates:', candidates);

        // Try to pick the best match
        const bestMatch = candidates.find(c => c.includes('17')) || 
                          candidates.find(c => c.includes('21')) || 
                          candidates[0];
        
        if (bestMatch) {
            selectedJavaPath = join(jvmBaseDir, bestMatch);
            console.log(`✅ Discovered JDK at: ${selectedJavaPath}`);
        }
    }
} catch (e) {
    console.warn('⚠️ Error searching /usr/lib/jvm:', e.message);
}

// Fallback: Check environment variable if search failed
if (!selectedJavaPath && process.env.JAVA_HOME_17_X64) {
    selectedJavaPath = process.env.JAVA_HOME_17_X64;
    console.log(`✅ Using env JAVA_HOME_17_X64: ${selectedJavaPath}`);
}

if (selectedJavaPath) {
    const propertiesPath = join('android', 'gradle.properties');
    let content = '';
    
    // Create file if it doesn't exist
    if (existsSync(propertiesPath)) {
        content = readFileSync(propertiesPath, 'utf-8');
    }

    // Prepare the property line
    const propertyLine = `org.gradle.java.home=${selectedJavaPath}`;

    // Check if org.gradle.java.home is already set
    if (content.includes('org.gradle.java.home')) {
        // Update existing
        content = content.replace(/org\.gradle\.java\.home=.*/, propertyLine);
        console.log('🔄 Updated org.gradle.java.home in gradle.properties');
    } else {
        // Append new
        content += `\n${propertyLine}\n`;
        console.log('➕ Added org.gradle.java.home to gradle.properties');
    }
    
    writeFileSync(propertiesPath, content);
} else {
    console.warn('⚠️ No specific JDK 17/21 found in /usr/lib/jvm. Gradle will try to use the system default.');
    console.warn('   Note: If build fails with "class file major version 69", it means system default is Java 25 which is too new.');
}
