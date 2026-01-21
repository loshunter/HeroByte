#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "🚀 Starting Pre-Push Checks..."

echo "--------------------------------------------------"
echo "📦 Step 1: Building project..."
echo "--------------------------------------------------"
pnpm build

echo "--------------------------------------------------"
echo "🧹 Step 2: Running Linting..."
echo "--------------------------------------------------"
pnpm lint

echo "--------------------------------------------------"
echo "🧪 Step 3: Running Unit Tests..."
echo "--------------------------------------------------"
pnpm test

echo "--------------------------------------------------"
echo "✅ All checks passed! You are ready to push."
echo "--------------------------------------------------"
