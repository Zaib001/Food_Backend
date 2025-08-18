const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const path = require('path');
dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/ingredients', require('./routes/ingredientRoutes'));
app.use('/api/recipes', require('./routes/recipeRoutes'));
app.use('/api/menus', require('./routes/menuRoutes'));
app.use('/api/planning', require('./routes/planningRoutes'));
app.use('/api/production', require('./routes/productionRoutes'));
app.use('/api/requisitions', require('./routes/requisitionRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
