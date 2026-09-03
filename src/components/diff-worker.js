import { createTwoFilesPatch } from 'diff';
import { html as diff2html } from 'diff2html';

self.onmessage = ({ data }) => {
  const { id, originalText, modifiedText, outputFormat } = data;

  try {
    // Default unified-diff context is only 4 lines; use a large context so
    // unchanged lines far from any edit aren't dropped from the output.
    const contextLineCount = Math.max(originalText.split('\n').length, modifiedText.split('\n').length);
    const patch = createTwoFilesPatch('Original', 'Modified', originalText, modifiedText, '', '', { context: contextLineCount });
    const diffHtml = diff2html(patch, {
      inputFormat: 'diff',
      outputFormat,
      drawFileList: false,
      matching: 'lines'
    });
    self.postMessage({ id, diffHtml });
  } catch {
    self.postMessage({ id, diffHtml: '<div class="error">Invalid input data for diff generation.</div>' });
  }
};