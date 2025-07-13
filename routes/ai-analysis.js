const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJsonFromMarkdown(responseText) {
  const markdownJsonRegex = /```json\s*([\s\S]*?)\s*```/i;
  const match = responseText.match(markdownJsonRegex);

  if (match) {
    return match[1].trim();
  }

  return responseText.trim();
}


async function callGeminiAPI(cvContent, jobTitle, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemma-3n-e4b-it" });

const prompt = `
You are a career advisor AI and you give a score based on how well a CV matches a job description. Your task is to analyze the CV content in LaTeX format against the provided job title and job description.
Analyze the following CV (in LaTeX format) in the context of the job title and job description. Return a **raw JSON object only** — no markdown, no code blocks, no explanations.
Give a score from 0 to 1 based on how well the CV aligns with the job description, along with key skills, recommendations, and a brief summary. If the CV is not relevant or if the job description is dumb, return a score of 0.
For the key skills, provide a list of relevant skills that match the job description.
---

Respond in the following **strict JSON format**:

{
  "keySkills": ["Skill 1", "Skill 2", "Skill 3"],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2",
    "Recommendation 3"
  ],
  "notes": "Brief summary of CV alignment with the job.",
  "score": 0.75
}

---

Job Title: ${jobTitle}

Job Description:
${jobDescription}

CV Content (LaTeX):
${cvContent}



---

⚠️ STRICT INSTRUCTIONS:
- Output ONLY a raw JSON object
- NO \`\`\`json or any markdown
- NO commentary, headers, or extra text
- If you include any formatting, the response will be rejected
`;



    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonText = extractJsonFromMarkdown(text);
    // console.log(jsonText);

    return {
      body: JSON.parse(jsonText),
      notes: `CV analysis complete for "${jobTitle}".`
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Gemini API call failed');
  }
}

// POST /api/analyze-job-description
router.post('/analyze-job-description', async (req, res) => {
  try {
    const { jobTitle, jobDescription } = req.body;

    if (!jobTitle || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: 'jobTitle and jobDescription are required'
      });
    }

    // Load the LaTeX template
    const templatePath = path.join('templates', 'cv_template.tex');
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({
        success: false,
        message: 'cv_template.tex not found in templates directory'
      });
    }

    const cvContent = fs.readFileSync(templatePath, 'utf8');

    // Send to Gemini or AI model
    const aiResult = await callGeminiAPI(cvContent, jobTitle, jobDescription);

    return res.json({
      success: true,
      message: 'AI analysis completed successfully',
      data: aiResult
    });

  } catch (error) {
    console.error('Error analyzing job description:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during AI analysis',
      error: error.message
    });
  }
});

module.exports = router;
