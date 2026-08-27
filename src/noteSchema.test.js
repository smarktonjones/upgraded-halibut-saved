import { expect, test } from 'vitest';
import {
  createCondition,
  createNote,
  createProblem,
  createProcedure,
  createToothReference,
  createTreatmentPlan,
  createTextComponent,
  createToothRegistry,
  CLINICAL_CATEGORIES,
  CLINICAL_CATEGORY_IDS,
  DENTAL_CLASSIFICATIONS,
  formatToothSurfaces,
  autocorrectToothEntry,
  parseToothSurfaces,
  validateNote,
} from './noteSchema';

test('creates an extensible database-first note model', () => {
  const note = createNote({ id: 'note-1' });

  expect(note.schemaVersion).toBe(1);
  expect(note.military.dentalClassification).toBe(2);
  expect(note.encounter.status).toBe('draft');
  expect(note.sections).toEqual([]);
  expect(note.teeth['tooth-1'].classification).toBe(2);
  expect(validateNote(note)).toEqual([]);
});

test('includes categories from the exam template without coupling them to UI controls', () => {
  expect(CLINICAL_CATEGORY_IDS).toContain('radiographs');
  expect(CLINICAL_CATEGORY_IDS).toContain('periodontal');
  expect(CLINICAL_CATEGORY_IDS).toContain('endodontic');
  expect(CLINICAL_CATEGORY_IDS).toContain('treatmentPlan');
  expect(CLINICAL_CATEGORIES.caries.label).toBe('Caries and defective restorations');
});

test('supports dental concepts linked to teeth and treatment plans', () => {
  const tooth = createToothReference(30, ['O', 'M']);
  const problem = createProblem({ id: 'problem-1', text: 'Sensitivity', toothRefs: [tooth.id] });
  const condition = createCondition({ id: 'condition-1', text: 'Existing restoration', toothRefs: [tooth.id] });
  const procedure = createProcedure({ id: 'procedure-1', text: 'Restore tooth', toothRefs: [tooth.id], classification: 3 });
  const plan = createTreatmentPlan({ id: 'plan-1', procedureRefs: [procedure.id], toothRefs: [tooth.id], classification: 3 });

  expect(tooth).toMatchObject({ id: 'tooth-30', number: '30', surfaces: ['O', 'M'] });
  expect(problem.toothRefs).toEqual(['tooth-30']);
  expect(condition.type).toBe('condition');
  expect(procedure.classification).toBe(3);
  expect(plan).toMatchObject({ type: 'treatmentPlan', classification: 3, procedureRefs: ['procedure-1'] });
});

test('creates labeled text components for schema categories', () => {
  const component = createTextComponent({
    id: 'assessment-summary',
    category: 'assessment',
    label: 'Assessment summary',
    text: 'Monitor sensitivity.',
  });

  expect(component).toMatchObject({
    id: 'assessment-summary',
    type: 'text',
    category: 'assessment',
    section: 'assessment',
    label: 'Assessment summary',
    text: 'Monitor sensitivity.',
    toothRefs: [],
  });
});

test('creates a complete permanent Universal tooth registry', () => {
  const teeth = createToothRegistry();

  expect(Object.keys(teeth)).toHaveLength(32);
  expect(teeth['tooth-1']).toMatchObject({ number: '1', dentition: 'permanent', status: 'present' });
  expect(teeth['tooth-32']).toMatchObject({ number: '32', dentition: 'permanent', status: 'present' });
});

test('defines the military dental classification meanings', () => {
  expect(DENTAL_CLASSIFICATIONS[1].label).toBe('Elective');
  expect(DENTAL_CLASSIFICATIONS[2].label).toBe('Routine');
  expect(DENTAL_CLASSIFICATIONS[3].label).toBe('Urgent');
  expect(DENTAL_CLASSIFICATIONS[4].label).toBe('Not examined');
});

test('normalizes flexible tooth surface syntax', () => {
  expect(parseToothSurfaces('M,O')).toEqual(['M', 'O']);
  expect(parseToothSurfaces('MO')).toEqual(['M', 'O']);
  expect(parseToothSurfaces('OM')).toEqual(['O', 'M']);
  expect(parseToothSurfaces('om')).toEqual(['O', 'M']);
  expect(parseToothSurfaces('m o')).toEqual(['M', 'O']);
  expect(parseToothSurfaces('F/B, L')).toEqual(['F/B', 'L']);
  expect(parseToothSurfaces('fb')).toEqual(['F/B']);
  expect(parseToothSurfaces('B')).toEqual(['F/B']);
  expect(parseToothSurfaces('P')).toEqual(['L']);
  expect(parseToothSurfaces('L,')).toEqual(['L']);
  expect(parseToothSurfaces('I')).toEqual(['O']);
  expect(parseToothSurfaces('MI')).toEqual(['M', 'O']);
  expect(parseToothSurfaces('MIF', 8)).toEqual(['M', 'I', 'F']);
  expect(parseToothSurfaces('MOB', 30)).toEqual(['M', 'O', 'F/B']);
});

test('formats affected surfaces as a compact parenthesized code', () => {
  expect(formatToothSurfaces(['M', 'O', 'D'])).toBe('(MOD)');
  expect(formatToothSurfaces(['D', 'M', 'O'])).toBe('(MOD)');
  expect(formatToothSurfaces(['F/B', 'L'])).toBe('(FBL)');
});

test('autocorrects shorthand tooth entries after a space', () => {
  expect(autocorrectToothEntry('3m ')).toBe('#3(M) ');
  expect(autocorrectToothEntry('3-m ')).toBe('#3(M) ');
  expect(autocorrectToothEntry('3if ')).toBe('#3(OB) ');
  expect(autocorrectToothEntry('#3(M) ')).toBe('#3(M) ');
  expect(autocorrectToothEntry('#3(M) 8d ')).toBe('#3(M), #8(D) ');
  expect(autocorrectToothEntry('#3(M), 8d ')).toBe('#3(M), #8(D) ');
});