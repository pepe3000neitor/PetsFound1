const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  petName: {
    type: String,
    required: [true, 'El nombre de la mascota es obligatorio'],
    trim: true
  },
  petType: {
    type: String,
    required: [true, 'El tipo de mascota es obligatorio'],
    enum: ['perro', 'gato', 'hamster', 'pájaro', 'otro']
  },
  status: {
    type: String,
    required: [true, 'El estado es obligatorio'],
    enum: ['perdido', 'encontrado'],
    default: 'perdido'
  },
  description: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
  images: [{
    type: String, 
    required: [true, 'Al menos una imagen es obligatoria']
  }],
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
  reward: {
    type: Number,
    default: 0,
    min: [0, 'La recompensa no puede ser negativa']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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

postSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Post', postSchema);