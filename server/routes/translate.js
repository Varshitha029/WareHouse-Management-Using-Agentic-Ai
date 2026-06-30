const express = require('express');
const router = express.Router();
const axios = require('axios');

// Google Translate API (free endpoint)
const translateText = async (text, targetLang) => {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await axios.get(url);
    if (response.data && response.data[0]) {
      return response.data[0].map(item => item[0]).join('');
    }
    return text;
  } catch (error) {
    console.error('Translation error for text:', text.substring(0, 50), error.message);
    return text;
  }
};

// POST /api/translate - Translate array of texts
router.post('/', async (req, res) => {
  try {
    const { texts, targetLanguage } = req.body;

    if (!texts || !Array.isArray(texts) || !targetLanguage) {
      return res.status(400).json({ error: 'texts (array) and targetLanguage are required' });
    }

    if (targetLanguage === 'en') {
      return res.json({ translations: texts });
    }

    // Batch translate: combine texts with separator to reduce API calls
    const BATCH_SIZE = 20;
    const translations = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(text => translateText(text, targetLanguage));
      const batchResults = await Promise.all(batchPromises);
      translations.push(...batchResults);
    }

    res.json({ translations, language: targetLanguage });
  } catch (error) {
    console.error('Translation endpoint error:', error);
    res.status(500).json({ error: 'Translation failed', translations: req.body.texts });
  }
});

// POST /api/translate/single - Translate single text
router.post('/single', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'text and targetLanguage are required' });
    }

    if (targetLanguage === 'en') {
      return res.json({ translation: text });
    }

    const translated = await translateText(text, targetLanguage);
    res.json({ translation: translated, language: targetLanguage });
  } catch (error) {
    console.error('Translation endpoint error:', error);
    res.status(500).json({ error: 'Translation failed', translation: req.body.text });
  }
});

module.exports = router;
