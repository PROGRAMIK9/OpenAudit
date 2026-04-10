require('dotenv').config({ path: __dirname + '/.env' });

console.log("ENV CHECK:", {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("Missing Cloudinary environment variables");
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true // Adjust as needed for frontend URL
}));
// Increase JSON and URL-encoded payload limits to support larger generated PDF and report payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Routes
const authRoutes = require('./routes/authRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const taxRoutes = require('./routes/taxRoutes');
const reportRoutes = require('./routes/reportRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/', receiptRoutes);
app.use('/api/tax', taxRoutes);
app.use('/reports', reportRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Open Audit Backend' });
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
