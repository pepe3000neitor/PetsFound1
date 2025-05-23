const express = require('express');
const router = express.Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { isAuthenticated } = require('../middlewares/auth');
const Post = require('../models/Post');
const mongoose = require('mongoose');

//configuración de multer para manejar la subida de imágenes
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
});

//ruta para mostrar el formulario de creación de post
router.get('/create', isAuthenticated, (req, res) => {
  res.render('pages/create-post', { 
    user: req.session.user,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
  });
});

//procesa la creación de un nuevo post
router.post('/', isAuthenticated, upload.array('images'), postController.createPost);

//listado principal de posts con paginación y filtros
router.get('/', async (req, res) => {
  try {
    const { search, type, status, page = 1 } = req.query;
    const limit = 12; 
    const skip = (page - 1) * limit; 

    let query = {};
    
    const conditions = [];
    if (search) conditions.push({ petName: { $regex: new RegExp(search, 'i') } }); 
    if (type) conditions.push({ petType: type }); 
    if (status) conditions.push({ status: status });

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    const totalPosts = await Post.countDocuments(query);
    
    const posts = await Post.find(query)
      .skip(skip)
      .limit(limit)
      .populate('owner')
      .lean(); 

    res.render('pages/posts', {
      posts: posts || [], 
      user: req.session.user,
      searchQuery: search,
      selectedType: type,
      selectedStatus: status,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalPosts / limit)
    });

  } catch (error) {
    console.error('Error en GET /posts:', error);
    res.status(500).render('pages/error', {
      message: 'Error al cargar los posts',
      user: req.session.user,
      error: process.env.NODE_ENV === 'development' ? error : null
    });
  }
});

//perfil publico de usuario
router.get('/user/:userId', postController.getUserProfile);

// detalle individual de un post
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).render('pages/404', {
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
      return res.status(404).render('pages/404', {
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
    res.status(500).render('pages/404', {
      message: 'Error al cargar el post',
      user: req.session.user
    });
  }
});

//eliminar post
router.delete('/:id', isAuthenticated, postController.deletePost);

//sistemas de comentarios
router.post('/:id/comments', isAuthenticated, postController.addComment);

module.exports = router;