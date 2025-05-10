const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
const multer = require("multer");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { initializeDatabase, db } = require("./dbInit");
require("dotenv").config();

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const corsOptions = {
  origin: "*", // Allow all origins in development
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// API error handler - add this before static file middleware
app.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

const logs = [];
let lastLogId = 0;

// Add a more robust retry function with improved error handling
async function retryRequest(fn, retries = 3, delay = 1000) {
  let lastError;
  let attempts = retries + 1; // Including the first try

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      if (attempt > 0) {
        console.log(
          `Retry attempt ${attempt}/${retries} after ${delay / 1000}s delay`
        );
      }
      return await fn();
    } catch (error) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;

      console.error(
        `Attempt ${attempt + 1}/${attempts} failed:`,
        error.message,
        statusCode ? `Status: ${statusCode}` : "",
        error.code === "ECONNABORTED" ? "Request timed out" : "",
        responseData ? `Response data: ${JSON.stringify(responseData)}` : ""
      );

      lastError = error;

      // Don't wait on the last attempt
      if (attempt < retries) {
        console.log(`Waiting ${delay / 1000}s before next retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Exponential backoff with some randomization to prevent thundering herd
        delay = Math.floor(delay * 1.5 + Math.random() * 1000);
      } else {
        console.error("All retry attempts exhausted");
      }
    }
  }

  throw lastError;
}

// Fetch distinct chat list
app.get("/api/chat-list", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const result = await db.query(
      `
      SELECT s.chat_id, s.name, s.created_at, s.favorite,
             h.query, h.answer
      FROM chat_sessions s
      LEFT JOIN chat_history h ON h.id = (
        SELECT id FROM chat_history 
        WHERE chat_id = s.chat_id 
        ORDER BY created_at ASC 
        LIMIT 1
      )
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
    `,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving chat list:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Signup Route
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const userExists = await db.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );
    if (userExists.rows.length)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
      [username, email, hashedPassword]
    );
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "Username and password required" });

    const user = (
      await db.query("SELECT * FROM users WHERE username = $1", [username])
    ).rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      message: "Login successful",
      userId: user.id,
      username: user.username,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Fetch chat history for a specific chatId
app.get("/api/chat-history/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.query.userId;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // First verify the chat belongs to this user
    const chatCheck = await db.query(
      `SELECT chat_id FROM chat_sessions WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await db.query(
      `SELECT * FROM chat_history WHERE chat_id = $1 ORDER BY created_at ASC`,
      [chatId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error retrieving chat history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/metadata", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }
  try {
    const metadata = await getMetaData(url);
    res.json(metadata);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

app.get("/api/pdf", async (req, res) => {
  const { name, page, userId } = req.query;
  if (!name) {
    return res.status(400).json({ error: "PDF name is required" });
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const result = await db.query(
      "SELECT pdf_file FROM pdfdata WHERE pdf_name = $1 AND user_id = $2",
      [name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "PDF not found" });
    }

    const pdfBuffer = result.rows[0].pdf_file;

    // Set content-disposition with page anchor if available
    const disposition = `inline; filename="${name}.pdf"${
      page ? `#page=${page}` : ""
    }`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", disposition);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error retrieving PDF:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/api/chat", async (req, res) => {
  try {
    const { chatId } = req.query;
    const userId = req.query.userId;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    await db.query("BEGIN"); // Start transaction

    try {
      // Verify the chat belongs to this user
      const chatCheck = await db.query(
        `SELECT chat_id FROM chat_sessions WHERE chat_id = $1 AND user_id = $2`,
        [chatId, userId]
      );

      if (chatCheck.rows.length === 0) {
        await db.query("ROLLBACK");
        return res.status(403).json({ message: "Access denied" });
      }

      // Delete chat memory first (due to foreign key constraint)
      await db.query("DELETE FROM chat_memory WHERE chat_id = $1", [chatId]);

      // Delete chat history
      await db.query("DELETE FROM chat_history WHERE chat_id = $1", [chatId]);

      // Delete chat session
      const result = await db.query(
        "DELETE FROM chat_sessions WHERE chat_id = $1 AND user_id = $2",
        [chatId, userId]
      );

      if (result.rowCount === 0) {
        await db.query("ROLLBACK");
        return res.status(404).json({ message: "Chat not found" });
      }

      await db.query("COMMIT");
      res.json({ message: "Chat deleted successfully" });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add this new endpoint
app.get("/api/logs", (req, res) => {
  const lastId = parseInt(req.query.lastId) || 0;
  const newLogs = logs.filter((log) => log.id > lastId);
  res.json(newLogs);
});

// Add this function to store logs
function addLog(message) {
  lastLogId++;
  logs.push({
    id: lastLogId,
    message,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.shift();
  }
}

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const result = await db.query(
      "SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Create new product
app.post("/api/products", async (req, res) => {
  const { title, info, userId } = req.body;
  const colors = ["red", "purple", "orange", "green", "blue", "white"];

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Get existing products to determine next color
    const existingProducts = await db.query(
      "SELECT color FROM products WHERE user_id = $1",
      [userId]
    );
    const usedColors = existingProducts.rows.map((p) => p.color);
    const availableColor =
      colors.find((c) => !usedColors.includes(c)) || colors[0];

    const result = await db.query(
      "INSERT INTO products (title, info, color, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, info, availableColor, userId]
    );

    // Define AI backend URL
    const ai_backend_url =
      process.env.AI_BACKEND_URL || "http://localhost:8000";

    // Generate and store related queries with retry
    try {
      await retryRequest(
        async () => {
          return await axios.post(
            `${ai_backend_url}/api/generate-product-queries`,
            {
              title,
              info,
            },
            {
              timeout: 30000,
            }
          );
        },
        2,
        1000
      );
    } catch (error) {
      console.error("Error generating product queries:", error);
      // Continue with product creation even if query generation fails
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating product:", error);
    res
      .status(500)
      .json({ error: "Failed to create product", details: error.message });
  }
});

// Update product
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { title, info, color, userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // First verify the product belongs to this user
    const productCheck = await db.query(
      `SELECT id FROM products WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await db.query(
      "UPDATE products SET title = $1, info = $2, color = $3 WHERE id = $4 AND user_id = $5 RETURNING *",
      [title, info, color, id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // First verify the product belongs to this user
    const productCheck = await db.query(
      `SELECT id FROM products WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await db.query(
      "DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Remove the proxy middleware and handle the route directly
app.post("/api/query", async (req, res) => {
  try {
    const { query, org_query, chat_id, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const finalChatId = chat_id || crypto.randomUUID();

    console.log(`Processing query: ${query}`);

    // Get chat memory if chat_id exists
    let chatMemory = [];
    if (chat_id) {
      try {
        const memoryResult = await db.query(
          "SELECT memory FROM chat_memory WHERE chat_id = $1",
          [chat_id]
        );
        if (memoryResult.rows.length > 0) {
          chatMemory = memoryResult.rows[0].memory || [];
        }
      } catch (memoryError) {
        console.error("Error fetching chat memory:", memoryError);
        // Continue without memory if there's an error
      }
    }

    // Update AI backend URL to localhost
    let ai_backend_url = process.env.AI_BACKEND_URL || "http://localhost:8000";

    // Forward request to AI server with retries and timeout
    const aiResponse = await retryRequest(
      async () => {
        console.log("Sending request to AI backend...");
        return await axios.post(
          `${ai_backend_url}/api/query`,
          {
            query,
            org_query,
            chat_id: finalChatId,
            userId,
            memory: chatMemory,
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 300000, // Increased timeout to 5 minutes (300 seconds) for long running AI tasks
          }
        );
      },
      5, // Increased retries
      5000 // Increased delay between retries to 5 seconds
    );

    console.log("AI response received successfully");
    const data = aiResponse.data;

    // Ensure we have related_queries, even if empty
    if (!data.related_queries || !Array.isArray(data.related_queries)) {
      data.related_queries = [];
    }

    // If we have fewer than 5 related queries, generate some generic ones
    if (data.related_queries.length < 5) {
      // Generate additional queries to reach 5
      const additionalQueries = await generateAdditionalQueries(
        query,
        5 - data.related_queries.length
      );
      data.related_queries = [...data.related_queries, ...additionalQueries];
    }

    // Normalize related_queries to ensure they're all in object format
    data.related_queries = data.related_queries.map((item) => {
      if (typeof item === "string") {
        return { query: item, context: "Generated suggestion" };
      }
      return item;
    });

    // Ensure we have pdf_references, even if empty
    if (!data.pdf_references) {
      data.pdf_references = [];
    }

    // Create chat session if it doesn't exist
    await db.query(
      `INSERT INTO chat_sessions (chat_id, name, user_id) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (chat_id) DO NOTHING`,
      [
        finalChatId,
        data.chat_name || `Chat ${new Date().toISOString()}`,
        userId,
      ]
    );

    // Store in database
    await db.query(
      `INSERT INTO chat_history 
       (chat_id, query, answer, pdf_references, online_images, online_videos, online_links, relevant_queries, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        finalChatId,
        query,
        data.answer,
        JSON.stringify(data.pdf_references || []),
        JSON.stringify(data.online_images || []),
        JSON.stringify(data.online_videos || []),
        JSON.stringify(data.online_links || []),
        JSON.stringify(data.related_queries || []),
        userId,
      ]
    );

    // Update chat memory
    const updatedMemory = [
      ...chatMemory,
      {
        role: "user",
        content: query,
      },
      {
        role: "assistant",
        content: data.answer,
      },
    ];

    // Limit memory to last 10 exchanges (20 messages)
    const limitedMemory = updatedMemory.slice(-20);

    // Store updated memory
    await db.query(
      `INSERT INTO chat_memory (chat_id, memory)
       VALUES ($1, $2)
       ON CONFLICT (chat_id) DO UPDATE SET memory = $2`,
      [finalChatId, JSON.stringify(limitedMemory)]
    );

    // Send response back to frontend
    res.json({
      ...data,
      chatId: finalChatId,
    });
  } catch (error) {
    console.error("Error processing query:", error);
    // Ensure we return a proper JSON error response
    res.status(500).json({
      error: "Failed to process query",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Helper function to generate additional related queries
async function generateAdditionalQueries(query, count) {
  const defaultQueries = [
    `What are the best practices related to ${query}?`,
    `How does ${query} impact compliance requirements?`,
    `What are common challenges with ${query}?`,
    `What standards govern ${query}?`,
    `How to implement ${query} effectively?`,
    `What are the latest developments in ${query}?`,
    `How to measure success in ${query}?`,
    `What are the risks associated with ${query}?`,
  ];

  // Shuffle and take the number needed
  return defaultQueries
    .sort(() => 0.5 - Math.random())
    .slice(0, count)
    .map((queryText) => ({
      query: queryText,
      context: "Generated suggestion",
    }));
}

// PDF Management Endpoints
app.post("/api/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const formData = new FormData();
    formData.append("file", new Blob([req.file.buffer]), req.file.originalname);
    formData.append("userId", userId);

    const ai_backend_url =
      process.env.AI_BACKEND_URL || "http://localhost:8000";

    const response = await retryRequest(
      async () => {
        return await axios.post(`${ai_backend_url}/api/upload-pdf`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000, // Increased timeout for PDF uploads
        });
      },
      2,
      2000
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error uploading PDF:", error);
    res.status(500).json({
      error: "Failed to upload PDF",
      details: error.message,
    });
  }
});

app.get("/api/search-pdfs", async (req, res) => {
  try {
    const { search_query, userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const ai_backend_url =
      process.env.AI_BACKEND_URL || "http://localhost:8000";

    const response = await retryRequest(
      async () => {
        return await axios.get(
          `${ai_backend_url}/api/search-pdfs?${
            search_query ? `search_query=${search_query}&` : ""
          }userId=${userId}`,
          { timeout: 30000 }
        );
      },
      2,
      1000
    );

    // Ensure response has the expected format with a 'results' property
    let responseData = response.data;

    // If response is an array, wrap it in an object with results property
    if (Array.isArray(responseData)) {
      responseData = { results: responseData };
    }
    // If response is an object without results property, add it
    else if (
      responseData &&
      typeof responseData === "object" &&
      !responseData.results
    ) {
      responseData = { results: [responseData] };
    }
    // If response is null/undefined, return empty results
    else if (!responseData) {
      responseData = { results: [] };
    }

    res.json(responseData);
  } catch (error) {
    console.error("Error searching PDFs:", error);
    res.status(500).json({
      error: "Failed to search PDFs",
      details: error.message,
      results: [], // Include empty results even on error
    });
  }
});

app.delete("/api/delete-pdf/:pdf_name", async (req, res) => {
  try {
    const { pdf_name } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const ai_backend_url =
      process.env.AI_BACKEND_URL || "http://localhost:8000";

    const response = await retryRequest(
      async () => {
        return await axios.delete(
          `${ai_backend_url}/api/delete-pdf/${pdf_name}?userId=${userId}`,
          { timeout: 30000 }
        );
      },
      2,
      1000
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error deleting PDF:", error);
    res.status(500).json({
      error: "Failed to delete PDF",
      details: error.message,
    });
  }
});

app.put("/api/update-pdf-info/:pdf_name", async (req, res) => {
  try {
    const { pdf_name } = req.params;
    const { new_info } = req.body;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const ai_backend_url =
      process.env.AI_BACKEND_URL || "http://localhost:8000";

    const response = await retryRequest(
      async () => {
        return await axios.put(
          `${ai_backend_url}/api/update-pdf-info/${pdf_name}?userId=${userId}`,
          { new_info },
          { timeout: 30000 }
        );
      },
      2,
      1000
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error updating PDF info:", error);
    res.status(500).json({
      error: "Failed to update PDF info",
      details: error.message,
    });
  }
});

// Add new endpoint to get random product queries
app.get("/api/random-product-queries", async (req, res) => {
  try {
    const ai_backend_url =
      process.env.AI_BACKEND_URL || "http://localhost:8000";

    const response = await retryRequest(
      async () => {
        return await axios.get(`${ai_backend_url}/api/random-product-queries`, {
          timeout: 30000,
        });
      },
      2,
      1000
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching random queries:", error);
    res.status(500).json({
      error: "Failed to fetch random queries",
      details: error.message,
    });
  }
});

// Add a CORS proxy endpoint
app.get("/api/proxy", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is required" });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    // Set CORS headers to allow access from the frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");

    // Return the fetched content
    res.send(response.data);
  } catch (error) {
    console.error("Proxy fetch error:", error.message);
    res.status(500).json({
      error: "Failed to fetch from URL",
      message: error.message,
      url: url,
    });
  }
});

// Update chat favorite status
app.post("/api/update-chat-favorite", async (req, res) => {
  try {
    const { chatId, userId, favorite } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Verify the chat belongs to this user
    const chatCheck = await db.query(
      `SELECT chat_id FROM chat_sessions WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId]
    );

    if (chatCheck.rows.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Update favorite status
    const result = await db.query(
      `UPDATE chat_sessions SET favorite = $1 WHERE chat_id = $2 AND user_id = $3 RETURNING *`,
      [favorite, chatId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.json({
      message: "Chat favorite status updated successfully",
      chat: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating chat favorite status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 404 handler for API routes (must be after all /api routes)
app.use("/api", (req, res, next) => {
  console.log("404 API route:", req.method, req.originalUrl);
  res.status(404).json({ error: "API route not found" });
});

// Start Server
const PORT = process.env.PORT || 5000;
initializeDatabase()
  .then(() => {
    // Add global error middleware just before starting the server
    app.use((err, req, res, next) => {
      console.error("Unhandled error:", err);

      // Only handle API routes with JSON responses
      if (req.path.startsWith("/api")) {
        return res.status(500).json({
          error: "Server error",
          message: err.message || "An unexpected error occurred",
        });
      }

      next(err);
    });

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
