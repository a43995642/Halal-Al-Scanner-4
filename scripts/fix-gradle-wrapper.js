
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔧 Fixing Gradle Wrapper compatibility...');

const wrapperPath = join('android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

if (existsSync(wrapperPath)) {
    let content = readFileSync(wrapperPath, 'utf-8');
    // Upgrade to Gradle 8.12 (Latest stable) to support newer Java versions
    const newDistUrl = 'https\\://services.gradle.org/distributions/gradle-8.12-all.zip';
    
    if (content.includes('distributionUrl')) {
        content = content.replace(/distributionUrl=.*/, `distributionUrl=${newDistUrl}`);
        writeFileSync(wrapperPath, content);
        console.log('✅ Updated Gradle Wrapper to 8.12');
    } else {
        console.warn('⚠️ distributionUrl not found in gradle-wrapper.properties');
    }
} else {
    console.error('⚠️ gradle-wrapper.properties not found at:', wrapperPath);
}
