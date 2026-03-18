import express from "express";
import cors from "cors";

// Import your existing routes and logic from the 'backend' directory.
// For example:
// import userRoutes from '../backend/routes/users.js';
// import productRoutes from '../backend/routes/products.js';

const app = express();

app.use(cors());
app.use(express.json());

// This is a sample health check endpoint.
app.get("/api/health", (req, res) => {
  res.json({ status: "API running successfully" });
});

// TODO: Add your existing API routes here.
// app.use('/api/users', userRoutes);
// app.use('/api/products', productRoutes);

// Export the Express app for Vercel to use.
export default app;