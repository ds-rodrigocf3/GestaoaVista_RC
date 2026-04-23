const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const demandasController = require('../controllers/demandasController');

router.get('/', authMiddleware, demandasController.getAll);
router.post('/', authMiddleware, demandasController.create);
router.put('/:id', authMiddleware, demandasController.update);
router.delete('/:id', authMiddleware, adminMiddleware, demandasController.delete);

module.exports = router;
