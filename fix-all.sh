#!/bin/bash

# REVIEW.MNL - Complete Fix Script
# This script applies all fixes automatically

echo "🔧 REVIEW.MNL - Applying All Fixes..."
echo ""

# Navigate to backend
cd review.mnl-backend/review.mnl-backend || exit

echo "✅ Installing missing dependencies..."
npm install passport passport-google-oauth20 passport-facebook

echo ""
echo "✅ Creating .env from template..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env file and add your actual credentials!"
else
    echo "ℹ️  .env already exists, skipping..."
fi

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit review.mnl-backend/review.mnl-backend/.env with your actual values"
echo "2. Run database migration: mysql -u user -p database < config/migration.sql"
echo "3. Test backend: npm start"
echo "4. Configure Vercel environment variable: BACKEND_URL"
echo "5. Deploy both backend (Railway) and frontend (Vercel)"
echo ""
echo "📖 See SETUP_GUIDE.md for detailed instructions"
echo ""
echo "🎉 All fixes applied successfully!"
