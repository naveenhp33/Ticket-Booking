const KnowledgeBase = require('../models/KnowledgeBase.model');

const getArticles = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const query = { isPublished: true };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const articles = await KnowledgeBase.find(query)
      .sort({ viewCount: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('title category tags viewCount helpfulCount createdAt')
      .lean();

    res.json({ success: true, articles });
  } catch (err) { next(err); }
};

const getArticle = async (req, res, next) => {
  try {
    const article = await KnowledgeBase.findById(req.params.id).populate('createdBy', 'name');
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
    article.viewCount += 1;
    await article.save();
    res.json({ success: true, article });
  } catch (err) { next(err); }
};

const searchArticles = async (req, res, next) => {
  try {
    const { q, category } = req.query;
    if (!q) return res.json({ success: true, articles: [] });
    const query = { isPublished: true, $text: { $search: q } };
    if (category) query.category = category;
    const articles = await KnowledgeBase.find(query).limit(5).select('title category tags').lean();
    res.json({ success: true, articles });
  } catch (err) { next(err); }
};

const createArticle = async (req, res, next) => {
  try {
    const article = await KnowledgeBase.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, article });
  } catch (err) { next(err); }
};

const updateArticle = async (req, res, next) => {
  try {
    const article = await KnowledgeBase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!article) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, article });
  } catch (err) { next(err); }
};

const rateArticle = async (req, res, next) => {
  try {
    const { helpful } = req.body;
    const update = helpful ? { $inc: { helpfulCount: 1 } } : { $inc: { notHelpfulCount: 1 } };
    await KnowledgeBase.findByIdAndUpdate(req.params.id, update);
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { getArticles, getArticle, searchArticles, createArticle, updateArticle, rateArticle };
