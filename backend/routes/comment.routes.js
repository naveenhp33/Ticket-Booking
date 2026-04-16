// comment.routes.js
const express = require('express');
const router = express.Router();
const { addComment, getComments, editComment, deleteComment } = require('../controllers/comment.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/:ticketId', protect, getComments);
router.post('/:ticketId', protect, upload.array('attachments', 3), addComment);
router.put('/:id', protect, editComment);
router.delete('/:id', protect, deleteComment);

module.exports = router;
