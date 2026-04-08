/**
 * Database seed script — populates SQLite with sample courses from real platforms,
 * users, profiles, platform ratings, bookmarks, and interactions for ML training.
 *
 * Run with: pnpm seed (or npx tsx seed-db.ts)
 */
// HERE ARE THE COURCES ARE THERE DETAILS WHICH ARE PROVIDED IN THE COURSES TABLE IN THE DATABASE

import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { hashPassword } from "./server/utils/crypto.js";

const dbDir = path.resolve(import.meta.dirname, "data");
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, "elearning.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Drop and recreate tables ────────────────────────────────────────
db.pragma("foreign_keys = OFF");
db.exec(`
    DROP TABLE IF EXISTS courses_fts;
  DROP TABLE IF EXISTS recommendationFeedback;
  DROP TABLE IF EXISTS recommendations;
  DROP TABLE IF EXISTS courseInteractions;
  DROP TABLE IF EXISTS userProgress;
  DROP TABLE IF EXISTS bookmarks;
  DROP TABLE IF EXISTS platformRatings;
    DROP TABLE IF EXISTS userLoginHistory;
    DROP TABLE IF EXISTS userLearningPaths;
    DROP TABLE IF EXISTS adminActivityLog;
  DROP TABLE IF EXISTS userProfiles;
  DROP TABLE IF EXISTS courses;
  DROP TABLE IF EXISTS users;
`);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    passwordHash TEXT,
    loginMethod TEXT,
    role TEXT NOT NULL DEFAULT 'user',
        onboardingCompletedAt INTEGER,
        isActive INTEGER NOT NULL DEFAULT 1,
        isBanned INTEGER NOT NULL DEFAULT 0,
        lastLoginIp TEXT,
        resetPasswordToken TEXT,
        resetPasswordExpiresAt INTEGER,
        adminNotes TEXT,
        sessionInvalidatedAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS userProfiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    skills TEXT,
    interests TEXT,
    learningGoals TEXT,
    preferredDifficulty TEXT DEFAULT 'intermediate',
    learningStyle TEXT,
    bio TEXT,
        onboardingCompletedAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    tags TEXT,
    instructor TEXT,
    duration INTEGER,
    platform TEXT DEFAULT 'Udemy',
    platformUrl TEXT,
    platformPrice TEXT DEFAULT 'Free',
    rating INTEGER DEFAULT 0,
    platformRating INTEGER DEFAULT 0,
    reviewCount INTEGER DEFAULT 0,
    learnerCount INTEGER DEFAULT 0,
    completionRate INTEGER DEFAULT 0,
    thumbnailUrl TEXT,
    contentUrl TEXT,
    lastSyncedAt INTEGER DEFAULT (unixepoch()),
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS platformRatings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courseId INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    rating INTEGER DEFAULT 0,
    reviewCount INTEGER DEFAULT 0,
    price TEXT DEFAULT 'Free',
    url TEXT,
    lastUpdated INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courseId INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    notes TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS courseInteractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courseId INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    interactionType TEXT NOT NULL,
    rating INTEGER,
    timeSpent INTEGER,
    completionPercentage INTEGER DEFAULT 0,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS userProgress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courseId INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrollmentDate INTEGER NOT NULL DEFAULT (unixepoch()),
    completionDate INTEGER,
    completionPercentage INTEGER DEFAULT 0,
    quizScores TEXT,
    lastAccessedAt INTEGER DEFAULT (unixepoch()),
    status TEXT DEFAULT 'enrolled',
    totalTimeSpent INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courseId INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    score INTEGER,
    reason TEXT,
    algorithm TEXT NOT NULL,
    rank INTEGER,
    generatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    expiresAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recommendationFeedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendationId INTEGER NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    feedback TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  );

    CREATE TABLE IF NOT EXISTS userLearningPaths (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pathName TEXT NOT NULL,
        description TEXT,
        courseIds TEXT NOT NULL,
        currentCourseIndex INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
        updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS userLoginHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        loginAt INTEGER NOT NULL DEFAULT (unixepoch()),
        ipAddress TEXT,
        userAgent TEXT,
        success INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS adminActivityLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adminId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        targetUserId INTEGER REFERENCES users(id),
        targetCourseId INTEGER REFERENCES courses(id),
        details TEXT,
        performedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS courses_fts USING fts5(
        title,
        description,
        tags,
        content=courses,
        content_rowid=id
    );

    CREATE INDEX IF NOT EXISTS idx_courseInteractions_userId ON courseInteractions (userId);
    CREATE INDEX IF NOT EXISTS idx_courseInteractions_courseId ON courseInteractions (courseId);
    CREATE INDEX IF NOT EXISTS idx_userProgress_userId ON userProgress (userId);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_userId ON bookmarks (userId);
    CREATE INDEX IF NOT EXISTS idx_recommendations_userId ON recommendations (userId);
    CREATE INDEX IF NOT EXISTS idx_recommendations_expiresAt ON recommendations (expiresAt);
    CREATE INDEX IF NOT EXISTS idx_platformRatings_courseId ON platformRatings (courseId);
    CREATE INDEX IF NOT EXISTS idx_recommendationFeedback_userId ON recommendationFeedback (userId);
    CREATE INDEX IF NOT EXISTS idx_recommendationFeedback_recommendationId ON recommendationFeedback (recommendationId);
    CREATE INDEX IF NOT EXISTS idx_loginHistory_userId ON userLoginHistory(userId);
    CREATE INDEX IF NOT EXISTS idx_learningPaths_userId ON userLearningPaths(userId);
    CREATE INDEX IF NOT EXISTS idx_adminLog_adminId ON adminActivityLog(adminId);
`);

// ─── Seed data ───────────────────────────────────────────────────────
const now = Math.floor(Date.now() / 1000);

// Clear
db.exec("DELETE FROM recommendationFeedback");
db.exec("DELETE FROM recommendations");
db.exec("DELETE FROM courseInteractions");
db.exec("DELETE FROM userProgress");
db.exec("DELETE FROM bookmarks");
db.exec("DELETE FROM platformRatings");
db.exec("DELETE FROM userLoginHistory");
db.exec("DELETE FROM userLearningPaths");
db.exec("DELETE FROM adminActivityLog");
db.exec("DELETE FROM userProfiles");
db.exec("DELETE FROM courses");
db.exec("DELETE FROM users");
console.log("🗑️  Cleared existing data");

// ── Users ────────────────────────────────────────────────────────────
const insertUser = db.prepare(
    `INSERT INTO users (
        openId,
        name,
        email,
        passwordHash,
        loginMethod,
        role,
        onboardingCompletedAt,
        isActive,
        isBanned,
        lastLoginIp,
        resetPasswordToken,
        resetPasswordExpiresAt,
        adminNotes,
        sessionInvalidatedAt,
        createdAt,
        updatedAt,
        lastSignedIn
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const randomInt = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomIp = () => `192.168.${randomInt(0, 254)}.${randomInt(1, 254)}`;

const adminResult = insertUser.run(
    "admin-user",
    "Admin",
    "admin@elearning.com",
    hashPassword("Admin@1234"),
    "email",
    "admin",
    now,
    1,
    0,
    "192.168.1.10",
    null,
    null,
    "Seeded admin account",
    null,
    now,
    now,
    now
);
const adminId = Number(adminResult.lastInsertRowid);

const firstNames = [
    "Ava", "Noah", "Liam", "Emma", "Mason", "Olivia", "Lucas", "Sophia", "Ethan", "Mia",
    "Aria", "Logan", "Zoe", "Elijah", "Chloe", "James", "Isla", "Daniel", "Grace", "Henry",
    "Nora", "Leo", "Lily", "Carter", "Hazel", "Jack", "Aurora", "Owen", "Riley", "Evelyn",
];
const lastNames = [
    "Patel", "Garcia", "Lee", "Khan", "Nguyen", "Martinez", "Smith", "Brown", "Clark", "Lopez",
    "Hernandez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "White", "Harris", "Martin",
];

const studentUsers: Array<{ id: number; name: string; email: string; isBanned: number }> = [];

for (let i = 1; i <= 30; i++) {
    const first = firstNames[(i - 1) % firstNames.length];
    const last = lastNames[(i - 1) % lastNames.length];
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`;
    const openId = `student-${i}`;
    const isBanned = Math.random() < 0.1 ? 1 : 0;
    const lastSignedIn = now - randomInt(0, 30 * 24 * 60 * 60);
    const onboardingCompletedAt = now - randomInt(1, 21 * 24 * 60 * 60);

    const result = insertUser.run(
        openId,
        name,
        email,
        hashPassword(`Student@${i}pass`),
        "email",
        "user",
        onboardingCompletedAt,
        1,
        isBanned,
        randomIp(),
        null,
        null,
        isBanned ? "Flagged for repeated failed logins" : null,
        null,
        now,
        now,
        lastSignedIn
    );

    studentUsers.push({
        id: Number(result.lastInsertRowid),
        name,
        email,
        isBanned,
    });
}

console.log("✅ Seeded 1 admin user and 30 student users");

// ── Courses ──────────────────────────────────────────────────────────
const insertCourse = db.prepare(
    `INSERT INTO courses (title, description, category, difficulty, tags, instructor, duration, platform, platformUrl, platformPrice, rating, platformRating, reviewCount, learnerCount, completionRate, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const coursesData = [
    {
        title: "The Complete 2024 Web Development Bootcamp",
        description: "Become a full-stack web developer with just one course. HTML, CSS, JS, Node, React, PostgreSQL, Web3 and DApps.",
        category: "Web Development", difficulty: "beginner",
        tags: ["HTML", "CSS", "JavaScript", "React", "Node.js"],
        instructor: "Dr. Angela Yu", duration: 3960,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/the-complete-web-development-bootcamp/",
        platformPrice: "$12.99", rating: 470, platformRating: 470, reviewCount: 285000, learnerCount: 890000, completionRate: 68,
    },
    {
        title: "Machine Learning Specialization",
        description: "Build ML models with NumPy & scikit-learn. Build & train supervised models for prediction & binary classification tasks.",
        category: "Machine Learning", difficulty: "intermediate",
        tags: ["Machine Learning", "Python", "TensorFlow", "Supervised Learning"],
        instructor: "Andrew Ng", duration: 5400,
        platform: "Coursera", platformUrl: "https://www.coursera.org/specializations/machine-learning-introduction",
        platformPrice: "Subscription", rating: 490, platformRating: 490, reviewCount: 45000, learnerCount: 520000, completionRate: 45,
    },
    {
        title: "CS50's Introduction to Computer Science",
        description: "Harvard's introduction to the intellectual enterprises of computer science and the art of programming.",
        category: "Computer Science", difficulty: "beginner",
        tags: ["C", "Python", "SQL", "Algorithms", "Data Structures"],
        instructor: "David J. Malan", duration: 7200,
        platform: "edX", platformUrl: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science",
        platformPrice: "Free", rating: 495, platformRating: 495, reviewCount: 35000, learnerCount: 4000000, completionRate: 32,
    },
    {
        title: "Python for Data Science and Machine Learning Bootcamp",
        description: "Learn how to use NumPy, Pandas, Seaborn, Matplotlib, Plotly, Scikit-Learn, and more for Data Science and ML.",
        category: "Data Science", difficulty: "intermediate",
        tags: ["Python", "Data Science", "Pandas", "NumPy", "Matplotlib"],
        instructor: "Jose Portilla", duration: 1500,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/",
        platformPrice: "$14.99", rating: 460, platformRating: 460, reviewCount: 120000, learnerCount: 680000, completionRate: 55,
    },
    {
        title: "Deep Learning Specialization",
        description: "Master Deep Learning, and Break into AI. Build neural networks, and lead successful ML projects.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Deep Learning", "Neural Networks", "TensorFlow", "CNN", "RNN"],
        instructor: "Andrew Ng", duration: 4800,
        platform: "Coursera", platformUrl: "https://www.coursera.org/specializations/deep-learning",
        platformPrice: "Subscription", rating: 485, platformRating: 485, reviewCount: 38000, learnerCount: 420000, completionRate: 38,
    },
    {
        title: "The Complete JavaScript Course 2024",
        description: "The modern JavaScript course for everyone! Master JavaScript with projects, challenges and theory.",
        category: "Web Development", difficulty: "beginner",
        tags: ["JavaScript", "ES6", "OOP", "Async", "DOM"],
        instructor: "Jonas Schmedtmann", duration: 4170,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/the-complete-javascript-course/",
        platformPrice: "$12.99", rating: 475, platformRating: 475, reviewCount: 195000, learnerCount: 810000, completionRate: 62,
    },
    {
        title: "Google Data Analytics Professional Certificate",
        description: "Prepare for a new career in the high-growth field of data analytics. No experience or degree needed.",
        category: "Data Science", difficulty: "beginner",
        tags: ["Data Analytics", "SQL", "R", "Tableau", "Spreadsheets"],
        instructor: "Google Career Certificates", duration: 4800,
        platform: "Coursera", platformUrl: "https://www.coursera.org/professional-certificates/google-data-analytics",
        platformPrice: "Subscription", rating: 480, platformRating: 480, reviewCount: 125000, learnerCount: 2100000, completionRate: 42,
    },
    {
        title: "React - The Complete Guide 2024",
        description: "Dive in and learn React.js from scratch! Learn React, Hooks, Redux, React Router, Next.js.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["React", "Redux", "Next.js", "Hooks", "TypeScript"],
        instructor: "Maximilian Schwarzmüller", duration: 4920,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/react-the-complete-guide-incl-redux/",
        platformPrice: "$12.99", rating: 465, platformRating: 465, reviewCount: 210000, learnerCount: 850000, completionRate: 58,
    },
    {
        title: "AWS Certified Solutions Architect",
        description: "Learn cloud computing and pass the AWS Certified Solutions Architect Associate exam.",
        category: "Cloud Computing", difficulty: "intermediate",
        tags: ["AWS", "Cloud", "DevOps", "EC2", "S3"],
        instructor: "Stephane Maarek", duration: 1620,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/",
        platformPrice: "$14.99", rating: 475, platformRating: 475, reviewCount: 185000, learnerCount: 920000, completionRate: 72,
    },
    {
        title: "Introduction to Artificial Intelligence (AI)",
        description: "Learn what AI is, explore use cases and applications, understand AI concepts and key terms.",
        category: "Artificial Intelligence", difficulty: "beginner",
        tags: ["AI", "Machine Learning", "Deep Learning", "NLP"],
        instructor: "IBM Skills Network", duration: 600,
        platform: "Coursera", platformUrl: "https://www.coursera.org/learn/introduction-to-ai",
        platformPrice: "Free", rating: 445, platformRating: 445, reviewCount: 22000, learnerCount: 350000, completionRate: 75,
    },
    {
        title: "Docker & Kubernetes: The Practical Guide",
        description: "Learn Docker, Docker Compose, Multi-Container Projects, Deployment, and Kubernetes from scratch.",
        category: "DevOps", difficulty: "intermediate",
        tags: ["Docker", "Kubernetes", "Containers", "DevOps", "CI/CD"],
        instructor: "Maximilian Schwarzmüller", duration: 1380,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/",
        platformPrice: "$14.99", rating: 470, platformRating: 470, reviewCount: 38000, learnerCount: 280000, completionRate: 65,
    },
    {
        title: "Algorithms, Part I",
        description: "Covers elementary data structures, sorting, and searching algorithms by Princeton University.",
        category: "Computer Science", difficulty: "intermediate",
        tags: ["Algorithms", "Data Structures", "Java", "Sorting"],
        instructor: "Robert Sedgewick", duration: 3600,
        platform: "Coursera", platformUrl: "https://www.coursera.org/learn/algorithms-part1",
        platformPrice: "Free", rating: 480, platformRating: 480, reviewCount: 18000, learnerCount: 750000, completionRate: 35,
    },
    {
        title: "The Complete Node.js Developer Course",
        description: "Learn Node.js by building real-world applications with Node, Express, MongoDB, Jest & more.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["Node.js", "Express", "MongoDB", "REST API", "Jest"],
        instructor: "Andrew Mead", duration: 2100,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/the-complete-nodejs-developer-course-2/",
        platformPrice: "$12.99", rating: 465, platformRating: 465, reviewCount: 78000, learnerCount: 370000, completionRate: 60,
    },
    {
        title: "Cybersecurity for Everyone",
        description: "Learn about cybersecurity and its impact on your life, from the University of Maryland.",
        category: "Cybersecurity", difficulty: "beginner",
        tags: ["Cybersecurity", "Network Security", "Risk Management"],
        instructor: "Dr. Charles Harry", duration: 900,
        platform: "Coursera", platformUrl: "https://www.coursera.org/learn/cybersecurity-for-everyone",
        platformPrice: "Free", rating: 450, platformRating: 450, reviewCount: 8500, learnerCount: 120000, completionRate: 80,
    },
    {
        title: "Flutter & Dart - The Complete Guide",
        description: "Build beautiful, fast & engaging native mobile apps for Android & iOS using Flutter.",
        category: "Mobile Development", difficulty: "intermediate",
        tags: ["Flutter", "Dart", "Mobile", "iOS", "Android"],
        instructor: "Maximilian Schwarzmüller", duration: 2580,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/learn-flutter-dart-to-build-ios-android-apps/",
        platformPrice: "$14.99", rating: 460, platformRating: 460, reviewCount: 65000, learnerCount: 320000, completionRate: 52,
    },
    {
        title: "SQL for Data Science",
        description: "Learn SQL for data science. Master SQL Basics, Filtering, Sorting, Subqueries & more.",
        category: "Database Design", difficulty: "beginner",
        tags: ["SQL", "Database", "Data Science", "MySQL"],
        instructor: "UC Davis", duration: 960,
        platform: "Coursera", platformUrl: "https://www.coursera.org/learn/sql-for-data-science",
        platformPrice: "Subscription", rating: 455, platformRating: 455, reviewCount: 19000, learnerCount: 650000, completionRate: 58,
    },
    {
        title: "Microservices with Node JS and React",
        description: "Build, deploy, and scale an E-Commerce app using Microservices architecture with Node, React, Docker.",
        category: "Software Architecture", difficulty: "advanced",
        tags: ["Microservices", "Node.js", "React", "Docker", "NATS"],
        instructor: "Stephen Grider", duration: 3240,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/microservices-with-node-js-and-react/",
        platformPrice: "$12.99", rating: 470, platformRating: 470, reviewCount: 12000, learnerCount: 95000, completionRate: 42,
    },
    {
        title: "TensorFlow Developer Professional Certificate",
        description: "Build scalable AI-powered applications. Learn TensorFlow best practices from Google Brain team.",
        category: "Machine Learning", difficulty: "advanced",
        tags: ["TensorFlow", "Deep Learning", "NLP", "Computer Vision"],
        instructor: "Laurence Moroney", duration: 3600,
        platform: "Coursera", platformUrl: "https://www.coursera.org/professional-certificates/tensorflow-in-practice",
        platformPrice: "Subscription", rating: 465, platformRating: 465, reviewCount: 15000, learnerCount: 280000, completionRate: 40,
    },
    {
        title: "Introduction to Linux",
        description: "Develop a good working knowledge of Linux using both the graphical interface and command line.",
        category: "DevOps", difficulty: "beginner",
        tags: ["Linux", "Command Line", "System Admin", "Shell"],
        instructor: "The Linux Foundation", duration: 3600,
        platform: "edX", platformUrl: "https://www.edx.org/learn/linux/the-linux-foundation-introduction-to-linux",
        platformPrice: "Free", rating: 460, platformRating: 460, reviewCount: 28000, learnerCount: 1200000, completionRate: 55,
    },
    {
        title: "Kotlin for Android Development",
        description: "Master Kotlin and build modern Android apps. Covers coroutines, Jetpack Compose, and MVVM.",
        category: "Mobile Development", difficulty: "intermediate",
        tags: ["Kotlin", "Android", "Jetpack Compose", "MVVM"],
        instructor: "Philipp Lackner", duration: 1800,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/android-kotlin-developer/",
        platformPrice: "$14.99", rating: 465, platformRating: 465, reviewCount: 22000, learnerCount: 180000, completionRate: 55,
    },
    // Deep Learning Related Courses
    {
        title: "Convolutional Neural Networks for Image Classification",
        description: "Master CNNs from scratch. Learn about filters, pooling, architectures like VGG, ResNet, and more.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Deep Learning", "CNN", "Computer Vision", "Neural Networks", "PyTorch"],
        instructor: "Carver Cowan", duration: 2880,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/convolutional-neural-networks-cnn/",
        platformPrice: "$12.99", rating: 475, platformRating: 475, reviewCount: 18500, learnerCount: 95000, completionRate: 52,
    },
    {
        title: "Recurrent Neural Networks - RNN & LSTM",
        description: "Learn RNNs, LSTMs, and GRUs for sequence modeling, time series, and NLP applications.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Deep Learning", "RNN", "LSTM", "Sequence Modeling", "NLP"],
        instructor: "Jason Brownlee", duration: 1620,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/recurrent-neural-networks/",
        platformPrice: "$14.99", rating: 470, platformRating: 470, reviewCount: 12000, learnerCount: 65000, completionRate: 48,
    },
    {
        title: "Generative Adversarial Networks (GANs)",
        description: "Build GANs from scratch. Learn how to generate images, videos, and synthetic data with GANs.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Deep Learning", "GANs", "Generative Models", "Computer Vision"],
        instructor: "Dipesh Batavia", duration: 1440,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/generative-adversarial-networks/",
        platformPrice: "$13.99", rating: 465, platformRating: 465, reviewCount: 8900, learnerCount: 42000, completionRate: 38,
    },
    {
        title: "Natural Language Processing with Deep Learning",
        description: "Master NLP with transformers, BERT, GPT. Build chatbots, sentiment analysis, and text summarization.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["NLP", "Deep Learning", "Transformers", "BERT", "GPT"],
        instructor: "Gidi Shperber", duration: 2700,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/nlp-natural-language-processing/",
        platformPrice: "$14.99", rating: 480, platformRating: 480, reviewCount: 22000, learnerCount: 120000, completionRate: 54,
    },
    {
        title: "PyTorch for Deep Learning",
        description: "Learn PyTorch from basics to advanced. Build neural networks, GANs, and reinforcement learning models.",
        category: "Machine Learning", difficulty: "intermediate",
        tags: ["PyTorch", "Deep Learning", "Neural Networks", "Python"],
        instructor: "Jose Portilla", duration: 1800,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/pytorch-for-deep-learning/",
        platformPrice: "$12.99", rating: 475, platformRating: 475, reviewCount: 32000, learnerCount: 185000, completionRate: 61,
    },
    // Data Science Related Courses
    {
        title: "Data Science Bootcamp 2024",
        description: "Complete data science bootcamp. Python, statistics, machine learning, and real-world projects.",
        category: "Data Science", difficulty: "beginner",
        tags: ["Data Science", "Python", "Statistics", "Pandas", "Scikit-learn"],
        instructor: "Rob Percival", duration: 3240,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/the-data-science-bootcamp/",
        platformPrice: "$12.99", rating: 470, platformRating: 470, reviewCount: 89000, learnerCount: 450000, completionRate: 58,
    },
    {
        title: "Advanced Statistical Analysis with R",
        description: "Master statistical analysis, hypothesis testing, and regression using R. Real-world datasets included.",
        category: "Data Science", difficulty: "intermediate",
        tags: ["Statistics", "R", "Data Analysis", "Regression", "Hypothesis Testing"],
        instructor: "Brandon Foltz", duration: 2160,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/statistical-analysis-with-r/",
        platformPrice: "$13.99", rating: 465, platformRating: 465, reviewCount: 15500, learnerCount: 78000, completionRate: 51,
    },
    {
        title: "Tableau 2024 Master Class",
        description: "Learn Tableau for data visualization. Build dashboards and deploy to Tableau Server.",
        category: "Data Science", difficulty: "beginner",
        tags: ["Tableau", "Data Visualization", "BI", "Dashboards"],
        instructor: "Nick Barattini", duration: 1560,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/tableau-training/",
        platformPrice: "$14.99", rating: 475, platformRating: 475, reviewCount: 42000, learnerCount: 220000, completionRate: 68,
    },
    {
        title: "Time Series Forecasting & Analysis",
        description: "Master time series analysis with ARIMA, SARIMA, Prophet. Real financial and stock data.",
        category: "Data Science", difficulty: "intermediate",
        tags: ["Time Series", "Forecasting", "ARIMA", "Data Science", "Statistics"],
        instructor: "Andrey Zimovnov", duration: 1440,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/time-series-analysis/",
        platformPrice: "$13.99", rating: 460, platformRating: 460, reviewCount: 12000, learnerCount: 62000, completionRate: 45,
    },
    {
        title: "Feature Engineering for Machine Learning",
        description: "Learn feature engineering techniques to improve model performance. Real-world case studies.",
        category: "Machine Learning", difficulty: "intermediate",
        tags: ["Feature Engineering", "Machine Learning", "Data Preprocessing", "Python"],
        instructor: "Pablo Garavito", duration: 1080,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/feature-engineering-machine-learning/",
        platformPrice: "$12.99", rating: 468, platformRating: 468, reviewCount: 8500, learnerCount: 45000, completionRate: 52,
    },
    // Machine Learning Related Courses
    {
        title: "Scikit-learn & Machine Learning in Python",
        description: "Master scikit-learn. Classification, regression, clustering, and ensemble methods explained.",
        category: "Machine Learning", difficulty: "intermediate",
        tags: ["Scikit-learn", "Machine Learning", "Python", "Classification", "Regression"],
        instructor: "Gerrit Coetzee", duration: 1440,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/machine-learning-with-scikit-learn/",
        platformPrice: "$13.99", rating: 470, platformRating: 470, reviewCount: 22000, learnerCount: 125000, completionRate: 57,
    },
    {
        title: "Reinforcement Learning: Theory & Practice",
        description: "Learn Q-learning, DQN, policy gradients, actor-critic methods. Build game-playing AI.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Reinforcement Learning", "Q-Learning", "Deep RL", "AI"],
        instructor: "Phil Tabor", duration: 1800,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/reinforcement-learning/",
        platformPrice: "$14.99", rating: 460, platformRating: 460, reviewCount: 9500, learnerCount: 52000, completionRate: 40,
    },
    {
        title: "Ensemble Methods in Machine Learning",
        description: "Master Random Forest, Gradient Boosting, XGBoost. Improve model accuracy with ensembles.",
        category: "Machine Learning", difficulty: "intermediate",
        tags: ["Ensemble Methods", "XGBoost", "Random Forest", "Boosting", "Machine Learning"],
        instructor: "John Elder", duration: 1260,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/ensemble-methods/",
        platformPrice: "$12.99", rating: 472, platformRating: 472, reviewCount: 7800, learnerCount: 38000, completionRate: 55,
    },
    // Web Development Related Courses
    {
        title: "Vue.js 3 Complete Course",
        description: "Master Vue 3 with Composition API. Build real-world apps with routing and state management.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["Vue.js", "JavaScript", "Frontend", "Web Development"],
        instructor: "Anthony Gore", duration: 3600,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/vue-js-complete-guide/",
        platformPrice: "$13.99", rating: 468, platformRating: 468, reviewCount: 45000, learnerCount: 195000, completionRate: 56,
    },
    {
        title: "Angular 17 & TypeScript Complete Course",
        description: "Learn Angular 17 with TypeScript, RxJS, and advanced patterns. Build enterprise applications.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["Angular", "TypeScript", "Frontend", "RxJS", "Web Development"],
        instructor: "Maximilian Schwarzmüller", duration: 3780,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/angular-complete-guide/",
        platformPrice: "$14.99", rating: 470, platformRating: 470, reviewCount: 128000, learnerCount: 580000, completionRate: 52,
    },
    {
        title: "Svelte.js The Complete Guide",
        description: "Learn Svelte and SvelteKit. Build faster, reactive web applications with less code.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["Svelte", "JavaScript", "Frontend", "Web Development", "SvelteKit"],
        instructor: "Pavlo Osterman", duration: 2520,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/svelte-the-complete-guide/",
        platformPrice: "$12.99", rating: 462, platformRating: 462, reviewCount: 8200, learnerCount: 42000, completionRate: 48,
    },
    {
        title: "Web Design for Web Developers",
        description: "Learn design principles, color theory, typography, and UX design. Build beautiful websites.",
        category: "Web Development", difficulty: "beginner",
        tags: ["Web Design", "UI/UX", "CSS", "Design Principles", "Typography"],
        instructor: "Jonas Schmedtmann", duration: 1980,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/web-design-secrets/",
        platformPrice: "$12.99", rating: 475, platformRating: 475, reviewCount: 32000, learnerCount: 165000, completionRate: 72,
    },
    {
        title: "Responsive Web Design with CSS Grid & Flexbox",
        description: "Master CSS Grid and Flexbox for modern responsive layouts. Build mobile-first websites.",
        category: "Web Development", difficulty: "beginner",
        tags: ["CSS", "Responsive Design", "Flexbox", "Grid", "Web Development"],
        instructor: "Elaine Parisian", duration: 1440,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/css-grid-flexbox/",
        platformPrice: "$11.99", rating: 470, platformRating: 470, reviewCount: 28000, learnerCount: 145000, completionRate: 65,
    },
    {
        title: "Full Stack Web Development with MERN",
        description: "Build full-stack apps with MongoDB, Express, React, Node.js. Real projects included.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["MERN", "MongoDB", "Express", "React", "Node.js", "Full Stack"],
        instructor: "Traversy Media", duration: 2160,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/mern-stack-front-to-back/",
        platformPrice: "$13.99", rating: 475, platformRating: 475, reviewCount: 52000, learnerCount: 285000, completionRate: 59,
    },
    {
        title: "GraphQL: The Complete Developer Guide",
        description: "Master GraphQL from basics to advanced. Build APIs with Apollo Server and handle real-world problems.",
        category: "Web Development", difficulty: "intermediate",
        tags: ["GraphQL", "Apollo", "API", "JavaScript", "Backend"],
        instructor: "Stephen Grider", duration: 2100,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/graphql-with-react/",
        platformPrice: "$14.99", rating: 465, platformRating: 465, reviewCount: 18500, learnerCount: 95000, completionRate: 51,
    },
    // AI/NLP Related Courses
    {
        title: "Advanced NLP: Transformers and BERT",
        description: "Learn how transformers work. Fine-tune BERT, GPT-2, T5 for various NLP tasks.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["NLP", "Transformers", "BERT", "Deep Learning", "Hugging Face"],
        instructor: "Chris McCormick", duration: 1800,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/nlp-transformers/",
        platformPrice: "$14.99", rating: 478, platformRating: 478, reviewCount: 9200, learnerCount: 48000, completionRate: 42,
    },
    {
        title: "Computer Vision Masterclass",
        description: "Complete computer vision course. Image processing, object detection, face recognition, and more.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Computer Vision", "OpenCV", "Deep Learning", "Image Processing"],
        instructor: "Raghav Pal", duration: 2700,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/computer-vision-masterclass/",
        platformPrice: "$13.99", rating: 472, platformRating: 472, reviewCount: 21000, learnerCount: 115000, completionRate: 46,
    },
    {
        title: "Speech Recognition and Audio Processing",
        description: "Build speech recognition systems. Learn audio processing, spectrogram analysis, and voice synthesis.",
        category: "Artificial Intelligence", difficulty: "advanced",
        tags: ["Speech Recognition", "Audio Processing", "Deep Learning", "DSP"],
        instructor: "Valerio Velardo", duration: 1620,
        platform: "Udemy", platformUrl: "https://www.udemy.com/course/speech-recognition-audio-processing/",
        platformPrice: "$12.99", rating: 456, platformRating: 456, reviewCount: 4500, learnerCount: 22000, completionRate: 38,
    },
    // AI Model Training and Optimization
    {
        title: "Transfer Learning & Fine-tuning with Pretrained Models",
        description: "Master transfer learning. Use pretrained models from ImageNet, COCO, and fine-tune for custom tasks.",
        category: "Machine Learning", difficulty: "intermediate",
        tags: ["Transfer Learning", "Deep Learning", "Pretrained Models", "Fine-tuning"],
        instructor: "Andrej Karpathy inspired", duration: 1440,
        platform: "Coursera", platformUrl: "https://www.coursera.org/learn/transfer-learning",
        platformPrice: "Subscription", rating: 475, platformRating: 475, reviewCount: 11000, learnerCount: 85000, completionRate: 48,
    },
    {
        title: "MLOps: Deploying Machine Learning Models",
        description: "Learn to deploy ML models. Docker, Kubernetes, CI/CD, monitoring, and scaling in production.",
        category: "DevOps", difficulty: "advanced",
        tags: ["MLOps", "DevOps", "ML Deployment", "Docker", "Kubernetes"],
        instructor: "Chip Huyen", duration: 2160,
        platform: "Coursera", platformUrl: "https://www.coursera.org/learn/machine-learning-engineering-for-production",
        platformPrice: "Subscription", rating: 480, platformRating: 480, reviewCount: 13500, learnerCount: 95000, completionRate: 36,
    },
];

for (const c of coursesData) {
    insertCourse.run(
        c.title, c.description, c.category, c.difficulty,
        JSON.stringify(c.tags), c.instructor, c.duration,
        c.platform, c.platformUrl, c.platformPrice,
        c.rating, c.platformRating, c.reviewCount, c.learnerCount, c.completionRate,
        now, now
    );
}

db.exec("INSERT INTO courses_fts(courses_fts) VALUES ('rebuild')");

console.log(`✅ Seeded ${coursesData.length} courses with platform data (now with comprehensive coverage for each topic!)`);

// ── Platform Ratings (cross-platform comparison) ─────────────────────
const insertPlatformRating = db.prepare(
    `INSERT INTO platformRatings (courseId, platform, rating, reviewCount, price, url, lastUpdated)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

// Some courses exist on multiple platforms — add alternative ratings
const crossPlatformData = [
    // Web Dev Bootcamp also on Coursera & YouTube
    [1, "Coursera", 440, 12000, "Subscription", "https://www.coursera.org/learn/html-css-javascript-for-web-developers"],
    [1, "YouTube", 460, 85000, "Free", "https://www.youtube.com/watch?v=pQN-pnXPaVg"],
    // ML Specialization also on edX & YouTube
    [2, "edX", 475, 8500, "Free", "https://www.edx.org/learn/machine-learning"],
    [2, "YouTube", 480, 120000, "Free", "https://www.youtube.com/watch?v=jGwO_UgTS7I"],
    // CS50 also on YouTube
    [3, "YouTube", 490, 250000, "Free", "https://www.youtube.com/watch?v=8mAITcNt710"],
    [3, "Coursera", 485, 15000, "Free", "https://www.coursera.org/learn/cs50"],
    // Python DS also on Coursera
    [4, "Coursera", 455, 28000, "Subscription", "https://www.coursera.org/specializations/python-data-science"],
    // React Guide also on Coursera & Pluralsight
    [8, "Coursera", 450, 18000, "Subscription", "https://www.coursera.org/learn/react-basics"],
    [8, "Pluralsight", 440, 5500, "$29/mo", "https://www.pluralsight.com/courses/react-fundamentals"],
    // AWS also on Coursera & A Cloud Guru
    [9, "Coursera", 460, 25000, "Subscription", "https://www.coursera.org/learn/aws-fundamentals"],
    [9, "A Cloud Guru", 470, 42000, "$35/mo", "https://acloudguru.com/course/aws-certified-solutions-architect-associate"],
    // Docker also on Pluralsight
    [11, "Coursera", 445, 8000, "Subscription", "https://www.coursera.org/learn/docker-kubernetes"],
    [11, "Pluralsight", 455, 12000, "$29/mo", "https://www.pluralsight.com/courses/docker-deep-dive"],
];

for (const [courseId, platform, rating, reviewCount, price, url] of crossPlatformData) {
    insertPlatformRating.run(courseId, platform, rating, reviewCount, price, url, now);
}
console.log(`✅ Seeded ${crossPlatformData.length} cross-platform ratings`);

// ── Student data ─────────────────────────────────────────────────────
const insertProfile = db.prepare(
    `INSERT INTO userProfiles (
        userId,
        skills,
        interests,
        learningGoals,
        preferredDifficulty,
        learningStyle,
        bio,
        onboardingCompletedAt,
        createdAt,
        updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertBookmark = db.prepare(
    `INSERT INTO bookmarks (userId, courseId, notes, createdAt) VALUES (?, ?, ?, ?)`
);
const insertInteraction = db.prepare(
    `INSERT INTO courseInteractions (userId, courseId, interactionType, rating, timeSpent, completionPercentage, timestamp)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const insertProgress = db.prepare(
    `INSERT INTO userProgress (userId, courseId, enrollmentDate, completionPercentage, status, totalTimeSpent, lastAccessedAt, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertLearningPath = db.prepare(
    `INSERT INTO userLearningPaths (userId, pathName, description, courseIds, currentCourseIndex, status, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertLoginHistory = db.prepare(
    `INSERT INTO userLoginHistory (userId, loginAt, ipAddress, userAgent, success) VALUES (?, ?, ?, ?, ?)`
);
const insertAdminLog = db.prepare(
    `INSERT INTO adminActivityLog (adminId, action, targetUserId, targetCourseId, details, performedAt)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const courseIds = coursesData.map((_, idx) => idx + 1);
const learningStyles = ["visual", "hands-on", "project-based", "reading", "video"];
const difficulties = ["beginner", "intermediate", "advanced"];
const skillPool = ["Python", "SQL", "React", "Node.js", "Docker", "AWS", "JavaScript", "TypeScript", "TensorFlow", "Pandas", "Kubernetes", "Linux"];
const interestPool = ["Web Development", "Data Science", "Machine Learning", "DevOps", "Cloud Computing", "Mobile Development", "Artificial Intelligence", "Cybersecurity"];
const goalPool = ["Full Stack Developer", "Data Scientist", "ML Engineer", "DevOps Engineer", "Cloud Architect", "Mobile Developer", "AI Researcher", "Security Analyst"];
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)",
];

const sampleUnique = (arr: number[], count: number): number[] => {
    const copy = [...arr];
    const out: number[] = [];
    while (copy.length > 0 && out.length < count) {
        const idx = Math.floor(Math.random() * copy.length);
        out.push(copy[idx]);
        copy.splice(idx, 1);
    }
    return out;
};

let totalInteractions = 0;
let totalProgress = 0;
let totalBookmarks = 0;
let totalPaths = 0;
let totalLogins = 0;

for (const student of studentUsers) {
    const skills = sampleUnique(skillPool.map((_, i) => i), randomInt(3, 5)).map(i => skillPool[i]);
    const interests = sampleUnique(interestPool.map((_, i) => i), randomInt(1, 3)).map(i => interestPool[i]);
    const goals = sampleUnique(goalPool.map((_, i) => i), randomInt(1, 2)).map(i => goalPool[i]);
    const preferredDifficulty = pick(difficulties);
    const learningStyle = pick(learningStyles);

    insertProfile.run(
        student.id,
        JSON.stringify(skills),
        JSON.stringify(interests),
        JSON.stringify(goals),
        preferredDifficulty,
        learningStyle,
        `${student.name} is focused on ${goals[0]}.`,
        now - randomInt(1, 21 * 24 * 60 * 60),
        now,
        now
    );

    const interactionCount = randomInt(5, 10);
    const pickedCourses = sampleUnique(courseIds, interactionCount);
    for (const courseId of pickedCourses) {
        const roll = Math.random();
        const interactionType = roll < 0.55 ? "viewed" : roll < 0.8 ? "started" : roll < 0.93 ? "rated" : "bookmarked";
        const rating = interactionType === "rated" ? randomInt(380, 500) : null;
        const completion =
            interactionType === "viewed"
                ? randomInt(5, 40)
                : interactionType === "started"
                    ? randomInt(20, 65)
                    : interactionType === "rated"
                        ? randomInt(65, 100)
                        : 0;
        const timeSpent = interactionType === "bookmarked" ? 0 : completion * randomInt(6, 14);
        insertInteraction.run(
            student.id,
            courseId,
            interactionType,
            rating,
            timeSpent,
            completion,
            now - randomInt(0, 30 * 24 * 60 * 60)
        );
        totalInteractions += 1;
    }

    const progressCount = randomInt(2, 4);
    const progressCourses = sampleUnique(courseIds, progressCount);
    const statuses = ["enrolled", "in-progress", "completed"] as const;
    for (const courseId of progressCourses) {
        const status = pick([...statuses]);
        const pct = status === "completed" ? 100 : status === "in-progress" ? randomInt(20, 85) : randomInt(0, 20);
        const timeSpent = pct * randomInt(10, 18);
        const enrollmentDate = now - randomInt(7, 90) * 24 * 60 * 60;
        insertProgress.run(
            student.id,
            courseId,
            enrollmentDate,
            pct,
            status,
            timeSpent,
            now - randomInt(1, 10) * 24 * 60 * 60,
            now,
            now
        );
        totalProgress += 1;
    }

    const bookmarkCount = randomInt(2, 4);
    const bookmarkCourses = sampleUnique(courseIds, bookmarkCount);
    for (const courseId of bookmarkCourses) {
        insertBookmark.run(student.id, courseId, "Saved for later", now - randomInt(0, 14 * 24 * 60 * 60));
        totalBookmarks += 1;
    }

    const pathCount = randomInt(1, 2);
    for (let p = 0; p < pathCount; p++) {
        const pathCourses = sampleUnique(courseIds, randomInt(3, 5));
        const currentIndex = Math.min(pathCourses.length - 1, randomInt(0, pathCourses.length - 1));
        const status = pick(["active", "paused", "completed"] as const);
        insertLearningPath.run(
            student.id,
            `${pick(interests)} Path ${p + 1}`,
            `Guided plan for ${pick(interests)} fundamentals and projects.`,
            JSON.stringify(pathCourses),
            currentIndex,
            status,
            now,
            now
        );
        totalPaths += 1;
    }

    const loginCount = randomInt(2, 5);
    for (let l = 0; l < loginCount; l++) {
        const success = Math.random() > 0.15 ? 1 : 0;
        insertLoginHistory.run(
            student.id,
            now - randomInt(0, 45 * 24 * 60 * 60),
            randomIp(),
            pick(userAgents),
            success
        );
        totalLogins += 1;
    }
}

const adminActions = [
    { action: "ban_user", details: "Banned for repeated policy violations" },
    { action: "view_user", details: "Reviewed learning path progress" },
    { action: "reset_password", details: "Reset password on support request" },
    { action: "unban_user", details: "User appeal approved" },
    { action: "view_user", details: "Checked suspicious activity" },
];

for (let i = 0; i < adminActions.length; i++) {
    const targetUser = pick(studentUsers);
    insertAdminLog.run(
        adminId,
        adminActions[i].action,
        targetUser.id,
        null,
        adminActions[i].details,
        now - randomInt(0, 10 * 24 * 60 * 60)
    );
}

console.log(`✅ Seeded ${studentUsers.length} user profiles`);
console.log(`✅ Seeded ${totalInteractions} interactions`);
console.log(`✅ Seeded ${totalProgress} progress records`);
console.log(`✅ Seeded ${totalBookmarks} bookmarks`);
console.log(`✅ Seeded ${totalPaths} learning paths`);
console.log(`✅ Seeded ${totalLogins} login history events`);
console.log(`✅ Seeded ${adminActions.length} admin activity log entries`);

db.close();
console.log("\n🎉 Database seeded successfully!");
console.log(`   📁 ${dbPath}`);
