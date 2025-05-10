const { initializeDatabase, db } = require("./dbInit");

async function seedDatabase() {
  try {
    await initializeDatabase();
    console.log("Database initialized successfully.");

    // Add test products
    const testProducts = [
      { title: "Product 1", info: "This is product 1", color: "blue" },
      { title: "Product 2", info: "This is product 2", color: "red" },
      { title: "Product 3", info: "This is product 3", color: "green" },
    ];

    for (const product of testProducts) {
      await db.query(
        "INSERT INTO products (title, info, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [product.title, product.info, product.color]
      );
    }
    console.log("Test products added successfully.");

    // Add a test chat session
    const chatId = "test-chat-" + Date.now();
    await db.query(
      "INSERT INTO chat_sessions (chat_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [chatId, "Test Chat"]
    );
    console.log("Test chat session added successfully.");

    // Add test chat history
    await db.query(
      "INSERT INTO chat_history (chat_id, query, answer) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [chatId, "Test query", "Test answer"]
    );
    console.log("Test chat history added successfully.");

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
