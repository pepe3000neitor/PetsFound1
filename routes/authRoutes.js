const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const { isGuest } = require('../middlewares/auth');

//validación de contraseña segura
const passwordValidator = value => /^(?=.*\d)(?=.*[A-Z]).{8,}$/.test(value);

//muestra el formulario de registro para los usuarios no autenticados
router.get('/register', isGuest, (req, res) => {
  res.render('pages/register', { 
    errors: [],
    formData: {},
    error: null,
    user: req.session.user 
  });
});

//muestra el formulario de inicio de sesión para los usuarios no autenticados
router.get('/login', isGuest, (req, res) => {
  res.render('pages/login', { 
    error: null,
    identifier: '',
    user: req.session.user
  });
});

//procesar el registro de los usuarios
router.post('/register', [
  check('username').notEmpty().trim().withMessage('Nombre de usuario obligatorio'),
  check('email').isEmail().normalizeEmail().withMessage('Correo no válido'),
  check('password').custom(passwordValidator).withMessage('Contraseña insegura'),
  check('confirmPassword').custom((value, { req }) => value === req.body.password).withMessage('Contraseñas no coinciden'),
  check('birthDate').isISO8601().withMessage('Fecha no válida')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.render('pages/register', {
      errors: errors.array().reduce((acc, err) => {
        acc[err.param] = err.msg;
        return acc;
      }, {}),
      formData: req.body,
      error: null,
      user: req.session.user 
    });
  }

  try {
    const existingUser = await User.findOne({ 
      $or: [{ email: req.body.email }, { username: req.body.username }] 
    });

    if (existingUser) {
      const errorMsg = existingUser.email === req.body.email 
        ? 'Correo ya registrado' 
        : 'Usuario ya existe';
      return res.render('pages/register', {
        errors: { email: errorMsg },
        formData: req.body,
        error: null,
        user: req.session.user
      });
    }

    const newUser = new User({ ...req.body,avatar: '/ImgProf/usuario.png', birthDate: new Date(req.body.birthDate) });
    await newUser.save();
    req.session.user = newUser;
    res.redirect('/');

  } catch (err) {
    res.status(500).render('pages/404', { 
      message: 'Error del servidor',
      error: process.env.NODE_ENV === 'development' ? err : {},
      user: req.session.user 
    });
  }
});

//procesa el formulario de inicio de sesión de los usuarios
router.post('/login', [
  check('identifier').notEmpty().withMessage('Correo o usuario requerido'),
  check('password').notEmpty().withMessage('Contraseña requerida')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMap = errors.array().reduce((acc, err) => {
      acc[err.param] = err.msg;
      return acc;
    }, {});

    return res.render('pages/login', {
      errors: errorMap,
      identifier: req.body.identifier,
      user: req.session.user 
    });
  }
  try {
    const user = await User.findOne({ 
      $or: [{ email: req.body.identifier }, { username: req.body.identifier }] 
    });

    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.render('pages/login', {
        error: 'Credenciales inválidas',
        identifier: req.body.identifier,
        user: req.session.user 
      });
    }

    req.session.user = user;
    res.redirect('/');

  } catch (err) {
    res.status(500).render('pages/404', { 
      message: 'Error del servidor',
      error: process.env.NODE_ENV === 'development' ? err : {},
      user: req.session.user 
    });
  }
});

//procesa el formulario de inicio de sesión
router.get('/login', isGuest, (req, res) => {
  res.render('pages/login', {
    error: null,
    errors: {},
    identifier: '',
    user: null
  });
});

//cierre de sesion de usuario
router.get('/logout', (req, res) => {
  const user = req.session.user;
  req.session.destroy(err => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return res.redirect('/');
    }
    res.render('pages/logout', { user: null }); 
  });
});
module.exports = router; 