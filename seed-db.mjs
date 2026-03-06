import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Sample courses data
const courses = [
  {
    title: "Introduction to React",
    description: "Learn the fundamentals of React, including components, hooks, and state management.",
    category: "Web Development",
    difficulty: "beginner",
    tags: JSON.stringify(["React", "JavaScript", "Frontend"]),
    instructor: "Sarah Chen",
    duration: 40,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=React",
    contentUrl: "https://example.com/react-intro",
    rating: 450,
    enrollmentCount: 5200
  },
  {
    title: "Advanced JavaScript Patterns",
    description: "Master advanced JavaScript concepts like closures, prototypes, and design patterns.",
    category: "Web Development",
    difficulty: "advanced",
    tags: JSON.stringify(["JavaScript", "Design Patterns", "Advanced"]),
    instructor: "John Smith",
    duration: 35,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=JavaScript",
    contentUrl: "https://example.com/js-advanced",
    rating: 480,
    enrollmentCount: 3100
  },
  {
    title: "Python for Data Science",
    description: "Learn Python programming with focus on data manipulation and analysis using pandas and NumPy.",
    category: "Data Science",
    difficulty: "intermediate",
    tags: JSON.stringify(["Python", "Data Science", "Pandas", "NumPy"]),
    instructor: "Dr. Emily Watson",
    duration: 50,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=Python",
    contentUrl: "https://example.com/python-data",
    rating: 470,
    enrollmentCount: 6800
  },
  {
    title: "Machine Learning Fundamentals",
    description: "Understand core ML concepts including supervised learning, classification, and regression.",
    category: "Machine Learning",
    difficulty: "intermediate",
    tags: JSON.stringify(["Machine Learning", "Supervised Learning", "Scikit-learn"]),
    instructor: "Prof. Michael Lee",
    duration: 45,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=ML",
    contentUrl: "https://example.com/ml-fundamentals",
    rating: 490,
    enrollmentCount: 4500
  },
  {
    title: "Deep Learning with TensorFlow",
    description: "Build neural networks and deep learning models using TensorFlow and Keras.",
    category: "Machine Learning",
    difficulty: "advanced",
    tags: JSON.stringify(["Deep Learning", "TensorFlow", "Neural Networks"]),
    instructor: "Dr. Alex Rodriguez",
    duration: 60,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=TensorFlow",
    contentUrl: "https://example.com/tensorflow",
    rating: 495,
    enrollmentCount: 2800
  },
  {
    title: "Mobile App Development with React Native",
    description: "Create cross-platform mobile applications using React Native and JavaScript.",
    category: "Mobile Development",
    difficulty: "intermediate",
    tags: JSON.stringify(["React Native", "Mobile", "JavaScript"]),
    instructor: "Lisa Park",
    duration: 42,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=React+Native",
    contentUrl: "https://example.com/react-native",
    rating: 460,
    enrollmentCount: 3400
  },
  {
    title: "Docker and Kubernetes Essentials",
    description: "Master containerization with Docker and orchestration with Kubernetes.",
    category: "DevOps",
    difficulty: "intermediate",
    tags: JSON.stringify(["Docker", "Kubernetes", "DevOps", "Containers"]),
    instructor: "James Wilson",
    duration: 38,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=Docker",
    contentUrl: "https://example.com/docker-k8s",
    rating: 475,
    enrollmentCount: 2900
  },
  {
    title: "AWS Cloud Solutions",
    description: "Learn to architect and deploy scalable applications on Amazon Web Services.",
    category: "Cloud Computing",
    difficulty: "intermediate",
    tags: JSON.stringify(["AWS", "Cloud", "EC2", "S3"]),
    instructor: "Rachel Green",
    duration: 48,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=AWS",
    contentUrl: "https://example.com/aws",
    rating: 480,
    enrollmentCount: 4200
  },
  {
    title: "TypeScript Masterclass",
    description: "Learn TypeScript for building robust, scalable JavaScript applications.",
    category: "Web Development",
    difficulty: "intermediate",
    tags: JSON.stringify(["TypeScript", "JavaScript", "Type Safety"]),
    instructor: "David Brown",
    duration: 32,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=TypeScript",
    contentUrl: "https://example.com/typescript",
    rating: 465,
    enrollmentCount: 3800
  },
  {
    title: "SQL Database Design",
    description: "Design efficient relational databases and write optimized SQL queries.",
    category: "Data Science",
    difficulty: "beginner",
    tags: JSON.stringify(["SQL", "Database", "Relational Database"]),
    instructor: "Margaret Smith",
    duration: 28,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=SQL",
    contentUrl: "https://example.com/sql",
    rating: 455,
    enrollmentCount: 5100
  },
  {
    title: "Natural Language Processing",
    description: "Build NLP applications using transformers, BERT, and GPT models.",
    category: "Machine Learning",
    difficulty: "advanced",
    tags: JSON.stringify(["NLP", "Transformers", "BERT", "Deep Learning"]),
    instructor: "Dr. Priya Sharma",
    duration: 55,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=NLP",
    contentUrl: "https://example.com/nlp",
    rating: 485,
    enrollmentCount: 2100
  },
  {
    title: "Vue.js 3 Complete Guide",
    description: "Master Vue.js 3 with composition API, state management, and routing.",
    category: "Web Development",
    difficulty: "intermediate",
    tags: JSON.stringify(["Vue.js", "Frontend", "JavaScript"]),
    instructor: "Tom Anderson",
    duration: 36,
    thumbnailUrl: "https://via.placeholder.com/300x200?text=Vue",
    contentUrl: "https://example.com/vue3",
    rating: 470,
    enrollmentCount: 2600
  }
];

try {
  console.log("Seeding database with sample courses...");
  
  for (const course of courses) {
    const query = `
      INSERT INTO courses (title, description, category, difficulty, tags, instructor, duration, thumbnailUrl, contentUrl, rating, enrollmentCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await connection.execute(query, [
      course.title,
      course.description,
      course.category,
      course.difficulty,
      course.tags,
      course.instructor,
      course.duration,
      course.thumbnailUrl,
      course.contentUrl,
      course.rating,
      course.enrollmentCount
    ]);
    
    console.log(`✓ Added: ${course.title}`);
  }
  
  console.log("\n✓ Database seeding completed successfully!");
  console.log(`✓ Added ${courses.length} sample courses`);
  
} catch (error) {
  console.error("Error seeding database:", error);
  process.exit(1);
} finally {
  await connection.end();
}
