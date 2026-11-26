import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the API only if the key is provided
const ai = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = ai ? ai.getGenerativeModel({ model: 'gemini-2.5-flash' }) : null;

export class AiService {
  /**
   * Generates a quiz in JSON format based on the topic.
   */
  static async generateQuiz(subject: string, topic: string, numQuestions: number = 5) {
    if (!model) {
      throw new Error('AI API key is not configured.');
    }

    const prompt = `
You are an expert academic quiz generator. 
Generate a multiple choice quiz for the subject: "${subject}" on the topic: "${topic}".
Generate exactly ${numQuestions} questions.
Format the output strictly as a JSON array of objects.
Each object must have the following structure:
{
  "text": "The question text",
  "type": "MCQ",
  "points": 1,
  "options": [
    { "text": "Option 1", "isCorrect": true },
    { "text": "Option 2", "isCorrect": false },
    { "text": "Option 3", "isCorrect": false },
    { "text": "Option 4", "isCorrect": false }
  ]
}
Do not include markdown blocks like \`\`\`json. Output ONLY the raw JSON array.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      // Clean up the text in case the model wrapped it in markdown
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/```json/g, '');
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/```/g, '');
      cleanJson = cleanJson.trim();
      
      const parsed = JSON.parse(cleanJson);
      return parsed;
    } catch (error) {
      console.error('Failed to parse AI response:', responseText);
      throw new Error('Failed to generate a valid quiz format.');
    }
  }

  /**
   * General learning assistant chat response with academic context.
   */
  static async getAssistantResponse(message: string, contextContext: string = '') {
    if (!model) {
      throw new Error('AI API key is not configured.');
    }

    const prompt = `
You are an intelligent, helpful academic learning assistant for a college student.
Context about the student's current environment (e.g., active class, subject):
${contextContext}

Student's query: 
"${message}"

Provide a concise, helpful, and educational response. Do not provide direct answers for assignments or exams, but explain concepts clearly.
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
