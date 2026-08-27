import { beforeEach, expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
});

test('opens the text editor and saves text into the note', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'History' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const article = screen.getByText('History').closest('article');
  fireEvent.click(article);
  fireEvent.change(document.querySelector('#note-text'), { target: { value: 'Patient reports sensitivity.' } });
  fireEvent.click(screen.getByRole('button', { name: /save text/i }));

  expect(screen.getByText('Patient reports sensitivity.')).toBeDefined();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('creates a labeled category text module in layout and output', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'assessment' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Assessment summary' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));

  expect(screen.getByText('Assessment summary')).toBeDefined();
  const assessmentArticle = screen.getByText('Assessment summary').closest('article');
  fireEvent.click(assessmentArticle);
  const textEditor = screen.getByRole('dialog', { name: /edit text/i });
  fireEvent.change(textEditor.querySelector('#note-text'), { target: { value: 'Monitor sensitivity.' } });
  fireEvent.click(textEditor.querySelector('button.primary-button'));

  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  expect([...screen.getByRole('dialog', { name: /layout/i }).querySelectorAll('.layout-element-label')].map((element) => element.textContent)).toContain('Assessment summary');
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  const output = screen.getByRole('textbox', { name: 'Output preview' });
  expect(output.value).toContain('Assessment summary: Monitor sensitivity.');
  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.sections.find((section) => section.id === 'assessment').elements[0]).toMatchObject({
    category: 'assessment',
    label: 'Assessment summary',
    text: 'Monitor sensitivity.',
  });
});

test('orders chart output elements through the layout modal and preview', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));

  const layoutDialog = screen.getByRole('dialog', { name: /layout/i });
  const layoutElements = layoutDialog.querySelectorAll('.layout-element');
  fireEvent.dragStart(layoutElements[2]);
  fireEvent.dragOver(layoutElements[0]);
  fireEvent.drop(layoutElements[0]);
  fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.layout).toEqual([
    { id: 'completed', label: 'Completed', order: 1 },
    { id: 'caries', label: 'Caries / Defective', order: 2 },
    { id: 'incipientCaries', label: 'Incipient Caries', order: 3 },
  ]);
  const preview = screen.getByRole('textbox', { name: 'Output preview' });
  expect(preview.value.indexOf('Completed')).toBeLessThan(preview.value.indexOf('Caries / Defective'));
  expect(preview.value.indexOf('Caries / Defective')).toBeLessThan(preview.value.indexOf('Incipient Caries'));
  fireEvent.change(preview, { target: { value: 'Edited output draft.' } });
  expect(preview.value).toBe('Edited output draft.');
});

test('adds configurable returns and spaces to the output layout', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  const layoutDialog = screen.getByRole('dialog', { name: /layout/i });

  fireEvent.change(screen.getByLabelText('Returns'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add return' }));
  fireEvent.change(screen.getByLabelText('Spaces'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add spaces' }));

  const formattingElements = layoutDialog.querySelectorAll('.layout-element');
  fireEvent.dragStart(formattingElements[4]);
  fireEvent.dragOver(formattingElements[0]);
  fireEvent.drop(formattingElements[0]);
  fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

  const preview = screen.getByRole('textbox', { name: 'Output preview' });
  expect(preview.value.startsWith('   ')).toBe(true);
  expect(preview.value).toContain('Caries / Defective: None.');
  expect(preview.value).toContain('Incipient Caries: None.');
  expect(preview.value).toContain('\n\n');
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).layout).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'return', count: 2 }),
    expect.objectContaining({ type: 'space', count: 3 }),
  ]));
});

test('keeps the default layout as no spacing until formatting is added manually', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  fireEvent.change(screen.getByLabelText('Returns'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add return' }));
  fireEvent.change(screen.getByLabelText('Spaces'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add spaces' }));
  fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

  const preview = screen.getByRole('textbox', { name: 'Output preview' });
  expect(preview.value).not.toMatch(/\n\n|^\s{2,}/);
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).layout).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'return', count: 0 }),
    expect.objectContaining({ type: 'space', count: 0 }),
  ]));
});

test('starts without a default subjective editor and allows deleting modules', () => {
  render(<App />);

  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections).toEqual([]);
  expect(screen.queryByText(/subjective/i)).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Assessment summary' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));

  const moduleCard = screen.getByText('Assessment summary').closest('article');
  fireEvent.contextMenu(moduleCard);
  fireEvent.click(screen.getByRole('button', { name: /delete module/i }));
  // confirm deletion
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));

  expect(screen.queryByText('Assessment summary')).toBeNull();
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections).toEqual([]);
});

test('Shift plus Enter saves and closes the text modal', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'History' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
    const article = screen.getByText('History').closest('article');
    fireEvent.click(article);
  fireEvent.change(document.querySelector('#note-text'), { target: { value: 'Saved with shortcut.' } });
  fireEvent.keyDown(document.querySelector('#note-text'), { key: 'Enter', shiftKey: true });

  expect(screen.getByText('Saved with shortcut.')).toBeDefined();
  expect(screen.queryByRole('dialog', { name: /edit text/i })).toBeNull();
});

test('cancel discards draft text', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Draft check' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const draftArticle = screen.getByText('Draft check').closest('article');
  fireEvent.click(draftArticle);
  fireEvent.change(document.querySelector('#note-text'), { target: { value: 'Discard this draft.' } });
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.queryByText('Discard this draft.')).toBeNull();
  expect(screen.getByText('Draft check')).toBeDefined();
});

test('right-click opens properties and saves structured note fields', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'History' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.contextMenu(screen.getByText('History').closest('article'));

  expect(screen.getByRole('dialog', { name: /element properties/i })).toBeDefined();
  fireEvent.change(screen.getByLabelText(/element id/i), { target: { value: 'subjective-history' } });
  fireEvent.change(screen.getByLabelText(/section/i), { target: { value: 'assessment' } });
  fireEvent.change(screen.getByLabelText(/display order/i), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /save properties/i }));

  const noteElement = screen.getByText('History').closest('article');
  expect(noteElement.dataset.noteId).toBe('subjective-history');
  expect(noteElement.dataset.noteSection).toBe('assessment');
  expect(noteElement.dataset.noteOrder).toBe('3');
});

test('saves snippet preferences as JSON and uses the new snippet', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'History' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const historyArticle = screen.getByText('History').closest('article');
  fireEvent.click(historyArticle);
  fireEvent.click(screen.getByRole('button', { name: /manage snippet preferences/i }));
  fireEvent.change(screen.getByLabelText(/snippet 1 name/i), { target: { value: 'Sensitivity' } });
  fireEvent.change(screen.getByLabelText(/snippet 1 text/i), { target: { value: 'Patient reports sensitivity.' } });
  fireEvent.click(screen.getByRole('button', { name: /save snippet preferences/i }));

  const savedPreferences = JSON.parse(window.localStorage.getItem('dental-note-maker.snippet-preferences'));
  expect(savedPreferences[0].label).toBe('Sensitivity');
  expect(screen.getByRole('option', { name: 'Sensitivity' })).toBeDefined();
});

test('selects teeth and surfaces from the tooth chart', () => {
  render(<App />);
  const toothThirty = screen.getByRole('button', { name: 'Tooth 30' });

  expect(toothThirty.title).toBe('Tooth 30 - class 2');
  fireEvent.mouseEnter(toothThirty);
  fireEvent.click(toothThirty);

  expect(toothThirty.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('dialog', { name: /edit tooth 30/i })).toBeDefined();
  fireEvent.change(screen.getByLabelText(/affected surfaces/i), { target: { value: 'M, O' } });
  fireEvent.change(screen.getByLabelText(/dental class/i), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/tooth notes/i), { target: { value: 'Monitor distal restoration.' } });
  fireEvent.click(screen.getByRole('button', { name: /save tooth/i }));

  expect(toothThirty.title).toBe('Tooth 30 - class 3 (MO)');
  expect(toothThirty.querySelector('.tooth-class-marker')?.textContent).toBe('3');
  expect(toothThirty.querySelector('.tooth-surface-m').classList.contains('is-affected')).toBe(true);
  expect(toothThirty.querySelector('.tooth-surface-o').classList.contains('is-affected')).toBe(true);

  const toothTwenty = screen.getByRole('button', { name: 'Tooth 20' });
  fireEvent.click(toothTwenty);
  expect(toothThirty.getAttribute('aria-pressed')).toBe('false');
  expect(toothTwenty.getAttribute('aria-pressed')).toBe('true');
});

test('charts incipient caries independently with green surfaces and class 2', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /incipient caries/i }));

  const toothThirty = screen.getByRole('button', { name: 'Tooth 30' });
  fireEvent.click(toothThirty);
  expect(screen.queryByLabelText(/dental class/i)).toBeNull();
  fireEvent.change(screen.getByLabelText(/affected surfaces/i), { target: { value: 'M, O' } });
  fireEvent.change(screen.getByLabelText(/tooth notes/i), { target: { value: 'Watch early lesion.' } });
  fireEvent.click(screen.getByRole('button', { name: /save tooth/i }));

  expect(toothThirty.title).toBe('Incipient caries: Tooth 30 - class 2 (MO)');
  expect(toothThirty.querySelector('.tooth-surface-m').classList.contains('is-affected')).toBe(true);
  expect(toothThirty.closest('.tooth-chart').classList.contains('is-incipient')).toBe(true);
  expect(document.getElementById('tooth-summary-output').value).toBe('#30(MO) Watch early lesion.');

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.teeth['tooth-30'].surfaces).toEqual([]);
  expect(savedNote.incipientCaries['tooth-30']).toMatchObject({ surfaces: ['M', 'O'], classification: 2, notes: 'Watch early lesion.' });
});

test('charts completed restorations with blue surfaces and material text', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: 'Completed' }));

  const toothNineteen = screen.getByRole('button', { name: 'Tooth 19' });
  fireEvent.click(toothNineteen);
  expect(screen.queryByLabelText(/dental class/i)).toBeNull();
  fireEvent.change(screen.getByLabelText(/affected surfaces/i), { target: { value: 'M, O' } });
  fireEvent.change(screen.getByLabelText(/restoration/i), { target: { value: 'composite' } });
  fireEvent.change(screen.getByLabelText(/tooth notes/i), { target: { value: 'Completed today.' } });
  fireEvent.click(screen.getByRole('button', { name: /save tooth/i }));

  expect(toothNineteen.title).toBe('Completed: Tooth 19 (MO) composite');
  expect(toothNineteen.closest('.tooth-chart').classList.contains('is-completed')).toBe(true);
  expect(document.getElementById('tooth-summary-output').value).toBe('#19(MO) composite Completed today.');

  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#19(D) amalgam' } });
  fireEvent.blur(output);
  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.completed['tooth-19']).toMatchObject({ surfaces: ['D'], restoration: 'amalgam', notes: '' });
  expect(savedNote.teeth['tooth-19'].surfaces).toEqual([]);
});

test('persists tooth surfaces and caries status in the local note cache', () => {
  const firstRender = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Tooth 12' }));
  fireEvent.change(screen.getByLabelText(/affected surfaces/i), { target: { value: 'F/B, L' } });
  fireEvent.change(screen.getByLabelText(/dental class/i), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/tooth notes/i), { target: { value: 'Monitor distal restoration.' } });
  fireEvent.click(screen.getByRole('button', { name: /save tooth/i }));
  firstRender.unmount();

  render(<App />);
  const restoredTooth = screen.getByRole('button', { name: 'Tooth 12' });
  expect(restoredTooth.title).toBe('Tooth 12 - class 3 (FBL)');
  expect(restoredTooth.querySelector('.tooth-surface-fb').classList.contains('is-affected')).toBe(true);
  expect(restoredTooth.querySelector('.tooth-surface-l').classList.contains('is-affected')).toBe(true);
});

test('reset content clears text modules and tooth registries', async () => {
  render(<App />);
  // add a text module and enter text
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'History' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const article = screen.getByText('History').closest('article');
  fireEvent.click(article);
  fireEvent.change(document.querySelector('#note-text'), { target: { value: 'Patient reports sensitivity.' } });
  fireEvent.click(screen.getByRole('button', { name: /save text/i }));

  // add a tooth finding
  fireEvent.click(screen.getByRole('button', { name: 'Tooth 30' }));
  fireEvent.change(screen.getByLabelText(/affected surfaces/i), { target: { value: 'M, O' } });
  fireEvent.change(screen.getByLabelText(/tooth notes/i), { target: { value: 'Watch early lesion.' } });
  fireEvent.click(screen.getByRole('button', { name: /save tooth/i }));

  // verify saved
  const savedBefore = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedBefore.sections.find((s) => s.elements.some((e) => e.text === 'Patient reports sensitivity.'))).toBeDefined();
  expect(savedBefore.teeth['tooth-30'].surfaces.length).toBeGreaterThan(0);

  // mock confirm to accept
  const originalConfirm = window.confirm;
  window.confirm = () => true;

  // click reset button
  fireEvent.click(screen.getByRole('button', { name: /reset content/i }));

  window.confirm = originalConfirm;

  const savedAfter = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  // text cleared
  expect(savedAfter.sections.every((section) => section.elements.every((el) => el.type !== 'text' || el.text === ''))).toBe(true);
  // teeth reset
  expect(savedAfter.teeth['tooth-30'].surfaces).toEqual([]);
});

test('export and import JSON preserve layout and element preferences', async () => {
  render(<App />);

  const preferences = {
    schemaVersion: 1,
    snippets: [],
    note: {
      layout: [{ id: 'caries', label: 'Caries / Defective', order: 1 }],
      interfaceLayout: ['text-assessment-1'],
      sections: [{ id: 'assessment', title: 'Assessment', order: 1, elements: [{ id: 'text-assessment-1', type: 'text', category: 'assessment', label: 'Assessment summary', externalLabel: 'Assessment ext', internalLabel: 'Assessment int', text: 'Monitor sensitivity.', order: 1, widthPercent: 50 }] }],
    },
  };

  // import via file input
  const file = new File([JSON.stringify(preferences)], 'prefs.json', { type: 'application/json' });
  const input = document.querySelector('.file-button input');
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => {
    const saved = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
    expect(saved.sections.find((s) => s.id === 'assessment')).toBeDefined();
  });

  // mock URL.createObjectURL to capture blob
  const originalCreate = window.URL.createObjectURL;
  window.__lastExportBlob = null;
  window.URL.createObjectURL = (blob) => { window.__lastExportBlob = blob; return 'blob:mock'; };

  fireEvent.click(screen.getByRole('button', { name: /export json/i }));

  // read blob text
  await waitFor(() => expect(window.__lastExportBlob).toBeTruthy());
  // blob.text may not exist in some environments; fall back to FileReader
  let exportedText;
  if (window.__lastExportBlob && typeof window.__lastExportBlob.text === 'function') {
    exportedText = await window.__lastExportBlob.text();
  } else {
    exportedText = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(window.__lastExportBlob);
    });
  }
  const exported = JSON.parse(exportedText);
  expect(exported.note).toBeDefined();
  expect(exported.note.sections.find((s) => s.id === 'assessment')).toBeDefined();

  window.URL.createObjectURL = originalCreate;
});

test('shows saved tooth findings in the generated output', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Tooth 3' }));
  fireEvent.change(screen.getByLabelText(/affected surfaces/i), { target: { value: 'MOD' } });
  fireEvent.change(screen.getByLabelText(/tooth notes/i), { target: { value: 'composite fx' } });
  fireEvent.click(screen.getByRole('button', { name: /save tooth/i }));

  expect(document.getElementById('tooth-summary-output').value).toBe('#3(MOD) composite fx');
});

test('edits output back into anterior tooth storage and handles invalid entries', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#8(MIF) cavitation, #99(MOD) invalid' } });
  fireEvent.blur(output);

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.teeth['tooth-8'].surfaces).toEqual(['M', 'I', 'F']);
  expect(savedNote.teeth['tooth-8'].notes).toBe('cavitation');
  expect(screen.getByRole('status').textContent).toMatch(/could not parse/i);
});

test('autocorrects shorthand while typing in the main findings entry', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '3if ' } });

  expect(output.value).toBe('#3(OB) ');
});

test('autocorrects incipient caries entries with commas between teeth', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /incipient caries/i }));
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '3m ' } });
  expect(output.value).toBe('#3(M) ');
  fireEvent.change(output, { target: { value: '#3(M) 8d ' } });

  expect(output.value).toBe('#3(M), #8(D) ');
});

test('right-clicking a tooth output entry opens a class editor', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#3(MOD) composite fx' } });
  fireEvent.blur(output);
  output.setSelectionRange(2, 2);
  fireEvent.contextMenu(output, { clientX: 120, clientY: 120 });

  expect(screen.getByRole('dialog', { name: /class for tooth 3/i })).toBeDefined();
  fireEvent.change(screen.getByLabelText(/^dental class$/i), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /save class/i }));

  expect(screen.getByRole('button', { name: 'Tooth 3' }).querySelector('.tooth-class-marker')?.textContent).toBe('3');
  expect(document.querySelector('.tooth-summary-highlight').textContent).toMatch(/#3\(MOD\) composite fx/);
  expect(document.querySelector('.tooth-summary-highlight .is-urgent')).toBeDefined();
});

test('right-clicking note text still opens the tooth class editor', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#8(MIF) cavitation' } });
  fireEvent.blur(output);
  output.setSelectionRange(output.value.length, output.value.length);
  fireEvent.contextMenu(output, { clientX: 120, clientY: 120 });

  expect(screen.getByRole('dialog', { name: /class for tooth 8/i })).toBeDefined();
});

test('suppresses the browser context menu on tooth findings output', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  output.dispatchEvent(contextMenuEvent);

  expect(contextMenuEvent.defaultPrevented).toBe(true);
});

test('opens class editor from context-menu capture before focus changes', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#3(MOD) composite fx' } });
  output.setSelectionRange(15, 15);
  fireEvent.contextMenu(output, { clientX: 100, clientY: 100 });

  expect(screen.getByRole('dialog', { name: /class for tooth 3/i })).toBeDefined();
});

test('opens the centered class dialog from the right mouse button before contextmenu', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#3(MOD) composite fx' } });
  output.setSelectionRange(2, 2);
  fireEvent.mouseDown(output, { button: 2, clientX: 100, clientY: 100 });

  expect(screen.getByRole('dialog', { name: /class for tooth 3/i })).toBeDefined();
});

test('suppresses the browser context menu throughout the app shell', () => {
  render(<App />);
  const appShell = document.querySelector('.app-shell');
  const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  appShell.dispatchEvent(contextMenuEvent);

  expect(contextMenuEvent.defaultPrevented).toBe(true);
});

test('deleting a tooth entry clears that tooth data', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#3(MOD) composite fx, #8(MIF) cavitation' } });
  fireEvent.blur(output);
  fireEvent.change(output, { target: { value: '#8(MIF) cavitation' } });
  fireEvent.blur(output);

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.teeth['tooth-3'].surfaces).toEqual([]);
  expect(savedNote.teeth['tooth-3'].notes).toBe('');
  expect(savedNote.teeth['tooth-8'].notes).toBe('cavitation');
});

test('deleting all findings clears every tooth finding', () => {
  render(<App />);
  const output = document.getElementById('tooth-summary-output');
  fireEvent.change(output, { target: { value: '#3(MOD) composite fx' } });
  fireEvent.blur(output);
  fireEvent.change(output, { target: { value: '' } });
  fireEvent.blur(output);

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(Object.values(savedNote.teeth).every((tooth) => tooth.surfaces.length === 0 && tooth.notes === '' && tooth.classification === 2)).toBe(true);
});
