#!/bin/bash

# Database setup script - initializes and seeds the elearning database

echo "🚀 Setting up elearning database..."
echo ""

# Initialize database schema
echo "📋 Initializing database schema..."
npm run db:init
if [ $? -ne 0 ]; then
  echo "❌ Database initialization failed"
  exit 1
fi

echo "✅ Database schema created"
echo ""

# Seed database with courses
echo "🌱 Seeding database with courses..."
npm run seed
if [ $? -ne 0 ]; then
  echo "❌ Database seeding failed"
  exit 1
fi

echo "✅ Database seeded with courses"
echo ""
echo "🎉 Database setup complete!"
echo ""
echo "You can now run: npm run dev"
echo "Then visit: http://localhost:3000"
