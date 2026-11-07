import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini API client if API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  let aiClient: GoogleGenAI | null = null;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      aiClient = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.warn('Failed to initialize Gemini client:', e);
    }
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(aiClient),
      timestamp: new Date().toISOString()
    });
  });

  // Server-side Gemini proxy for chat (function calling support & privacy safe)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      if (!aiClient) {
        return res.status(503).json({
          error: 'Gemini API is not configured. Please ensure GEMINI_API_KEY is configured in environment secrets.'
        });
      }

      const { messages, tools, systemInstruction } = req.body;
      const model = 'gemini-2.5-flash';

      const response = await aiClient.models.generateContent({
        model,
        contents: messages,
        config: {
          systemInstruction: systemInstruction || 'You are BritConnect Analyst, a senior UK telecommunications retention specialist and churn data scientist. Base all statements strictly on the evidence and tool outputs provided. Never fabricate numbers.',
          temperature: 0.2,
          tools: tools ? [{ functionDeclarations: tools }] : undefined
        }
      });

      res.json({
        candidates: response.candidates,
        text: response.text
      });
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      res.status(500).json({ error: err.message || 'Error processing AI chat' });
    }
  });

  // Server-side Gemini proxy for retention recommendations narrative
  app.post('/api/gemini/recommendations', async (req, res) => {
    try {
      if (!aiClient) {
        return res.status(503).json({
          error: 'Gemini API is not configured.'
        });
      }

      const { prompt, systemInstruction } = req.body;
      const model = 'gemini-2.5-flash';

      const response = await aiClient.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || 'You are BritConnect Senior Retention Strategist. You write precise, evidence-based recommendations based strictly on the factual evidence packet provided. Never invent numbers.',
          temperature: 0.3
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('Gemini recommendations error:', err);
      res.status(500).json({ error: err.message || 'Error generating recommendations' });
    }
  });

  // Mount Vite development middlewares
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BritConnect Platform server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
