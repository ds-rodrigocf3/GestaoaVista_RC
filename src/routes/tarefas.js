const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const tarefasController = require('../controllers/tarefasController');

router.get('/', authMiddleware, tarefasController.getAll);
router.post('/', authMiddleware, tarefasController.create);
router.put('/:id', authMiddleware, tarefasController.update);
router.delete('/:id', authMiddleware, tarefasController.delete);

module.exports = router;
