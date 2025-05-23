const mongoose = require('mongoose');

//esquema de posts
const postSchema = new mongoose.Schema({
  //nombre de la mascota
  petName: {
    type: String,
    required: [true, 'El nombre de la mascota es obligatorio'],
    trim: true
  },
  //tipo de mascota
  petType: {
    type: String,
    required: [true, 'El tipo de mascota es obligatorio'],
    enum: ['perro', 'gato', 'hamster', 'pájaro', 'otro']
  },
  //estado de la mascota
  status: {
    type: String,
    required: [true, 'El estado es obligatorio'],
    enum: ['perdido', 'encontrado'],
    default: 'perdido'
  },
  //descripcion de la mascota
  description: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
  //imagenes de la mascota
  images: [{
    type: String, 
    required: [true, 'Al menos una imagen es obligatoria']
  }],
  //ubicacion de la mascota
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number], 
      required: [true, 'Las coordenadas son obligatorias']
    }
  },
  //recompensa por la mascota
  reward: {
    type: Number,
    default: 0,
    min: [0, 'La recompensa no puede ser negativa']
  },
  //usuario que crea el post
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  //fecha de creación del post
  lostDate: {
    type: Date,
    required: [true, 'La fecha de pérdida es obligatoria'],
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'La fecha no puede ser futura'
    }
  },
  //fecha de actualización del post
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: [true, 'El comentario no puede estar vacío'],
      maxlength: [500, 'El comentario no puede exceder los 500 caracteres']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

//el campo 'location' es un índice geoespacial
postSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Post', postSchema);