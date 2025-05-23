// importes 
const multer = require('multer');
const path = require('path');

//configura el almacenamiento de los archivos
const storage = multer.diskStorage({
  //ruta de destino de los archivos
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/avatars/');
  },
  //define el nombre con el que se guardara el archivo
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

//filtro para validar el tipo de archivo
const fileFilter = (req, file, cb) => {
  //acepta solo archivos de imagen
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'), false);
  }
};

//configuracion de multer
const upload = multer({
  storage: storage,
  limits: { //limira el tamaño del archivo a 5mb
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter //filtro para validar el tipo de archivo
});

module.exports = upload;