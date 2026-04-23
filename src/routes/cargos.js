const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const cargosController = require('../controllers/cargosController');

router.get('/', authMiddleware, cargosController.getAll);
router.post('/', authMiddleware, adminMiddleware, cargosController.create);
router.put('/:id', authMiddleware, adminMiddleware, cargosController.update);
router.delete('/:id', authMiddleware, adminMiddleware, cargosController.delete);

module.exports = router;
