import { Request, Response } from 'express';
import { AiService } from '../../services/AiService';
import { z } from 'zod';

const generateQuizSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().min(1),
  numQuestions: z.number().min(1).max(20).optional(),
});

export const generateQuiz = async (req: Request, res: Response) => {
  try {
    const parsed = generateQuizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { subject, topic, numQuestions } = parsed.data;

    const questions = await AiService.generateQuiz(subject, topic, numQuestions);
    
    return res.json({ questions });
  } catch (error: any) {
    console.error('Error generating AI quiz:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate quiz' });
  }
};
