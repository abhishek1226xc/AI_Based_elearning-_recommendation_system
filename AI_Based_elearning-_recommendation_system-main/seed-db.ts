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
db.exec(`
  DROP TABLE IF EXISTS recommendationFeedback;
  DROP TABLE IF EXISTS recommendations;
  DROP TABLE IF EXISTS courseInteractions;
  DROP TABLE IF EXISTS userProgress;
  DROP TABLE IF EXISTS bookmarks;
  DROP TABLE IF EXISTS platformRatings;
  DROP TABLE IF EXISTS userProfiles;
  DROP TABLE IF EXISTS courses;
  DROP TABLE IF EXISTS users;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    passwordHash TEXT,
    loginMethod TEXT,
    role TEXT NOT NULL DEFAULT 'user',
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
db.exec("DELETE FROM userProfiles");
db.exec("DELETE FROM courses");
db.exec("DELETE FROM users");
console.log("🗑️  Cleared existing data");

// ── Users ────────────────────────────────────────────────────────────
const insertUser = db.prepare(
    `INSERT INTO users (openId, name, email, passwordHash, loginMethod, role, createdAt, updatedAt, lastSignedIn)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const usersData = [
    ["dev-user", "Dev User", "dev@local.dev", hashPassword("dev123"), "dev", "admin"],
    ["user-alice", "Alice Johnson", "alice@example.com", hashPassword("alice123"), "email", "user"],
    ["user-bob", "Bob Martinez", "bob@example.com", hashPassword("bob123"), "email", "user"],
    ["user-carol", "Carol Williams", "carol@example.com", hashPassword("carol123"), "email", "user"],
    ["user-dave", "Dave Chen", "dave@example.com", hashPassword("dave123"), "email", "user"],
];

for (const [openId, name, email, pwHash, loginMethod, role] of usersData) {
    insertUser.run(openId, name, email, pwHash, loginMethod, role, now, now, now);
}
console.log(`✅ Seeded ${usersData.length} users`);

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

// ── User Profiles ────────────────────────────────────────────────────
const insertProfile = db.prepare(
    `INSERT INTO userProfiles (userId, skills, interests, learningGoals, preferredDifficulty, learningStyle, bio, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const profilesData = [
    [1, ["JavaScript", "React", "Python"], ["Web Development", "AI"], ["Full Stack Developer"], "intermediate", "visual", "Full-stack dev exploring AI"],
    [2, ["Python", "SQL"], ["Data Science", "ML"], ["Data Scientist"], "intermediate", "hands-on", "Data enthusiast"],
    [3, ["Java", "Kotlin"], ["Mobile", "Cloud"], ["Mobile Developer"], "beginner", "reading", "Learning mobile dev"],
    [4, ["Python", "TensorFlow"], ["AI", "Deep Learning"], ["ML Engineer"], "advanced", "project-based", "AI researcher"],
    [5, ["JavaScript", "Docker"], ["DevOps", "Cloud"], ["DevOps Engineer"], "intermediate", "video", "Infrastructure nerd"],
];

for (const [userId, skills, interests, goals, diff, style, bio] of profilesData) {
    insertProfile.run(userId, JSON.stringify(skills), JSON.stringify(interests), JSON.stringify(goals), diff, style, bio, now, now);
}
console.log(`✅ Seeded ${profilesData.length} user profiles`);

// ── Bookmarks ────────────────────────────────────────────────────────
const insertBookmark = db.prepare(
    `INSERT INTO bookmarks (userId, courseId, notes, createdAt) VALUES (?, ?, ?, ?)`
);

const bookmarksData = [
    [1, 1, "Want to review React fundamentals", now],
    [1, 8, "Great React advanced course", now],
    [1, 6, "Brush up on JS", now],
    [1, 2, "Start ML journey", now],
    [2, 4, "Main learning focus", now],
    [2, 2, "Andrew Ng is amazing", now],
    [3, 15, "Need for my project", now],
    [3, 20, "Kotlin for Android", now],
];

for (const [userId, courseId, notes, ts] of bookmarksData) {
    insertBookmark.run(userId, courseId, notes, ts);
}
console.log(`✅ Seeded ${bookmarksData.length} bookmarks`);

// ── Course Interactions ──────────────────────────────────────────────
const insertInteraction = db.prepare(
    `INSERT INTO courseInteractions (userId, courseId, interactionType, rating, timeSpent, completionPercentage, timestamp)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const interactions = [
    [1, 1, "viewed", null, 120, 0], [1, 1, "bookmarked", null, 0, 0],
    [1, 6, "viewed", null, 60, 0], [1, 8, "viewed", null, 90, 0],
    [1, 2, "viewed", null, 45, 0], [1, 8, "rated", 450, 0, 0],
    [2, 4, "viewed", null, 180, 0], [2, 4, "rated", 470, 0, 0],
    [2, 2, "viewed", null, 90, 0], [2, 7, "viewed", null, 60, 0],
    [3, 15, "viewed", null, 45, 0], [3, 20, "viewed", null, 30, 0],
    [3, 3, "viewed", null, 60, 0],
    [4, 5, "viewed", null, 120, 0], [4, 5, "rated", 490, 0, 0],
    [4, 2, "viewed", null, 180, 0], [4, 18, "viewed", null, 90, 0],
    [5, 11, "viewed", null, 60, 0], [5, 9, "viewed", null, 90, 0],
    [5, 19, "viewed", null, 45, 0],
];

for (const [userId, courseId, type, rating, time, pct] of interactions) {
    insertInteraction.run(userId, courseId, type, rating, time, pct, now - Math.floor(Math.random() * 604800));
}
console.log(`✅ Seeded ${interactions.length} interactions`);

// ── User Progress (tracking bookmarked courses) ──────────────────────
const insertProgress = db.prepare(
    `INSERT INTO userProgress (userId, courseId, enrollmentDate, completionPercentage, status, totalTimeSpent, lastAccessedAt, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const progressData = [
    [1, 1, now - 604800, 65, "in-progress", 2400, now - 3600],
    [1, 8, now - 1209600, 30, "in-progress", 900, now - 86400],
    [1, 6, now - 2592000, 100, "completed", 4200, now - 604800],
    [1, 2, now - 172800, 10, "enrolled", 300, now - 172800],
    [2, 4, now - 604800, 45, "in-progress", 1800, now - 7200],
    [2, 2, now - 1209600, 20, "enrolled", 600, now - 259200],
];

for (const [userId, courseId, enrollDate, pct, status, time, lastAccess] of progressData) {
    insertProgress.run(userId, courseId, enrollDate, pct, status, time, lastAccess, now, now);
}
console.log(`✅ Seeded ${progressData.length} progress records`);

db.close();
console.log("\n🎉 Database seeded successfully!");
console.log(`   📁 ${dbPath}`);
