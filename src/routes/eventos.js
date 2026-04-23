const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const eventosController = require('../controllers/eventosController');

router.get('/', authMiddleware, eventosController.getAll);
router.post('/', authMiddleware, adminMiddleware, eventosController.create);
router.put('/:id', authMiddleware, adminMiddleware, eventosController.update);
router.delete('/:id', authMiddleware, adminMiddleware, eventosController.delete);

module.exports = router;
