const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const User = require('../models/User');
const upload = require('../config/multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

//muestra el perfil del usuario con paginacion
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const userWithoutPosts = await User.findById(req.session.user._id);
    const totalPosts = userWithoutPosts.posts.length;

    const user = await User.findById(req.session.user._id)
      .populate({
        path: 'posts',
        options: { 
          sort: { createdAt: -1 },
          skip: skip,
          limit: limit
        },
        select: 'petName petType images lostDate description reward status'
      });

    res.render('pages/profile', { 
      user: user.toObject(),
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts: totalPosts 
    });

  } catch (error) {
    console.error('Error cargando perfil:', error);
    res.status(500).render('pages/404', {
      message: 'Error al cargar el perfil',
      user: req.session.user
    });
  }
});

//muestra el formulario de edicion de perfil
router.get('/edit', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render('pages/edit-profile', { 
      user: user.toObject(),
      error: '' 
    });
  } catch (error) {
    res.status(500).render('pages/404', {
      message: 'Error al cargar el perfil',
      user: req.session.user
    });
  }
});

//procesa la actualizacion del perfil
router.post('/edit', 
  isAuthenticated,
  upload.single('avatar'),
  async (req, res) => {
    try {
      const userId = req.session.user._id;
      const { username, email, phone, description, existingAvatar } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).render('pages/404', {
          message: 'ID de usuario inválido',
          user: req.session.user
        });
      }

      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: userId } },
          { $or: [{ email }, { username }] }
        ]
      });

      if (existingUser) {
        throw new Error('El email o usuario ya están registrados');
      }

      if (phone && !/^\d{9}$/.test(phone)) {
        throw new Error('Teléfono debe tener 9 dígitos');
      }

      const updateData = {
        username,
        email,
        phone: phone || null,
        description,
        avatar: req.file ? '/uploads/avatars/' + req.file.filename : existingAvatar
      };

      if (req.file && existingAvatar && !existingAvatar.includes('default-avatar')) {
        const oldAvatarPath = path.join(__dirname, '../public', existingAvatar);
        fs.unlink(oldAvatarPath, (err) => {
          if (err) console.error('Error eliminando avatar antiguo:', err);
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      req.session.user = updatedUser;
      res.redirect('/profile');

    } catch (error) {
      res.status(400).render('pages/edit-profile', {
        user: req.session.user,
        error: error.message
      });
    }
  }
);

module.exports = router;