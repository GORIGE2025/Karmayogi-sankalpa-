import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is missing. Please check your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // POST /api/ai/awareness-pack
  // Uses free-tier model 'gemini-4-hydrogen' to generate Telugu public service educational awareness
  // thumbnail copy, civic leadership takeaways, and video narration scripts for 1 or all 5 questions.
  app.post('/api/ai/awareness-pack', async (req, res) => {
    try {
      const ai = getGenAIClient();
      const { episodes, customFocus } = req.body as {
        episodes: Array<{
          id: number;
          title: string;
          shortTitle: string;
          attr: string;
          s: string;
          o: string[];
          l: string[];
        }>;
        customFocus?: string;
      };

      if (!Array.isArray(episodes) || episodes.length === 0) {
        res.status(400).json({ error: 'Episodes array is required.' });
        return;
      }

      const prompt = `మీరు "కర్మయోగి సంకల్పం (Mission Karmayogi - Leadership as a Mission)" ప్రభుత్వ ఉద్యోగుల శిక్షణ మరియు ప్రజా సేవ అవగాహన నిపుణులు.
క్రింది ${episodes.length} ప్రజా సేవ పరిస్థితి ఆధారిత (Situational Judgment) ప్రశ్నల కోసం తెలుగులో ఆకర్షణీయమైన ఎడ్యుకేషనల్ థంబ్‌నెయిల్ టెక్స్ట్, పౌర సేవా అవగాహన సందేశం, మరియు వీడియో నేరేషన్ స్క్రిప్ట్ రూపొందించండి.
${customFocus ? `అదనపు సూచన: ${customFocus}` : ''}

ప్రశ్నల వివరాలు:
${episodes
  .map(
    (ep) => `Q${ep.id + 1}: ${ep.title} (నాయకత్వ గుణం: ${ep.attr})
పరిస్థితి: ${ep.s}
ఎంపికలు:
${ep.o.map((opt, idx) => `${['A', 'B', 'C', 'D', 'E'][idx]}: ${opt} (${ep.l[idx]})`).join('\n')}`
  )
  .join('\n\n')}

ప్రతి ప్రశ్నకు ఈ క్రింది వివరాలను స్పష్టమైన, సరళమైన తెలుగులో ఇవ్వండి:
1. id: ప్రశ్న యొక్క id (0 నుండి 4)
2. thumbnailHeadlineTe: థంబ్‌నెయిల్ కోసం శక్తివంతమైన తెలుగు శీర్షిక (3-6 పదాలు)
3. thumbnailBadgeTe: థంబ్‌నెయిల్ బ్యాడ్జ్ టెక్స్ట్ (ఉదా: "ప్రజా సేవలో మీ నిర్ణయం ఏమిటి?")
4. civicLessonTe: ప్రభుత్వ ఉద్యోగులకు మరియు పౌరులకు ఈ పరిస్థితి నేర్పే ముఖ్యమైన ప్రజా సేవా పాఠం (2-3 వాక్యాలు)
5. bestApproachInsightTe: అన్ని కోణాలను సమతుల్యం చేసే ఆదర్శవంతమైన నాయకత్వ దృక్పథం (2 వాక్యాలు)
6. videoScriptTe: 45-60 సెకన్ల ఎడ్యుకేషనల్ వీడియో వాయిస్ ఓవర్ స్క్రిప్ట్ (పరిచయం, సమస్య సారాంశం, నాయకత్వ విలువ, మరియు ముగింపుతో)
7. socialPostTe: వాట్సాప్ మరియు యూట్యూబ్ కమ్యూనిటీలో షేర్ చేయడానికి సంక్షిప్త అవగాహన పోస్ట్`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert public administration educator creating Telugu civic awareness content for Mission Karmayogi (iGOT Karmayogi) by Sreenath Solutions. Keep responses concise, inspiring, and grammatically accurate in Telugu.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                thumbnailHeadlineTe: { type: Type.STRING },
                thumbnailBadgeTe: { type: Type.STRING },
                civicLessonTe: { type: Type.STRING },
                bestApproachInsightTe: { type: Type.STRING },
                videoScriptTe: { type: Type.STRING },
                socialPostTe: { type: Type.STRING },
              },
              required: [
                'id',
                'thumbnailHeadlineTe',
                'thumbnailBadgeTe',
                'civicLessonTe',
                'bestApproachInsightTe',
                'videoScriptTe',
                'socialPostTe',
              ],
            },
          },
        },
      });

      const jsonText = (response.text ?? '[]').trim();
      const parsed = JSON.parse(jsonText);
      res.json({ packs: parsed, model: 'gemini-4-hydrogen' });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Failed to generate AI awareness pack.';
      console.error('Error in /api/ai/awareness-pack:', errMsg);
      res.status(500).json({ error: errMsg });
    }
  });

  // POST /api/ai/tts
  // Uses free-tier model 'gemini-3.8-flash-lite-tts' to generate studio WAV voiceover in Telugu
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const ai = getGenAIClient();
      const { text, voiceName = 'Kore' } = req.body as {
        text: string;
        voiceName?: string;
      };

      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text is required for TTS generation.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: 'Clear, warm, authoritative Telugu public service educator',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(500).json({ error: 'No audio data returned from Gemini TTS.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        model: 'gemini-3.8-flash-lite-tts',
      });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : 'Failed to generate TTS audio.';
      console.error('Error in /api/ai/tts:', errMsg);
      res.status(500).json({ error: errMsg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
