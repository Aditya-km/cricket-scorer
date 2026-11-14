import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { generateMatchPdf } from '../services/pdf.service.js';

export async function downloadMatchPdf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const matchId = req.params.id;
    const pdfBuffer = await generateMatchPdf(matchId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=match-scorecard-${matchId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}
