#!/bin/bash

# هذا السكربت يقوم بإصلاح أذونات البناء وتنظيف ملفات Android القديمة
# This script fixes build permissions and cleans old Android files

echo "🔧 Starting Android Fix Script..."

# التأكد من وجود مجلد android
if [ ! -d "android" ]; then
  echo "❌ Error: 'android' directory not found. Please run 'npx cap add android' first."
  exit 1
fi

cd android

# 1. منح صلاحيات التنفيذ لملف gradlew (مهم جداً في بيئات Mac/Linux/CI)
echo "🔑 Granting execution permissions to gradlew..."
chmod +x gradlew

# 2. تنظيف المشروع لإزالة أي كاش قديم قد يسبب مشاكل
echo "🧹 Cleaning Gradle project..."
./gradlew clean

echo "✅ Android environment fixed successfully!"