//controlador que muestra el formulario en login
exports.loginForm = (req, res) => {
  res.render('pages/login');
};
//controlador que muestra el formulario en register
exports.registerForm = (req, res) => {
  res.render('pages/register');
};