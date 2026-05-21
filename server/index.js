import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/generate', async (req, res) => {
    try {
        const { jobTitle } = req.body;

        // Validation: non-empty, sanitized, 2–100 chars [cite: 5]
        if (!jobTitle || jobTitle.trim().length < 2 || jobTitle.trim().length > 100) {
            return res.status(400).json({ error: "Job title must be between 2 and 100 characters." });
        }

        // Use Gemini 1.5 Flash 
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Suggested Prompt [cite: 6, 7]
        const prompt = `You are an expert hiring manager. Generate 3 thoughtful and role-specific interview questions for the following position: 
        Job Title: ${jobTitle} 
        Requirements: 
        - Questions should assess practical ability 
        - Questions should be concise 
        - Questions should not be generic 
        - Return only the questions as a numbered list.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse the numbered list into an array for the structured response [cite: 9, 10]
        const questionsArray = responseText
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.replace(/^\d+\.\s*/, '').trim());

        res.json({ questions: questionsArray });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to generate questions. Please try again later." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});