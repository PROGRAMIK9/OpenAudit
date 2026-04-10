const express = require('express');
const cors = require('cors');
const receiptRoutes = require("./routes/receiptRoutes.js");

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/receipts", receiptRoutes);

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the backend' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});