
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🏗️  Checking Android resource folders...');

// Define the standard Android mipmap folders
const baseDir = join('android', 'app', 'src', 'main', 'res');
const folders = [
  'mipmap-hdpi',
  'mipmap-mdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi'
];

try {
  // Ensure base directory exists (recursive will create parent folders like android/app/...)
  if (!existsSync(baseDir)) {
    console.log(`📁 Creating base directory: ${baseDir}`);
    mkdirSync(baseDir, { recursive: true });
  }

  // Create each density folder
  folders.forEach(folder => {
    const fullPath = join(baseDir, folder);
    if (!existsSync(fullPath)) {
      console.log(`   + Creating ${folder}`);
      mkdirSync(fullPath, { recursive: true });
    }
  });

  console.log('\n✅ All Android icon folders are ready!');
  console.log('👉 You can now upload your icons to: android/app/src/main/res/');

} catch (error) {
  console.error('❌ Error creating folders:', error);
}
