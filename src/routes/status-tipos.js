const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const statusTiposController = require('../controllers/statusTiposController');

router.get('/', authMiddleware, statusTiposController.getAll);
router.post('/', authMiddleware, adminMiddleware, statusTiposController.create);
router.put('/:id', authMiddleware, adminMiddleware, statusTiposController.update);
router.delete('/:id', authMiddleware, adminMiddleware, statusTiposController.delete);

module.exports = router;
