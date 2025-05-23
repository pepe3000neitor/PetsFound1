const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

//esquema de usuario
const userSchema = new mongoose.Schema({
  //avatar del usuario
  avatar: {
    type: String,
    default: '/ImgProf/usuario.png'
  },
  //nombre del usuario
  username: {
    type: String,
    required: [true, 'El nombre de usuario es obligatorio'],
    unique: true,
    trim: true
  },
  //correo electrónico del usuario
  email: {
    type: String,
    required: [true, 'El correo electrónico es obligatorio'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Correo electrónico no válido']
  },
  //numero de teléfono del usuario
  phone: {
    type: String,
    validate: {
      validator: v => !v || /^\d{9}$/.test(v),
      message: 'Teléfono debe tener 9 dígitos'
    },
    default: null
  },
  //descripción del usuario
  description: {
    type: String,
    default: '',
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
  //contraseña del usuario
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
  },
  //fecha de nacimiento del usuario
  birthDate: {
    type: Date,
    required: [true, 'La fecha de nacimiento es obligatoria']
  },
  //posts del usuario
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }]
}, { timestamps: true });

//encriptar la contraseña antes de guardar el usuario
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
//comprobar si la contraseña es correcta
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);