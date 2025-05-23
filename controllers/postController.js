const Post = require('../models/Post');
const User = require('../models/User');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate('owner');
    res.render('pages/posts', { 
      posts,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('pages/404', { 
      user: req.session.user 
    });
  }
};

exports.createPost = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
    // Validaciones iniciales
    const errors = [];
    const formData = req.body;

    if (!req.body.petName?.trim()) errors.push('Nombre de mascota requerido');
    if (!req.body.petType) errors.push('Tipo de mascota requerido');
    if (!req.body.description?.trim()) errors.push('Descripción requerida');
    if (!req.body.latitude || !req.body.longitude) errors.push('Ubicación requerida');
    if (!req.files?.length) errors.push('Debes subir al menos una imagen');
    if (req.files?.length > 5) errors.push('Máximo 5 imágenes permitidas');
    
    const lostDate = new Date(req.body.lostDate);
    if (lostDate > new Date()) errors.push('La fecha no puede ser futura');

    if (errors.length > 0) {
      return res.status(400).render('pages/create-post', {
        errors,
        formData,
        user: req.session.user,
        GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
      });
    }

    // Procesar imágenes
    const uploadPromises = req.files.map(async (file) => {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          quality: 'auto:good',
          format: 'webp'
        });
        return result.secure_url;
      } catch (uploadError) {
        console.error('Error subiendo imagen:', file.originalname, uploadError);
        throw new Error(`Error al subir ${file.originalname}`);
      }
    });

    const images = await Promise.all(uploadPromises);

    // Crear nuevo post
    const newPost = new Post({
      ...formData,
      lostDate,
      images,
      owner: req.session.user._id,
      status: formData.status || 'perdido',
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(formData.longitude),
          parseFloat(formData.latitude)
        ]
      }
    });

    // Validación de Mongoose
    await newPost.validate();

    // Guardar en base de datos
    const savedPost = await newPost.save({ session });
    await User.findByIdAndUpdate(
      req.session.user._id,
      { $push: { posts: savedPost._id } },
      { session }
    );

    await session.commitTransaction();
    res.redirect('/posts');

  } catch (error) {
    await session.abortTransaction();
    console.error('Error crítico:', error.stack);

    // Manejo de archivos temporales
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, err => {
          if (err) console.error('Error eliminando temporal:', file.path);
        });
      });
    }

    // Manejo de errores de validación
    const errors = [];
    if (error instanceof mongoose.Error.ValidationError) {
      for (const field in error.errors) {
        errors.push(error.errors[field].message);
      }
    } else {
      errors.push(getErrorMessage(error));
    }

    res.status(500).render('pages/create-post', {
      errors,
      formData: req.body,
      user: req.session.user,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
    });
  } finally {
    session.endSession();
  }
};


exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (post.owner.toString() !== req.session.user._id.toString()) {
      return res.status(403).render('pages/404', {
        message: 'No tienes permiso para esta acción',
        user: req.session.user
      });
    }

    for (const imageUrl of post.images) {
      const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    await Post.findByIdAndDelete(req.params.id);
    await User.findByIdAndUpdate(
      req.session.user._id,
      { $pull: { posts: req.params.id } }
    );

    res.redirect('/profile');

  } catch (error) {
    console.error('Error eliminando post:', error);
    res.status(500).render('pages/404', {
      message: 'Error al eliminar el post',
      user: req.session.user
    });
  }
};

exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).render('pages/404', {
        message: 'Publicación no encontrada',
        user: req.session.user
      });
    }

    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).render('pages/404', {
        message: 'El comentario no puede estar vacío',
        user: req.session.user
      });
    }

    post.comments.push({
      user: req.session.user._id,
      text: text.trim()
    });

    await post.save();
    res.redirect(`/posts/${post._id}`);

  } catch (error) {
    res.status(500).render('pages/404', {
      message: 'Error al agregar el comentario',
      error: process.env.NODE_ENV === 'development' ? error : null,
      user: req.session.user
    });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).render('pages/404', {
        message: 'ID de usuario inválido',
        user: req.session.user
      });
    }

    // Obtener usuario con posts paginados
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'posts',
        options: { 
          sort: { createdAt: -1 },
          skip: skip,
          limit: limit
        },
        select: 'petName petType images lostDate description',
        populate: { path: 'owner', select: 'username avatar' }
      });

    // Obtener total de posts
    const userWithTotal = await User.findById(req.params.userId);
    const totalPosts = userWithTotal.posts.length;

    if (!user) {
      return res.status(404).render('pages/404', {
        message: 'Usuario no encontrado',
        user: req.session.user
      });
    }

    res.render('pages/user-profile', {
      profileUser: user.toObject(),
      currentUser: req.session.user,
      isOwner: req.session.user && user._id.equals(req.session.user._id),
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts: totalPosts
    });
    
  } catch (error) {
    res.status(500).render('pages/404', {
      message: 'Error al cargar el perfil',
      error: process.env.NODE_ENV === 'development' ? error : null,
      user: req.session.user
    });
  }
};

const getErrorMessage = (error) => {
  if (error instanceof mongoose.Error.ValidationError) {
    return Object.values(error.errors).map(e => e.message).join(', ');
  }
  if (error.message.includes('Cloudinary')) {
    return 'Error al procesar las imágenes. Intenta con formatos JPG/PNG';
  }
  return 'Error interno del servidor. Por favor intenta nuevamente';
};