require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/database');
const { isAuthenticated, isGuest } = require('./middlewares/auth');
const Post = require('./models/Post');
const methodOverride = require('method-override');
const cloudinary = require('cloudinary').v2;

const app = express();
 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middelware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// conexion a la base de datos
connectDB();

// cloudinary para las imagenes
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// api de google maps
app.use((req, res, next) => {
  res.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  res.locals.NODE_ENV = process.env.NODE_ENV;
  next();
});

// rutas
const postsRoutes = require('./routes/postsRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
app.use(methodOverride('_method'));
app.use('/profile', profileRoutes);  
app.use('/posts', postsRoutes);
app.use('/auth', authRoutes);

// index
app.get('/', async (req, res) => {
  try {
    const posts = await Post.find().populate('owner');
    res.render('pages/home', { 
      posts: posts,
      user: req.session.user 
    });
  } catch (error) {
    res.status(500).render('pages/error', { 
      message: 'Error al cargar el mapa',
      user: req.session.user 
    });
  }
});

// errores
app.use((req, res, next) => {
  res.status(404).render('pages/404', { 
    user: req.session.user 
  });
});
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).render('pages/404', { 
    user: req.session.user 
  });
});

// iniciador de servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});