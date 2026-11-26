import { Request, Response } from 'express';
import { AiService } from '../../services/AiService';
import { prisma } from '../../config/prisma';
import { z } from 'zod';

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  contextContext: z.string().optional(),
});

export const chat = async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.studentId;
    if (!studentId) return res.status(403).json({ error: 'Not a student' });

    // AI Restriction check: Is the student currently in a live quiz session?
    // We check if the student is enrolled in any session that has an active quiz
    const activeQuizzes = await prisma.quiz.findMany({
      where: {
        status: 'ACTIVE',
        class: { enrollments: { some: { studentId, status: 'ACTIVE' } } }
      }
    });

    if (activeQuizzes.length > 0) {
      return res.status(403).json({ 
        error: 'AI Assistant is temporarily disabled while a live quiz is active.',
        disabled: true 
      });
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { message, contextContext } = parsed.data;

    const reply = await AiService.getAssistantResponse(message, contextContext || '');
    
    return res.json({ reply });
  } catch (error: any) {
    console.error('Error generating AI response:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
};
