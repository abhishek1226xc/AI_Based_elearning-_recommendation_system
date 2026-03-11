#!/usr/bin/env node

/**
 * Database setup script - initializes and seeds the elearning database
 * Run with: node setup-db.js or npx tsx setup-db.ts
 */

import { spawn } from "child_process";

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  Running: ${command} ${args.join(" ")}`);
    const child = spawn(command, args, { stdio: "inherit" });
    
    child.on("error", (err) => {
      console.error(`❌ Error: ${err.message}`);
      reject(err);
    });
    
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function setupDatabase() {
  console.log("🚀 Setting up elearning database...\n");
  
  try {
    console.log("📋 Step 1: Initializing database schema...");
    await runCommand("npm", ["run", "db:init"]);
    console.log("✅ Database schema created\n");
    
    console.log("🌱 Step 2: Seeding database with courses...");
    await runCommand("npm", ["run", "seed"]);
    console.log("✅ Database seeded with courses\n");
    
    console.log("🎉 Database setup complete!");
    console.log("\n📝 Next steps:");
    console.log("   1. npm run dev");
    console.log("   2. Open http://localhost:3000");
    console.log("\n✨ Your site should now display all 100+ courses!\n");
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  }
}

setupDatabase();
