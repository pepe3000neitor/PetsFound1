//middleware para verificar si el usuario está autenticado
exports.isAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/auth/login');
};

//middleware para verificar si el usuario no está autenticado
exports.isGuest = (req, res, next) => {
  if (!req.session.user) return next();
  res.redirect('/'); 
};