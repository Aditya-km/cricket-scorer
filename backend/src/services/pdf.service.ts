import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { getMatchDetails } from './match.service.js';

export async function generateMatchPdf(matchId: string): Promise<Buffer> {
  const match = await getMatchDetails(matchId);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text('CRICKET MATCH SCORECARD', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor('#334155').fontSize(14).font('Helvetica').text(`${match.teamA.teamName} vs ${match.teamB.teamName}`, { align: 'center' });
    doc.moveDown(0.2);

    const matchDateStr = format(new Date(match.matchDate), 'dd MMMM yyyy');
    const venueStr = match.venue ? ` | Venue: ${match.venue}` : '';
    doc.fontSize(10).fillColor('#64748b').text(`Format: ${match.format} | Date: ${matchDateStr}${venueStr}`, { align: 'center' });
    doc.moveDown(0.5);

    // Toss & Result Box
    doc.rect(40, doc.y, 515, 45).fillAndStroke('#f8fafc', '#cbd5e1');
    const boxY = doc.y + 8;
    const tossText = match.tossWinnerId
      ? `Toss: ${match.tossWinnerId === match.teamAId ? match.teamA.teamName : match.teamB.teamName} won the toss and elected to ${match.tossDecision?.toLowerCase()}`
      : 'Toss: Not conducted';
    const resultText = match.resultDescription || `Status: ${match.status}`;

    doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(resultText, 50, boxY);
    doc.fillColor('#475569').fontSize(9).font('Helvetica').text(tossText, 50, boxY + 16);

    doc.y = boxY + 45;
    doc.moveDown(0.5);

    // Innings Scorecards
    match.innings.forEach(inn => {
      const battingTeam = inn.battingTeamId === match.teamAId ? match.teamA : match.teamB;
      const bowlingTeam = inn.bowlingTeamId === match.teamAId ? match.teamA : match.teamB;

      doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold').text(
        `Innings ${inn.inningsNumber} - ${battingTeam.teamName} (${inn.totalRuns}/${inn.wickets} in ${inn.oversCompletedText} ov)${inn.isDeclared ? ' [Declared]' : ''}`
      );
      doc.moveDown(0.3);

      // Batting Table Header
      const tableX = 40;
      let startY = doc.y;
      doc.rect(tableX, startY, 515, 20).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text('Batter', tableX + 8, startY + 5);
      doc.text('Dismissal', tableX + 160, startY + 5);
      doc.text('R', tableX + 340, startY + 5);
      doc.text('B', tableX + 380, startY + 5);
      doc.text('4s', tableX + 415, startY + 5);
      doc.text('6s', tableX + 450, startY + 5);
      doc.text('SR', tableX + 485, startY + 5);

      startY += 20;

      // Batting Rows
      doc.font('Helvetica').fontSize(8.5);
      inn.battingScorecards.forEach((b, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(tableX, startY, 515, 18).fill(rowBg);
        doc.fillColor('#1e293b');

        const playerName = `${b.player.playerName}${b.notOut ? '*' : ''} (#${b.player.jerseyNumber})`;
        const dismissal = b.notOut ? 'not out' : (b.dismissalText || b.dismissalType || 'out');

        doc.text(playerName, tableX + 8, startY + 5, { width: 145, ellipsis: true });
        doc.text(dismissal, tableX + 160, startY + 5, { width: 170, ellipsis: true });
        doc.text(b.runs.toString(), tableX + 340, startY + 5);
        doc.text(b.balls.toString(), tableX + 380, startY + 5);
        doc.text(b.fours.toString(), tableX + 415, startY + 5);
        doc.text(b.sixes.toString(), tableX + 450, startY + 5);
        doc.text(b.strikeRate.toFixed(1), tableX + 485, startY + 5);

        startY += 18;
      });

      // Extras & Total
      doc.rect(tableX, startY, 515, 18).fill('#f1f5f9');
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(8.5);
      const totalExtras = inn.byes + inn.legByes + inn.wides + inn.noBalls + inn.penaltyRuns;
      doc.text(`Extras: ${totalExtras} (b ${inn.byes}, lb ${inn.legByes}, w ${inn.wides}, nb ${inn.noBalls})`, tableX + 8, startY + 5);
      doc.text(`Total: ${inn.totalRuns}/${inn.wickets} (${inn.oversCompletedText} Overs)`, tableX + 340, startY + 5);

      startY += 24;
      doc.y = startY;

      // Bowling Table Header
      startY = doc.y;
      doc.rect(tableX, startY, 515, 20).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold');
      doc.text('Bowler', tableX + 8, startY + 5);
      doc.text('O', tableX + 260, startY + 5);
      doc.text('M', tableX + 310, startY + 5);
      doc.text('R', tableX + 360, startY + 5);
      doc.text('W', tableX + 410, startY + 5);
      doc.text('Econ', tableX + 460, startY + 5);

      startY += 20;

      // Bowling Rows
      doc.font('Helvetica').fontSize(8.5);
      inn.bowlingScorecards.forEach((bw, index) => {
        const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(tableX, startY, 515, 18).fill(rowBg);
        doc.fillColor('#1e293b');

        doc.text(`${bw.player.playerName} (#${bw.player.jerseyNumber})`, tableX + 8, startY + 5, { width: 240, ellipsis: true });
        doc.text(bw.oversText, tableX + 260, startY + 5);
        doc.text(bw.maidens.toString(), tableX + 310, startY + 5);
        doc.text(bw.runsConceded.toString(), tableX + 360, startY + 5);
        doc.text(bw.wickets.toString(), tableX + 410, startY + 5);
        doc.text(bw.economy.toFixed(2), tableX + 460, startY + 5);

        startY += 18;
      });

      // Fall of Wickets
      if (inn.wicketsList.length > 0) {
        startY += 5;
        const fowList = inn.wicketsList.map(w => `${w.teamRunsAtFall}-${w.wicketNumber} (${w.player.playerName}, ${w.overBallText})`).join(', ');
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(`Fall of Wickets: ${fowList}`, tableX, startY, { width: 515 });
        startY += doc.heightOfString(`Fall of Wickets: ${fowList}`, { width: 515 }) + 8;
      }

      doc.y = startY + 10;
      if (doc.y > 680) {
        doc.addPage();
      }
    });

    doc.end();
  });
}
