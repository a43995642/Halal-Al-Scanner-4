
import { writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

console.log('🔧 Repairing Android configuration files...');

const projectRoot = resolve();
const androidDir = join(projectRoot, 'android');

if (!existsSync(androidDir)) {
   console.error("❌ Android directory missing. 'npx cap add android' failed?");
   process.exit(0);
}

// 1. variables.gradle (Capacitor Config)
const variablesPath = join(androidDir, 'variables.gradle');
if (!existsSync(variablesPath)) {
    const variablesContent = `ext {
        minSdkVersion = 22
        compileSdkVersion = 34
        targetSdkVersion = 34
        androidxActivityVersion = '1.8.0'
        androidxAppCompatVersion = '1.6.1'
        androidxCoordinatorLayoutVersion = '1.2.0'
        androidxCoreKTXVersion = '1.12.0'
        androidxFragmentVersion = '1.6.2'
        coreSplashScreenVersion = '1.0.1'
        androidxWebkitVersion = '1.9.0'
        junitVersion = '4.13.2'
        androidxJunitVersion = '1.1.5'
        androidxEspressoCoreVersion = '3.5.1'
        cordovaAndroidVersion = '10.1.1'
    }`;
    writeFileSync(variablesPath, variablesContent);
    console.log('✅ Created android/variables.gradle');
}

// 2. settings.gradle (CRITICAL: Links the :app module)
const settingsPath = join(androidDir, 'settings.gradle');
if (!existsSync(settingsPath)) {
    const settingsContent = `include ':app'`;
    writeFileSync(settingsPath, settingsContent);
    console.log('✅ Created android/settings.gradle');
}

// 3. build.gradle (Root Project Config)
const buildGradlePath = join(androidDir, 'build.gradle');
if (!existsSync(buildGradlePath)) {
    const buildGradleContent = `
    buildscript {
        repositories {
            google()
            mavenCentral()
        }
        dependencies {
            classpath 'com.android.tools.build:gradle:8.2.1'
            classpath 'com.google.gms:google-services:4.4.0'
        }
    }

    allprojects {
        repositories {
            google()
            mavenCentral()
        }
    }

    task clean(type: Delete) {
        delete rootProject.buildDir
    }
    `;
    writeFileSync(buildGradlePath, buildGradleContent);
    console.log('✅ Created android/build.gradle');
}

// 4. gradle.properties (JVM Args)
const gradlePropsPath = join(androidDir, 'gradle.properties');
if (!existsSync(gradlePropsPath)) {
    const propsContent = `
    org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
    android.useAndroidX=true
    android.enableJetifier=true
    `;
    writeFileSync(gradlePropsPath, propsContent);
    console.log('✅ Created android/gradle.properties');
}
