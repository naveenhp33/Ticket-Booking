const express = require('express');
const router = express.Router();
const { getArticles, getArticle, searchArticles, createArticle, updateArticle, rateArticle } = require('../controllers/knowledge.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/search', protect, searchArticles);
router.get('/', protect, getArticles);
router.post('/', protect, authorize('admin', 'support_agent'), createArticle);
router.get('/:id', protect, getArticle);
router.put('/:id', protect, authorize('admin', 'support_agent'), updateArticle);
router.post('/:id/rate', protect, rateArticle);

module.exports = router;
