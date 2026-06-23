import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

/*
|--------------------------------------------------------------------------
| Validate Environment Variables
|--------------------------------------------------------------------------
*/

if (!process.env.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY in .env');
    process.exit(1);
}

/*
|--------------------------------------------------------------------------
| Initialize Gemini
|--------------------------------------------------------------------------
*/

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const sanitizeJobTitle = (value) =>
    value
        .trim()
        .replace(/[<>]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const parseQuestions = (text) =>
    text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line =>
            line
                .replace(/^(\d+[\.)]|[-*])\s*/, '')
                .trim()
        )
        .filter(Boolean)
        .slice(0, 3);

/*
|--------------------------------------------------------------------------
| Health Check Route
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'AI Interview Generator API is running'
    });
});

/*
|--------------------------------------------------------------------------
| Generate Interview Questions
|--------------------------------------------------------------------------
*/

app.post('/api/generate', async (req, res) => {
    try {
        const { jobTitle } = req.body ?? {};

        /*
        |--------------------------------------------------------------------------
        | Validation
        |--------------------------------------------------------------------------
        */

        if (typeof jobTitle !== 'string') {
            return res.status(400).json({
                error: 'Job title is required.'
            });
        }

        const sanitizedJobTitle = sanitizeJobTitle(jobTitle);

        // Length validation
        if (sanitizedJobTitle.length < 2 || sanitizedJobTitle.length > 100) {
            return res.status(400).json({
                error: 'Job title must be between 2 and 100 characters.'
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Gemini Model
        |--------------------------------------------------------------------------
        */

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME
        });

        /*
        |--------------------------------------------------------------------------
        | Prompt
        |--------------------------------------------------------------------------
        */

        const prompt = `
You are an expert hiring manager.

Generate exactly 3 thoughtful and role-specific interview questions for this role:

"${sanitizedJobTitle}"

Rules:
- Questions must assess practical ability
- Questions must be concise
- Questions must not be generic
- Return ONLY the questions
- Use a numbered list
`;

        /*
        |--------------------------------------------------------------------------
        | Generate Content
        |--------------------------------------------------------------------------
        */

        const result = await model.generateContent(prompt);

        const response = await result.response;

        const text = response.text().trim();

        if (!text) {
            return res.status(502).json({
                success: false,
                error: 'AI returned an empty response.'
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Parse Questions
        |--------------------------------------------------------------------------
        */

        const questionsArray = parseQuestions(text);

        if (questionsArray.length !== 3) {
            return res.status(502).json({
                success: false,
                error: 'AI returned an unexpected response format.'
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        return res.json({
            success: true,
            jobTitle: sanitizedJobTitle,
            questions: questionsArray
        });

    } catch (error) {
        console.error('AI Generation Error:', error);

        return res.status(500).json({
            success: false,
            error: 'Failed to generate interview questions.'
        });
    }
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
            success: false,
            error: 'Request body must be valid JSON.'
        });
    }

    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Request body is too large.'
        });
    }

    next(error);
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
