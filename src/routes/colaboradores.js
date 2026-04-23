const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const colaboradoresController = require('../controllers/colaboradoresController');

// GET - Listar colaboradores
router.get('/', authMiddleware, colaboradoresController.getAll);

// GET - Obter colaborador por ID
router.get('/:id', authMiddleware, colaboradoresController.getById);

// POST - Criar colaborador
router.post('/', authMiddleware, adminMiddleware, colaboradoresController.create);

// PUT - Atualizar colaborador
router.put('/:id', authMiddleware, adminMiddleware, colaboradoresController.update);

// DELETE - Deletar colaborador (soft delete)
router.delete('/:id', authMiddleware, adminMiddleware, colaboradoresController.delete);

module.exports = router;
