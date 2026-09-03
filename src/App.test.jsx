import { beforeEach, expect, test } from 'vitest';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('dental-note-maker.tech-name', 'Test Tech');
});

test('requires a Tech Name before opening the workspace', () => {
  window.localStorage.removeItem('dental-note-maker.tech-name');
  render(<App />);

  expect(screen.getByRole('heading', { name: /start a clinical note/i })).toBeDefined();
  fireEvent.change(screen.getByLabelText('Tech Name'), { target: { value: 'Jordan Tech' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  expect(screen.getByRole('heading', { name: 'Clinical note' })).toBeDefined();
  expect(screen.getByRole('button', { name: /jordan tech/i })).toBeDefined();
});

test('technician logoff clears the Tech Name and returns to startup', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /log off tech/i }));

  expect(screen.getByRole('heading', { name: /start a clinical note/i })).toBeDefined();
  expect(window.localStorage.getItem('dental-note-maker.tech-name')).toBeNull();
});

test('local archive entries are labeled with the active technician', () => {
  window.confirm = () => true;
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /reset content/i }));
  fireEvent.click(screen.getByRole('button', { name: /past 20 records/i }));

  expect(screen.getByText('Test Tech · Local note')).toBeDefined();
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.saved-notes'))[0].technicianName).toBe('Test Tech');
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

test('creates an O A P module with category and quick-fill preferences', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'periodontal' } });
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Problem 1' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));

  fireEvent.click(screen.getByText('Problem 1').closest('article'));
  const editor = screen.getByRole('dialog', { name: 'Problem 1' });
  fireEvent.change(editor.querySelector('#oap-observation'), { target: { value: 'Bleeding on probing.' } });
  fireEvent.change(editor.querySelector('#oap-assessment'), { target: { value: 'Localized gingivitis.' } });
  fireEvent.change(editor.querySelector('#oap-plan'), { target: { value: 'Improve home care.' } });
  fireEvent.click(screen.getByRole('button', { name: /manage quick-fill preferences/i }));
  fireEvent.click(screen.getByRole('button', { name: /add observation option/i }));
  fireEvent.change(editor.querySelector('input[aria-label="Observation option 1"]'), { target: { value: 'No bleeding.' } });
  fireEvent.click(screen.getByRole('button', { name: /save quick-fill preferences/i }));
  fireEvent.click(screen.getByRole('button', { name: /save o \/ a \/ p/i }));

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.sections.find((section) => section.id === 'periodontal').elements[0]).toMatchObject({
    category: 'periodontal',
    moduleKind: 'oap',
    observation: 'Bleeding on probing.',
    quickFillOptions: { observation: ['No bleeding.'] },
  });
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Problem 1: Observation: Bleeding on probing.\nAssessment: Localized gingivitis.');
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).not.toContain('Plan: Improve home care.');
});

test('creates and saves a color-coded blood pressure module', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'bloodPressure' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Blood pressure' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));

  fireEvent.change(screen.getByLabelText('Blood pressure systolic'), { target: { value: '185' } });
  expect(document.activeElement).toBe(screen.getByLabelText('Blood pressure diastolic'));
  fireEvent.change(screen.getByLabelText('Blood pressure diastolic'), { target: { value: '122' } });

  const bloodPressureCard = screen.getByLabelText('Blood pressure systolic').closest('article');
  expect(bloodPressureCard.classList.contains('bp-status-danger')).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Blood pressure: 185/122 mmHg');
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections[0].elements[0]).toMatchObject({
    moduleKind: 'bloodPressure',
    systolic: '185',
    diastolic: '122',
  });
});

test('creates a pain scale module and uses its internal label in output', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'painScale' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Pain score' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));

  const card = screen.getByText('Pain score').closest('article');
  fireEvent.change(screen.getByRole('slider', { name: 'Pain score pain score' }), { target: { value: '6' } });
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Pain score: 6/10');

  fireEvent.contextMenu(card);
  fireEvent.change(screen.getByLabelText('Internal label'), { target: { value: 'Pain' } });
  fireEvent.click(screen.getByRole('button', { name: /save properties/i }));

  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Pain: 6/10');
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections[0].elements[0]).toMatchObject({ moduleKind: 'painScale', painScore: 6, internalLabel: 'Pain' });
});

test('creates an allergy alert module with presets, pregnancy detail, and free text', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'alert' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Alerts' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Alerts').closest('article'));

  expect(screen.getByRole('checkbox', { name: /none \/ no known alerts/i }).checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Penicillin' }));
  expect(screen.getByRole('checkbox', { name: /none \/ no known alerts/i }).checked).toBe(false);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Pregnant' }));
  fireEvent.change(screen.getByLabelText('Pregnancy trimester'), { target: { value: 'Third trimester' } });
  fireEvent.change(screen.getByLabelText(/other alert or relevant detail/i), { target: { value: 'Needs physician consult.' } });
  fireEvent.click(screen.getByRole('button', { name: /save alerts/i }));

  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Alert: Penicillin Allergy; Pregnant (Third trimester); Needs physician consult.');
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections[0].elements[0]).toMatchObject({
    moduleKind: 'alert',
    alertAllergies: ['Penicillin'],
    alertConditions: ['Pregnant'],
    pregnancyTrimester: 'Third trimester',
    alertCustomText: 'Needs physician consult.',
    alertNone: false,
  });
});

test('treatment planning links populated OAP plans and classifies selected plan text', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'PERIO' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('PERIO').closest('article'));
  fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'Scaling and root planing' } });
  const plan = screen.getByLabelText('Plan');
  plan.setSelectionRange(0, 7);
  fireEvent.contextMenu(plan);
  fireEvent.click(screen.getByRole('button', { name: 'Class 3' }));
  fireEvent.click(screen.getByRole('button', { name: /save o \/ a \/ p/i }));

  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'treatmentPlan' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Treatment Planning' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Treatment Planning').closest('article'));

  const planner = screen.getByRole('dialog', { name: /treatment planning/i });
  expect(planner).toHaveTextContent('PERIO');
  expect(planner).toHaveTextContent('Scaling and root planing');
  expect(planner.querySelector('input[type="radio"][value="3"]')).toBeDefined();
  fireEvent.change(planner.querySelector('textarea[id^="treatment-plan-"]:not([readonly])'), { target: { value: 'Refer for periodontal therapy' } });
  fireEvent.click(planner.querySelector('button.secondary-button'));

  expect(screen.getByRole('dialog', { name: /treatment planning/i })).toBeNull();
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections.find((section) => section.id === 'periodontal').elements[0].plan).toBe('Refer for periodontal therapy');
});

test('treatment planning splits classified OAP chunks into separate class blocks', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'PERIO' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('PERIO').closest('article'));
  const plan = screen.getByLabelText('Plan');
  fireEvent.change(plan, { target: { value: 'Class 3 procedure. Class 1 follow-up.' } });
  plan.setSelectionRange(0, 20);
  fireEvent.contextMenu(plan);
  fireEvent.click(screen.getByRole('button', { name: 'Class 3' }));
  fireEvent.click(screen.getByRole('button', { name: /save o \/ a \/ p/i }));
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'treatmentPlan' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Clinical notes').closest('article'));

  const planner = screen.getByRole('dialog', { name: /treatment planning/i });
  expect(planner).toHaveTextContent('PERIO · Class 3');
  expect(planner).toHaveTextContent('PERIO · Class 2');
});

test('treatment planning exposes delete controls and grouped class output', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'treatmentPlan' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Treatment Plan' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Treatment Plan').closest('article'));

  const planner = screen.getByRole('dialog', { name: /treatment planning/i });
  expect(planner).toHaveTextContent('Class 3');
  expect(planner).toHaveTextContent('Class 2');
  expect(planner.querySelectorAll('button[aria-label^="Delete"]').length).toBeGreaterThan(0);
  fireEvent.click(planner.querySelector('button[aria-label^="Delete"]'));
  expect(screen.getByRole('dialog', { name: /treatment planning/i })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /close treatment planning/i }));
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Treatment Plan');
});

test('calculates local anesthetic totals and omits zero-use drugs', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'localAnesthetic' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Local anesthetic' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Local anesthetic').closest('article'));

  fireEvent.change(screen.getByLabelText(/2% 34mg Lidocaine carpules/i), { target: { value: '1.5' } });
  fireEvent.change(screen.getByLabelText(/4% 68mg Septocaine carpules/i), { target: { value: '0.5' } });
  fireEvent.click(screen.getByRole('button', { name: /save anesthetic/i }));

  expect(screen.getAllByText(/51mg 2%Lidocaine with 0.026 micrograms epi/).find((element) => element.tagName === 'P')).toBeDefined();
  expect(screen.getAllByText(/34mg 4%Septocaine with 0.009 micrograms epi/).find((element) => element.tagName === 'P')).toBeDefined();
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('Local anesthetic: 51mg 2%Lidocaine with 0.026 micrograms epi; 34mg 4%Septocaine with 0.009 micrograms epi; Topical anesthetic');
  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.sections[0].elements[0]).toMatchObject({ moduleKind: 'localAnesthetic', topicalAnesthetic: true, anestheticEntries: { lidocaine: '1.5', septocaine: '0.5', marcaine: 0 } });
});

test('omits the local anesthetic output prefix when internal label is blank', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'localAnesthetic' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Anesthetic details' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const card = screen.getByText('Anesthetic details').closest('article');
  fireEvent.click(card);
  fireEvent.change(screen.getByLabelText(/4% 68mg Septocaine carpules/i), { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: /save anesthetic/i }));
  fireEvent.contextMenu(card);
  fireEvent.change(screen.getByLabelText('Internal label'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: /save properties/i }));

  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).toContain('102mg 4%Septocaine with 0.026 micrograms epi');
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).not.toContain('Anesthetic details:');
});

test('saves custom blood pressure alert levels from element properties', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'bloodPressure' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Vitals BP' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const card = screen.getByText('Vitals BP').closest('article');
  fireEvent.contextMenu(card);
  const properties = screen.getByRole('dialog', { name: /element properties/i });
  fireEvent.change(screen.getByLabelText('Prehypertensive systolic maximum'), { target: { value: '139' } });
  fireEvent.change(screen.getByLabelText('Hypertensive systolic minimum'), { target: { value: '140' } });
  fireEvent.click(screen.getByRole('button', { name: /save properties/i }));

  fireEvent.change(screen.getByLabelText('Vitals BP systolic'), { target: { value: '135' } });
  fireEvent.change(screen.getByLabelText('Vitals BP diastolic'), { target: { value: '75' } });
  expect(card.classList.contains('bp-status-prehypertensive')).toBe(true);
  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.sections[0].elements[0].bloodPressureAlertLevels.hypertensiveSystolicMin).toBe(140);
  expect(screen.getByRole('textbox', { name: 'Output preview' }).value).not.toContain('prehypertensive');
});

test('reset saves the current state, clears content, and preserves preferences', () => {
  window.confirm = () => true;
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Reset test' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Reset test').closest('article'));
  fireEvent.change(screen.getByLabelText('Observation'), { target: { value: 'Entered content.' } });
  fireEvent.click(screen.getByRole('button', { name: /save o \/ a \/ p/i }));

  fireEvent.click(screen.getByRole('button', { name: /reset content/i }));

  expect(screen.getByText('No text added to this component yet.')).toBeDefined();
  expect(screen.getByRole('heading', { name: /saved states/i })).toBeDefined();
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections[0].elements[0]).toMatchObject({
    moduleKind: 'oap',
    observation: '',
    quickFillOptions: { observation: [] },
  });
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.saved-notes'))[0].note.sections[0].elements[0].observation).toBe('Entered content.');
});

test('clicking a saved state restores its content', () => {
  window.confirm = () => true;
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Restore test' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  const card = screen.getByText('Restore test').closest('article');
  fireEvent.click(card);
  fireEvent.change(screen.getByLabelText('Clinical text'), { target: { value: 'Restore this content.' } });
  fireEvent.click(screen.getByRole('button', { name: /save text/i }));
  fireEvent.click(screen.getByRole('button', { name: /reset content/i }));
  fireEvent.click(screen.getByRole('button', { name: /past 20 records/i }));
  fireEvent.click(screen.getByRole('button', { name: /saved note/i }));

  expect(screen.getByText('Restore this content.')).toBeDefined();
});

test('splits O A P fields and saves text labels in the output layout', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'periodontal' } });
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Problem 1' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Problem 1').closest('article'));
  const editor = screen.getByRole('dialog', { name: 'Problem 1' });
  fireEvent.change(editor.querySelector('#oap-observation'), { target: { value: 'Observed.' } });
  fireEvent.change(editor.querySelector('#oap-assessment'), { target: { value: 'Assessed.' } });
  fireEvent.change(editor.querySelector('#oap-plan'), { target: { value: 'Planned.' } });
  fireEvent.click(screen.getByRole('button', { name: /save o \/ a \/ p/i }));

  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  const layoutDialog = screen.getByRole('dialog', { name: /layout/i });
  expect([...layoutDialog.querySelectorAll('.layout-element-label')].map((item) => item.textContent)).toEqual(expect.arrayContaining([
    'Problem 1 - Observation',
    'Problem 1 - Assessment',
    'Problem 1 - Plan',
  ]));
  fireEvent.change(screen.getByLabelText('Text label'), { target: { value: 'Problem details' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
  fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

  const preview = screen.getByRole('textbox', { name: 'Output preview' });
  expect(preview.value).toContain('Periodontal Observation: Observed.');
  expect(preview.value).toContain('Periodontal Assessment: Assessed.');
  expect(preview.value).not.toContain('Periodontal Plan: Planned.');
  expect(preview.value.endsWith('Problem details')).toBe(true);
  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.layout).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'oap', field: 'observation', componentId: expect.any(String) }),
    expect.objectContaining({ type: 'oap', field: 'assessment', componentId: expect.any(String) }),
    expect.objectContaining({ type: 'oap', field: 'plan', componentId: expect.any(String) }),
    expect.objectContaining({ type: 'label', label: 'Problem details' }),
  ]));
});

test('Shift plus Enter saves and closes the O A P modal', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Shortcut problem' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Shortcut problem').closest('article'));

  const observation = screen.getByLabelText('Observation');
  fireEvent.change(observation, { target: { value: 'Saved from shortcut.' } });
  fireEvent.keyDown(observation, { key: 'Enter', shiftKey: true });

  expect(screen.queryByRole('dialog', { name: 'Shortcut problem' })).toBeNull();
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections[0].elements[0].observation).toBe('Saved from shortcut.');
});

test('Shift plus Enter saves and closes the O A P modal without field focus', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /add module/i }));
  fireEvent.change(screen.getByLabelText(/module type/i), { target: { value: 'oap' } });
  fireEvent.change(screen.getByLabelText(/component label/i), { target: { value: 'Unfocused problem' } });
  fireEvent.click(screen.getByRole('dialog', { name: /add text module/i }).querySelector('button[type="submit"]'));
  fireEvent.click(screen.getByText('Unfocused problem').closest('article'));

  fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'Saved without field focus.' } });
  document.activeElement?.blur();
  fireEvent.keyDown(document.body, { key: 'Enter', shiftKey: true });

  expect(screen.queryByRole('dialog', { name: 'Unfocused problem' })).toBeNull();
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).sections[0].elements[0].plan).toBe('Saved without field focus.');
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
  expect(preview.value).toBe('None.None.');
  fireEvent.change(preview, { target: { value: 'Edited output draft.' } });
  expect(preview.value).toBe('Edited output draft.');
});

test('hides elements from output preview when hidden checkbox is checked', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  const layoutDialog = screen.getByRole('dialog', { name: /layout/i });

  fireEvent.click(screen.getByLabelText('Hide Caries / Defective'));
  fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

  const savedNote = JSON.parse(window.localStorage.getItem('dental-note-maker.note'));
  expect(savedNote.layout.find((el) => el.id === 'caries')?.hidden).toBe(true);

  const preview = screen.getByRole('textbox', { name: 'Output preview' });
  // Caries is hidden, only incipientCaries shows 'None.'
  expect(preview.value).toBe('None.');
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
  expect(preview.value).toContain('None.');
  expect(preview.value).toContain('\n\n');
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).layout).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'return', count: 2 }),
    expect.objectContaining({ type: 'space', count: 3 }),
  ]));
});

test('saves and applies returns and spaces before an individual layout component', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
  const layoutDialog = screen.getByRole('dialog', { name: /layout/i });
  fireEvent.change(screen.getByLabelText('Returns before Caries / Defective'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Spaces before Caries / Defective'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /save layout/i }));

  const preview = screen.getByRole('textbox', { name: 'Output preview' });
  expect(preview.value).toContain('\n\n   None.');
  expect(JSON.parse(window.localStorage.getItem('dental-note-maker.note')).layout[0]).toMatchObject({
    id: 'caries',
    returnsBefore: 2,
    spacesBefore: 3,
  });
  expect(layoutDialog).toBeDefined();
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
