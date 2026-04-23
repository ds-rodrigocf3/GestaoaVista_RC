const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const requestsController = require('../controllers/requestsController');

router.get('/', authMiddleware, requestsController.getAll);
router.post('/', authMiddleware, requestsController.create);
router.put('/:id', authMiddleware, requestsController.update);
router.delete('/:id', authMiddleware, requestsController.remove);

module.exports = router;
