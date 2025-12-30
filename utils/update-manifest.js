
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// --- AUTO-FIX: TRIGGER ICON REPLACEMENT ---
try {
  console.log('🎨 Triggering Auto-Icon Replacement from Manifest Script...');
  if (existsSync('scripts/set-android-icon.js')) {
      execSync('node scripts/set-android-icon.js', { stdio: 'inherit' });
  } else {
      console.warn('⚠️ Warning: scripts/set-android-icon.js not found.');
  }
} catch (e) {
  console.warn('⚠️ Warning: Could not auto-run set-android-icon.js:', e.message);
}
// ------------------------------------------

// 1. UPDATE ANDROID MANIFEST
const manifestPath = join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
console.log('🔧 Checking AndroidManifest.xml settings...');

if (existsSync(manifestPath)) {
  let content = readFileSync(manifestPath, 'utf-8');
  let hasChanges = false;

  const permissions = [
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.CAMERA" />'
  ];

  permissions.forEach(perm => {
    if (!content.includes(perm)) {
       const tagName = perm.match(/android:name="([^"]+)"/)[1];
       content = content.replace('<application', `${perm}\n    <application`);
       console.log(`✅ Injected permission: ${tagName}`);
       hasChanges = true;
    }
  });

  if (!content.includes('android:icon="@mipmap/ic_launcher"')) {
      if (content.includes('android:icon=')) {
          content = content.replace(/android:icon="[^"]*"/, 'android:icon="@mipmap/ic_launcher"');
      } else {
          content = content.replace('<application', '<application android:icon="@mipmap/ic_launcher"');
      }
      console.log('✅ Enforced android:icon="@mipmap/ic_launcher"');
      hasChanges = true;
  }

  if (!content.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
      if (content.includes('android:roundIcon=')) {
          content = content.replace(/android:roundIcon="[^"]*"/, 'android:roundIcon="@mipmap/ic_launcher_round"');
      } else {
          content = content.replace('<application', '<application android:roundIcon="@mipmap/ic_launcher_round"');
      }
      console.log('✅ Enforced android:roundIcon="@mipmap/ic_launcher_round"');
      hasChanges = true;
  }

  if (!content.includes('android:usesCleartextTraffic="true"')) {
    if (content.includes('android:usesCleartextTraffic=')) {
        content = content.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="true"');
    } else {
        content = content.replace('<application', '<application android:usesCleartextTraffic="true"');
    }
    console.log('✅ Enforced Cleartext Traffic support');
    hasChanges = true;
  }

  const deepLinkScheme = "io.halalscanner.ai"; 
  const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${deepLinkScheme}" android:host="login-callback" />
            </intent-filter>
  `;

  if (!content.includes(`android:scheme="${deepLinkScheme}"`)) {
      content = content.replace('</activity>', `${intentFilter}\n        </activity>`);
      console.log(`✅ Injected OAuth Deep Link Intent Filter for scheme: ${deepLinkScheme}`);
      hasChanges = true;
  }

  if (hasChanges) {
    writeFileSync(manifestPath, content);
    console.log('💾 AndroidManifest.xml updated successfully.');
  } else {
    console.log('👍 Manifest is already correct.');
  }
} else {
  console.error(`❌ Manifest file not found at: ${manifestPath}.`);
}

// 2. INJECT STRINGS.XML FOR GOOGLE AUTH (Fix for Error 10)
// This explicitly tells the native Android plugin which Web Client ID to use for the token exchange.
const stringsPath = join('android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const valuesDir = join('android', 'app', 'src', 'main', 'res', 'values');
// This is the WEB Client ID (matches capacitor.config.ts), NOT the Android Client ID.
const WEB_CLIENT_ID = "565514314234-9ae9k1bf0hhubkacivkuvpu01duqfthv.apps.googleusercontent.com";

console.log('🔧 Checking strings.xml for Google Auth configuration...');

if (!existsSync(valuesDir)) {
    mkdirSync(valuesDir, { recursive: true });
}

let stringsContent = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Halal Scanner</string>
    <string name="title_activity_main">Halal Scanner</string>
    <string name="package_name">io.halalscanner.ai</string>
    <string name="custom_url_scheme">io.halalscanner.ai</string>
    <string name="server_client_id">${WEB_CLIENT_ID}</string>
</resources>`;

if (existsSync(stringsPath)) {
    let currentStrings = readFileSync(stringsPath, 'utf-8');
    if (!currentStrings.includes('server_client_id')) {
        // Simple injection if not present, otherwise overwrite file to be safe
        console.log('🔄 Injecting server_client_id into strings.xml');
        currentStrings = currentStrings.replace('</resources>', `    <string name="server_client_id">${WEB_CLIENT_ID}</string>\n</resources>`);
        writeFileSync(stringsPath, currentStrings);
    } else if (!currentStrings.includes(WEB_CLIENT_ID)) {
        console.log('🔄 Updating server_client_id in strings.xml');
        // Regex replace to ensure we use the correct ID
        currentStrings = currentStrings.replace(/<string name="server_client_id">.*<\/string>/, `<string name="server_client_id">${WEB_CLIENT_ID}</string>`);
        writeFileSync(stringsPath, currentStrings);
    } else {
        console.log('👍 strings.xml already contains correct server_client_id.');
    }
} else {
    console.log('🆕 Creating strings.xml with server_client_id');
    writeFileSync(stringsPath, stringsContent);
}
