import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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
        let { jobTitle } = req.body;

        /*
        |--------------------------------------------------------------------------
        | Validation
        |--------------------------------------------------------------------------
        */

        if (!jobTitle || typeof jobTitle !== 'string') {
            return res.status(400).json({
                error: 'Job title is required.'
            });
        }

        // Trim whitespace
        jobTitle = jobTitle.trim();

        // Length validation
        if (jobTitle.length < 2 || jobTitle.length > 100) {
            return res.status(400).json({
                error: 'Job title must be between 2 and 100 characters.'
            });
        }

        // Basic sanitization
        jobTitle = jobTitle.replace(/[<>]/g, '');

        /*
        |--------------------------------------------------------------------------
        | Gemini Model
        |--------------------------------------------------------------------------
        */

        const model = genAI.getGenerativeModel({
            model: "google/gemini-flash-1.5"
            //model: "gemini-1.5-flash-001"
        });

        /*
        |--------------------------------------------------------------------------
        | Prompt
        |--------------------------------------------------------------------------
        */

        const prompt = `
You are an expert hiring manager.

Generate exactly 3 thoughtful and role-specific interview questions for this role:

"${jobTitle}"

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

        const text = response.text();

        /*
        |--------------------------------------------------------------------------
        | Parse Questions
        |--------------------------------------------------------------------------
        */

        const questionsArray = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line =>
                line
                    .replace(/^\d+\.\s*/, '')
                    .replace(/^[-*]\s*/, '')
                    .trim()
            )
            .filter(line => line.length > 0);

        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        return res.json({
            success: true,
            jobTitle,
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

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});