//importa el paquete mongoose 
const mongoose = require('mongoose');

//funcion para conectar a la base de datos
const connectDB = async () => {
  try {
    //trata de conectar con la base de datos mediante la uri de mongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    //si la conexion es exitosa muestra un mensaje en consola
    console.log('Conectado a MongoDB');
  } catch (err) {
    //si se produce un error muestra un mensaje en consola y termina el proceso
    console.error('Error de conexión a MongoDB:', err.message);
    process.exit(1);
  }
};

//exporta la funcion para que pueda ser utilizada en otros archivos
module.exports = connectDB;