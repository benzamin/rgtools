// src/components/DiffViewer.jsx
import { diffLines } from 'diff';
import 'diff2html/bundles/css/diff2html.min.css';
import { jsPDF } from 'jspdf';
import { useEffect, useRef, useState } from 'preact/hooks';

const PDF_DOWNLOAD_LINE_LIMIT = 500;
const PDF_DOWNLOAD_LIMIT_MESSAGE = 'Free version supports max 500 lines of PDF download';

const getTextLineCount = (text) => (text ? text.split('\n').length : 0);

export default function DiffViewer() {
  const [originalText, setOriginalText] = useState('{\n  "name": "App",\n  "version": "1.0.0"\n}');
  const [modifiedText, setModifiedText] = useState('{\n  "name": "App",\n  "version": "1.1.0",\n  "status": "active"\n}');
  const [outputFormat, setOutputFormat] = useState('side-by-side');
  const [diffHtml, setDiffHtml] = useState('');
  const [isDiffing, setIsDiffing] = useState(true);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [textareaHeight, setTextareaHeight] = useState(220);
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const originalTextareaRef = useRef(null);
  const modifiedTextareaRef = useRef(null);
  const diffOutputRef = useRef(null);
  const textareaHeightRef = useRef(textareaHeight);

  const pdfColors = {
    text: [38, 38, 38],
    addedText: [20, 83, 45],
    removedText: [127, 29, 29],
    addedFill: [220, 252, 231],
    removedFill: [254, 226, 226],
  };

  const getDiffLineCount = () =>
    diffLines(originalText, modifiedText).reduce((total, part) => {
      const lines = part.value.split('\n');
      const lineCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
      return total + lineCount;
    }, 0);
  const isInputOverPdfLineLimit =
    Math.max(getTextLineCount(originalText), getTextLineCount(modifiedText)) > PDF_DOWNLOAD_LINE_LIMIT;
  const isPdfButtonDisabled = isSavingPdf || (!isInputOverPdfLineLimit && (isDiffing || !diffHtml));

  const addPdfLine = (pdf, text, x, y, maxWidth, pageHeight, margin, lineHeight, options = {}) => {
    const lines = pdf.splitTextToSize(text || ' ', maxWidth);
    let nextY = y;

    lines.forEach((line) => {
      if (nextY > pageHeight - margin) {
        pdf.addPage();
        nextY = margin;
      }
      if (options.fillColor) {
        pdf.setFillColor(...options.fillColor);
        pdf.rect(x - 1, nextY - lineHeight + 1, maxWidth + 2, lineHeight, 'F');
      }
      if (options.textColor) pdf.setTextColor(...options.textColor);
      pdf.text(line, x, nextY);
      nextY += lineHeight;
    });

    return nextY;
  };

  const addPdfColumnsRow = (
    pdf,
    leftText,
    rightText,
    y,
    columnWidth,
    gutter,
    pageHeight,
    margin,
    lineHeight,
    leftStyle = {},
    rightStyle = {}
  ) => {
    const leftLines = pdf.splitTextToSize(leftText || ' ', columnWidth);
    const rightLines = pdf.splitTextToSize(rightText || ' ', columnWidth);
    const rowLines = Math.max(leftLines.length, rightLines.length);

    if (y + rowLines * lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }

    if (leftStyle.fillColor) {
      pdf.setFillColor(...leftStyle.fillColor);
      pdf.rect(margin - 1, y - lineHeight + 1, columnWidth + 2, rowLines * lineHeight, 'F');
    }
    if (rightStyle.fillColor) {
      pdf.setFillColor(...rightStyle.fillColor);
      pdf.rect(margin + columnWidth + gutter - 1, y - lineHeight + 1, columnWidth + 2, rowLines * lineHeight, 'F');
    }

    pdf.setTextColor(...(leftStyle.textColor || pdfColors.text));
    pdf.text(leftLines, margin, y);
    pdf.setTextColor(...(rightStyle.textColor || pdfColors.text));
    pdf.text(rightLines, margin + columnWidth + gutter, y);

    return y + rowLines * lineHeight;
  };

  const addUnifiedDiffToPdf = (pdf, pageWidth, pageHeight, margin) => {
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 5;
    let y = margin + 14;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Diff Viewer Export', margin, margin);
    pdf.setFontSize(11);
    pdf.text('Unified Diff', margin, y);
    y += lineHeight + 2;
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9);

    diffLines(originalText, modifiedText).forEach((part) => {
      const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
      const textColor = part.added ? pdfColors.addedText : part.removed ? pdfColors.removedText : pdfColors.text;
      const fillColor = part.added ? pdfColors.addedFill : part.removed ? pdfColors.removedFill : undefined;

      part.value.split('\n').forEach((line, index, lines) => {
        if (index === lines.length - 1 && line === '') return;
        y = addPdfLine(pdf, `${prefix}${line}`, margin, y, maxWidth, pageHeight, margin, lineHeight, {
          fillColor,
          textColor,
        });
      });
    });

    pdf.setTextColor(0, 0, 0);
  };

  const addSideBySideToPdf = (pdf, pageWidth, pageHeight, margin) => {
    const gutter = 8;
    const columnWidth = (pageWidth - margin * 2 - gutter) / 2;
    const lineHeight = 5;
    let y = margin + 14;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Diff Viewer Export', margin, margin);
    pdf.setFontSize(11);
    pdf.text('Original', margin, y);
    pdf.text('Modified', margin + columnWidth + gutter, y);
    y += lineHeight + 2;
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(38, 38, 38);

    let originalLineNumber = 1;
    let modifiedLineNumber = 1;

    diffLines(originalText, modifiedText).forEach((part) => {
      const lines = part.value.split('\n');
      lines.forEach((line, index) => {
        if (index === lines.length - 1 && line === '') return;

        if (part.added) {
          y = addPdfColumnsRow(
            pdf,
            '',
            `${modifiedLineNumber}. + ${line}`,
            y,
            columnWidth,
            gutter,
            pageHeight,
            margin,
            lineHeight,
            {},
            { fillColor: pdfColors.addedFill, textColor: pdfColors.addedText }
          );
          modifiedLineNumber += 1;
          return;
        }

        if (part.removed) {
          y = addPdfColumnsRow(
            pdf,
            `${originalLineNumber}. - ${line}`,
            '',
            y,
            columnWidth,
            gutter,
            pageHeight,
            margin,
            lineHeight,
            { fillColor: pdfColors.removedFill, textColor: pdfColors.removedText },
            {}
          );
          originalLineNumber += 1;
          return;
        }

        y = addPdfColumnsRow(
          pdf,
          `${originalLineNumber}.   ${line}`,
          `${modifiedLineNumber}.   ${line}`,
          y,
          columnWidth,
          gutter,
          pageHeight,
          margin,
          lineHeight
        );
        originalLineNumber += 1;
        modifiedLineNumber += 1;
      });
    });

    pdf.setTextColor(0, 0, 0);
  };

  useEffect(() => {
    const worker = new Worker(new URL('./diff-worker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = ({ data }) => {
      if (data.id === requestIdRef.current) {
        setDiffHtml(data.diffHtml);
        requestAnimationFrame(() => {
          if (data.id === requestIdRef.current) setIsDiffing(false);
        });
      }
    };

    return () => worker.terminate();
  }, []);

  const handleSavePdf = async () => {
    setPdfError('');
    if (getDiffLineCount() > PDF_DOWNLOAD_LINE_LIMIT) {
      setPdfError(PDF_DOWNLOAD_LIMIT_MESSAGE);
      return;
    }

    if (!diffOutputRef.current || !diffHtml) return;

    setIsSavingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: outputFormat === 'side-by-side' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (outputFormat === 'side-by-side') {
        addSideBySideToPdf(pdf, pageWidth, pageHeight, 12);
      } else {
        addUnifiedDiffToPdf(pdf, pageWidth, pageHeight, 12);
      }

      pdf.save('diff.pdf');
    } catch (error) {
      if (error.name !== 'AbortError') setPdfError('Could not create the PDF. Please try again.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setIsDiffing(true);
    setPdfError('');
    const timeoutId = window.setTimeout(() => {
      workerRef.current?.postMessage({ requestId, id: requestId, originalText, modifiedText, outputFormat });
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [originalText, modifiedText, outputFormat]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const resizedEntry = entries.find((entry) => {
        const height = Math.max(100, entry.target.offsetHeight);
        return height !== textareaHeightRef.current;
      });
      if (!resizedEntry) return;

      const nextHeight = Math.max(100, resizedEntry.target.offsetHeight);
      textareaHeightRef.current = nextHeight;
      setTextareaHeight(nextHeight);
    });

    observer.observe(originalTextareaRef.current);
    observer.observe(modifiedTextareaRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="diff-viewer" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', border: '1px solid #d1d5db', borderRadius: '16px', padding: '1rem', background: 'var(--background)' }}>
      {/* Controls Bar */}
      <div className="diff-viewer-header">
        <span className="diff-viewer-title">Diff Viewer</span>
        <fieldset className="output-format-group" aria-label="Output format">
          <legend>Output format</legend>
          <label>
            <input
              type="radio"
              name="output-format"
              value="side-by-side"
              checked={outputFormat === 'side-by-side'}
              onChange={(e) => setOutputFormat(e.currentTarget.value)}
            />
            Side-by-Side
          </label>
          <label>
            <input
              type="radio"
              name="output-format"
              value="line-by-line"
              checked={outputFormat === 'line-by-line'}
              onChange={(e) => setOutputFormat(e.currentTarget.value)}
            />
            Unified
          </label>
        </fieldset>
      </div>

      {/* Input Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem'}}>
            Original
          </label>
          <textarea
            ref={originalTextareaRef}
            value={originalText}
            onInput={(e) => setOriginalText(e.target.value)}
            rows={10}
            style={{ boxSizing: 'border-box', width: '100%', height: `${textareaHeight}px`, minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)' }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Modified
          </label>
          <textarea
            ref={modifiedTextareaRef}
            value={modifiedText}
            onInput={(e) => setModifiedText(e.target.value)}
            rows={10}
            style={{ boxSizing: 'border-box', width: '100%', height: `${textareaHeight}px`, minHeight: '100px', resize: 'vertical', fontFamily: 'monospace', padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* Output Render Box */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h3>Differences Output</h3>
          {isDiffing && (
            <div
              role="progressbar"
              aria-label="Generating diff"
              aria-valuetext="Generating diff"
              style={{ width: '96px', height: '4px', overflow: 'hidden', borderRadius: '2px', background: 'var(--diff-progress-bg)' }}
            >
              <div style={{ width: '45%', height: '100%', background: 'var(--accent-blue)', animation: 'diff-progress 1s ease-in-out infinite' }} />
            </div>
          )}
          <button
            onClick={handleSavePdf}
            disabled={isPdfButtonDisabled}
            style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', background: 'var(--accent-blue)', color: 'var(--accent-blue-foreground)', cursor: isPdfButtonDisabled ? 'not-allowed' : 'pointer', opacity: isPdfButtonDisabled ? 0.6 : 1 }}
          >
            {isSavingPdf ? 'Preparing PDF...' : 'Save Diff as PDF'}
          </button>
          {pdfError && <p role="alert" style={{ flexBasis: '100%', margin: 0, color: 'var(--danger)', textAlign: 'right' }}>{pdfError}</p>}
        </div>
        <div 
          ref={diffOutputRef}
          dangerouslySetInnerHTML={{ __html: diffHtml }} 
          style={{ border: '1px solid var(--border)', borderRadius: '4px', overflowX: 'auto', background: 'var(--surface)' }}
        />
      </div>
      <style>{`
        @keyframes diff-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(320%); }
        }

        .diff-viewer-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #d1d5db;
        }

        .diff-viewer-title {
          grid-column: 2;
          justify-self: center;
          font-weight: 700;
          font-size: 1.15rem;
          text-align: center;
        }

        .output-format-group {
          grid-column: 3;
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          margin: 0;
          padding: 0;
          border: 0;
          color: var(--foreground);
          font-size: 0.9rem;
        }

        .output-format-group legend {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .output-format-group label {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          cursor: pointer;
          white-space: nowrap;
        }

        .output-format-group input {
          accent-color: var(--accent-blue);
        }

        @media (max-width: 720px) {
          .diff-viewer-header {
            grid-template-columns: 1fr;
            justify-items: center;
          }

          .diff-viewer-title,
          .output-format-group {
            grid-column: 1;
            justify-self: center;
          }

          .output-format-group {
            flex-wrap: wrap;
            justify-content: center;
          }
        }

        .diff-viewer .d2h-wrapper,
        .diff-viewer .d2h-file-wrapper,
        .diff-viewer .d2h-diff-table {
          background: var(--diff-output-bg);
          color: var(--foreground);
        }

        .diff-viewer .d2h-file-wrapper {
          border-color: var(--diff-output-border);
        }

        .diff-viewer .d2h-file-header {
          background: var(--diff-output-header-bg);
          border-color: var(--diff-output-border);
          color: var(--foreground);
        }

        .diff-viewer .d2h-code-line,
        .diff-viewer .d2h-code-side-line {
          background: var(--diff-output-line-bg);
          color: var(--foreground);
        }

        .diff-viewer .d2h-code-linenumber,
        .diff-viewer .d2h-code-side-linenumber {
          background: var(--diff-output-muted-bg);
          border-color: var(--diff-output-border);
          color: var(--muted-foreground);
        }

        .diff-viewer .d2h-info {
          background: var(--diff-output-muted-bg);
          color: var(--muted-foreground);
        }

        .diff-viewer .d2h-ins,
        .diff-viewer .d2h-ins .d2h-code-line,
        .diff-viewer .d2h-ins .d2h-code-side-line {
          background: var(--diff-output-ins-bg);
          color: var(--diff-output-ins-text);
        }

        .diff-viewer .d2h-del,
        .diff-viewer .d2h-del .d2h-code-line,
        .diff-viewer .d2h-del .d2h-code-side-line {
          background: var(--diff-output-del-bg);
          color: var(--diff-output-del-text);
        }

        .diff-viewer .d2h-code-line-ctn,
        .diff-viewer .d2h-code-side-line-ctn,
        .diff-viewer .d2h-code-line-prefix {
          color: inherit;
        }

        .diff-viewer ins {
          background: var(--diff-output-ins-bg);
          color: var(--diff-output-ins-text);
        }

        .diff-viewer del {
          background: var(--diff-output-del-bg);
          color: var(--diff-output-del-text);
        }
      `}</style>
    </div>
  );
}