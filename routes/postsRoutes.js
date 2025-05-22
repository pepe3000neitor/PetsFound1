const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { isAuthenticated } = require('../middlewares/auth');
const Post = require('../models/Post');
const User = require('../models/User');
const mongoose = require('mongoose');

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
});

// Crear post
router.get('/create', isAuthenticated, (req, res) => {
  res.render('pages/create-post', { 
    user: req.session.user,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
  });
});

router.post('/', isAuthenticated, upload.array('images'), postController.createPost);

// Ruta para mostrar la lista de posts con filtros y paginación
router.get('/', async (req, res) => {
  try {
    // Extrae los parámetros de búsqueda, tipo, estado y página de la URL
    const { search, type, status, page = 1 } = req.query;
    const limit = 12; // Número de posts por página
    const skip = (page - 1) * limit; // Cantidad de posts a saltar según la página

    let query = {};
    
    // Construye condiciones de búsqueda según los filtros recibidos
    const conditions = [];
    if (search) conditions.push({ petName: { $regex: new RegExp(search, 'i') } }); // Filtra por nombre de mascota (insensible a mayúsculas)
    if (type) conditions.push({ petType: type }); // Filtra por tipo de mascota
    if (status) conditions.push({ status: status }); // Filtra por estado

    // Si hay condiciones, las agrega al query principal usando $and
    if (conditions.length > 0) {
      query.$and = conditions;
    }

    // Cuenta el total de posts que cumplen con el filtro
    const totalPosts = await Post.countDocuments(query);
    
    // Busca los posts aplicando paginación y poblando el campo 'owner'
    const posts = await Post.find(query)
      .skip(skip)
      .limit(limit)
      .populate('owner')
      .lean(); // Convierte los documentos a objetos planos

    // Renderiza la vista de posts, pasando los datos necesarios para la paginación y los filtros
    res.render('pages/posts', {
      posts: posts || [], // Si no hay posts, envía un array vacío
      user: req.session.user,
      searchQuery: search,
      selectedType: type,
      selectedStatus: status,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPosts / limit)
    });

  } catch (error) {
    // Si ocurre un error, lo muestra en consola y renderiza una página de error
    console.error('Error en GET /posts:', error);
    res.status(500).render('pages/error', {
      message: 'Error al cargar los posts',
      user: req.session.user,
      error: process.env.NODE_ENV === 'development' ? error : null
    });
  }
});

// Perfil público 
router.get('/user/:userId', postController.getUserProfile);

// Detalles de un post específico
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).render('pages/error', {
        message: 'ID de publicación inválido',
        user: req.session.user
      });
    }

    const post = await Post.findById(req.params.id)
      .populate('owner')
      .populate({
        path: 'comments.user',
        select: 'username avatar'
      });

    if (!post) {
      return res.status(404).render('pages/error', {
        message: 'Publicación no encontrada',
        user: req.session.user
      });
    }

    res.render('pages/post-details', { 
      post: post.toObject(),
      user: req.session.user,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
    });
  } catch (error) {
    res.status(500).render('pages/error', {
      message: 'Error al cargar el post',
      user: req.session.user
    });
  }
});

// Eliminar post
router.delete('/:id', isAuthenticated, postController.deletePost);

// Comentarios
router.post('/:id/comments', isAuthenticated, postController.addComment);

module.exports = router;