import PDFDocument from 'pdfkit';
import { fail } from '../../core/errors.js';

// Version 1 is retained for previously published snapshots. No HTML, URLs or remote assets.
export async function statementPdf(row, snapshot, fontPath) {
  if (row.template_version !== 1) fail(409, 'PDF_TEMPLATE_UNAVAILABLE', 'Statement template is unavailable');
  const content = [snapshot.company.displayName, snapshot.company.legalName, snapshot.company.statementAddress,
    snapshot.employee.fullName, snapshot.employee.employeeCode, snapshot.employee.jobTitle, snapshot.employee.department,
    row.note, row.void_reason, ...row.earnings.map(v => v.label), ...row.deductions.map(v => v.label)].filter(Boolean).join('');
  if (!fontPath && /[^\x20-\x7E\r\n\t]/.test(content)) fail(409, 'PDF_FONT_REQUIRED', 'Configure a local Unicode font for this statement');
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: 'Internal salary statement', Author: 'Employee management' } });
  const chunks = [];
  const ready = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  if (fontPath) doc.font(fontPath);
  const money = value => `${row.currency_code} ${(value / (10 ** row.currency_minor_unit)).toFixed(row.currency_minor_unit)}`;
  doc.fontSize(19).text('Internal salary statement');
  doc.moveDown(0.4).fontSize(14).text(row.state === 'VOIDED' ? 'VOID - NOT CURRENT' : row.state === 'DRAFT' ? 'DRAFT - NOT PUBLISHED' : 'PUBLISHED');
  doc.moveDown().fontSize(11).text(snapshot.company.legalName || snapshot.company.displayName);
  if (snapshot.company.statementAddress) doc.text(snapshot.company.statementAddress);
  doc.moveDown().text(`Employee: ${snapshot.employee.fullName} (${snapshot.employee.employeeCode})`);
  doc.text(`Role: ${snapshot.employee.jobTitle} | Department: ${snapshot.employee.department}`);
  doc.text(`Period: ${row.period} | Revision: ${row.revision}`);
  const section = (title, lines) => {
    doc.moveDown().fontSize(13).text(title);
    for (const line of lines) {
      if (doc.y > 710) doc.addPage();
      doc.fontSize(11).text(`${line.label}: ${money(line.amountMinor)}`, { paragraphGap: 5 });
    }
    if (!lines.length) doc.fontSize(11).text('None');
  };
  section('Earnings', row.earnings);
  section('Deductions', row.deductions);
  doc.moveDown().fontSize(12).text(`Gross: ${money(row.gross_minor)}`);
  doc.text(`Total deductions: ${money(row.total_deductions_minor)}`);
  doc.text(`Net: ${money(row.net_minor)}`);
  if (row.note) doc.moveDown().fontSize(10).text('Note: ' + row.note);
  if (row.void_reason) doc.moveDown().fontSize(11).text('Void reason: ' + row.void_reason);
  doc.moveDown().fontSize(9).text('Internal statement only. Not proof of payment or a guarantee of statutory payroll compliance.');
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(i);
    doc.fontSize(8).text(`${row.state} | ${row.period} | Revision ${row.revision} | Page ${i + 1} of ${pages.count}`, 48, 790, { lineBreak: false });
  }
  doc.end();
  return ready;
}
