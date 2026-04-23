const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const hierarquiaController = require('../controllers/hierarquiaController');

// GET - Listar hierarquia
router.get('/', hierarquiaController.getAll);

// POST - Criar hierarquia
router.post('/', authMiddleware, adminMiddleware, hierarquiaController.create);

// PUT - Atualizar hierarquia
router.put('/:id', authMiddleware, adminMiddleware, hierarquiaController.update);

// DELETE - Deletar hierarquia
router.delete('/:id', authMiddleware, adminMiddleware, hierarquiaController.delete);

module.exports = router;
