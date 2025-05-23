
const Post = require('../models/Post');
const User = require('../models/User');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

//controlador para mostrar todos los posts
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

// controlador para crear posts
exports.createPost = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    
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
    //sube las imagenes a cloudinary y guarda las urls
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

    //crea el posts con los datos del formulario
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

    await newPost.validate();

    //guarda el post en la base de datos y lo asocia al usuario
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

    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, err => {
          if (err) console.error('Error eliminando temporal:', file.path);
        });
      });
    }
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

// controlador para eliminar posts
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    // verifica que el usuario sea el dueño del post
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

//controlador para añadir comentarios a los posts
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
    //agregar el comentario
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

//controaldor para mostrar el perfiler de un usuario
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
    // busca el usuario y sus posts
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
      //obitene el total de posts 
    const userWithTotal = await User.findById(req.params.userId);
    const totalPosts = userWithTotal.posts.length;

    if (!user) {
      return res.status(404).render('pages/404', {
        message: 'Usuario no encontrado',
        user: req.session.user
      });
    }
    //renderiza el perfil del usuario con los posts paginados
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
