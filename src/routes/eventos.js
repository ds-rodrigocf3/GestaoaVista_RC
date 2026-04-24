const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const eventosController = require('../controllers/eventosController');

router.get('/', authMiddleware, eventosController.getAll);
router.post('/', authMiddleware, eventosController.create);
router.put('/:id', authMiddleware, eventosController.update);
router.delete('/:id', authMiddleware, eventosController.delete);

module.exports = router;
