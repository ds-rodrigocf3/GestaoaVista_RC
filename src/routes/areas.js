const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const areasController = require('../controllers/areasController');

// GET - Listar areas
router.get('/', authMiddleware, areasController.getAll);

// POST - Criar area
router.post('/', authMiddleware, adminMiddleware, areasController.create);

// PUT - Atualizar area
router.put('/:id', authMiddleware, adminMiddleware, areasController.update);

// DELETE - Deletar area
router.delete('/:id', authMiddleware, adminMiddleware, areasController.delete);

module.exports = router;
