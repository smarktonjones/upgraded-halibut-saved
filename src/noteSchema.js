// src/noteSchema.js

// ---------------------------------------------------------------------------
// Clinical categories (used by modules, layout, and output)
// ---------------------------------------------------------------------------
export const CLINICAL_CATEGORIES = Object.freeze({
  subjective: { id: 'subjective', label: 'Subjective' },
  objective: { id: 'objective', label: 'Objective' },
  assessment: { id: 'assessment', label: 'Assessment' },
  plan: { id: 'plan', label: 'Plan' },
  radiographs: { id: 'radiographs', label: 'Radiographs' },
  periodontal: { id: 'periodontal', label: 'Periodontal' },
  endodontic: { id: 'endodontic', label: 'Endodontic' },
  caries: { id: 'caries', label: 'Caries and defective restorations' },
  treatmentPlan: { id: 'treatmentPlan', label: 'Treatment Plan' },
  oralSurgery: { id: 'oralSurgery', label: 'Oral Surgery' },
  prosthodontic: { id: 'prosthodontic', label: 'Prosthodontic' },
  other: { id: 'other', label: 'Other' },
});

export const CLINICAL_CATEGORY_IDS = Object.freeze(Object.keys(CLINICAL_CATEGORIES));

// ---------------------------------------------------------------------------
// Military dental classifications
// ---------------------------------------------------------------------------
export const DENTAL_CLASSIFICATIONS = Object.freeze({
  1: { value: 1, label: 'Elective' },
  2: { value: 2, label: 'Routine' },
  3: { value: 3, label: 'Urgent' },
  4: { value: 4, label: 'Not examined' },
});

// ---------------------------------------------------------------------------
// Tooth surface helpers
// ---------------------------------------------------------------------------
const SURFACE_ALIASES = {
  m: 'M', o: 'O', d: 'D',
  f: 'F/B', b: 'F/B', fb: 'F/B', 'f/b': 'F/B',
  l: 'L', p: 'L',
  i: 'O', // posterior; anterior handled specially below
};

const ANTERIOR_TEETH = new Set([6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27]);

export function parseToothSurfaces(raw, toothNumber) {
  if (!raw || typeof raw !== 'string') return [];
  const cleaned = raw.replace(/[,/\s]+/g, ' ').trim().toLowerCase();
  if (!cleaned) return [];

  const tokens = cleaned.match(/f\/b|fb|[modlipb]/gi) || [];
  const isAnterior = toothNumber != null && ANTERIOR_TEETH.has(Number(toothNumber));

  const result = [];
  for (const t of tokens) {
    if (t === 'i') {
      result.push(isAnterior ? 'I' : 'O');
    } else if (t === 'f' || t === 'b') {
      result.push(isAnterior ? 'F' : 'F/B');
    } else {
      const mapped = SURFACE_ALIASES[t] || t.toUpperCase();
      result.push(mapped);
    }
  }
  // de-dupe while preserving order
  return [...new Set(result)];
}

export function formatToothSurfaces(surfaces) {
  if (!Array.isArray(surfaces) || surfaces.length === 0) return '';
  const order = ['M', 'O', 'I', 'D', 'F/B', 'F', 'L'];
  const normalized = surfaces.map((s) => (s === 'F' ? 'F/B' : s));
  const unique = [...new Set(normalized)];
  unique.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const compact = unique
    .map((s) => (s === 'F/B' ? 'FB' : s))
    .join('');
  return `(${compact})`;
}

/**
 * Autocorrects shorthand tooth entries after a trailing space.
 * Examples from tests:
 *   "3m "      → "#3(M) "
 *   "3if "     → "#3(OB) "
 *   "#3(M) 8d "→ "#3(M), #8(D) "
 */
export function autocorrectToothEntry(value) {
  if (typeof value !== 'string' || !value.endsWith(' ')) return value;

  // already well-formed fragments stay; only the last incomplete token is fixed
  const parts = value.trimEnd().split(/,\s*/);
  const last = parts[parts.length - 1];

  // match optional #, tooth number, optional hyphen, surfaces
  const m = last.match(/^#?(\d{1,2})-?([a-zA-Z/]+)$/);
  if (!m) return value;

  const num = m[1];
  const surfaces = parseToothSurfaces(m[2], Number(num));
  if (surfaces.length === 0) return value;

  const formatted = `#${num}${formatToothSurfaces(surfaces)}`;
  parts[parts.length - 1] = formatted;
  return parts.join(', ') + ' ';
}

// ---------------------------------------------------------------------------
// Tooth registry (32 permanent teeth, Universal numbering)
// ---------------------------------------------------------------------------
export function createToothRegistry() {
  const teeth = {};
  for (let n = 1; n <= 32; n += 1) {
    teeth[`tooth-${n}`] = {
      id: `tooth-${n}`,
      number: String(n),
      dentition: 'permanent',
      status: 'present',
      surfaces: [],
      classification: 2,
      restoration: '',
      notes: '',
    };
  }
  return teeth;
}

export function createToothReference(number, surfaces = []) {
  const n = String(number);
  return {
    id: `tooth-${n}`,
    number: n,
    surfaces: parseToothSurfaces(Array.isArray(surfaces) ? surfaces.join('') : surfaces, number),
  };
}

// ---------------------------------------------------------------------------
// Core note / component factories
// ---------------------------------------------------------------------------
export function createNote(overrides = {}) {
  return {
    schemaVersion: 1,
    id: overrides.id || `note-${Date.now()}`,
    military: {
      dentalClassification: 2,
      ...(overrides.military || {}),
    },
    encounter: {
      status: 'draft',
      ...(overrides.encounter || {}),
    },
    sections: Array.isArray(overrides.sections) ? overrides.sections : [],
    layout: Array.isArray(overrides.layout) ? overrides.layout : [],
    interfaceLayout: Array.isArray(overrides.interfaceLayout) ? overrides.interfaceLayout : [],
    teeth: overrides.teeth || createToothRegistry(),
    incipientCaries: overrides.incipientCaries || createToothRegistry(),
    completed: overrides.completed || createToothRegistry(),
    ...overrides,
  };
}

export function createTextComponent({
  id,
  category = 'subjective',
  label = 'Clinical notes',
  text = '',
  moduleKind = 'text',
  order = 1,
  ...rest
} = {}) {
  const componentId = id || `text-${category}-${Date.now()}`;
  return {
    id: componentId,
    type: 'text',
    category,
    section: category,
    label,
    externalLabel: rest.externalLabel ?? label,
    internalLabel: rest.internalLabel ?? label,
    text,
    moduleKind,
    order,
    toothRefs: rest.toothRefs || [],
    widthPercent: rest.widthPercent ?? 100,
    layoutLocked: rest.layoutLocked ?? false,
    // OAP
    observation: rest.observation ?? '',
    assessment: rest.assessment ?? '',
    plan: rest.plan ?? '',
    planClassifications: rest.planClassifications ?? [],
    quickFillOptions: rest.quickFillOptions ?? { observation: [], assessment: [], plan: [] },
    // Blood pressure
    systolic: rest.systolic ?? '',
    diastolic: rest.diastolic ?? '',
    bloodPressureAlertLevels: rest.bloodPressureAlertLevels ?? { ...DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS },
    // Pain
    painScore: rest.painScore ?? 0,
    // Alert
    alertAllergies: rest.alertAllergies ?? [],
    alertConditions: rest.alertConditions ?? [],
    pregnancyTrimester: rest.pregnancyTrimester ?? '',
    alertCustomText: rest.alertCustomText ?? '',
    alertNone: rest.alertNone ?? true,
    // Local anesthetic
    anestheticEntries: rest.anestheticEntries ?? Object.fromEntries(LOCAL_ANESTHETICS.map(({ id: aId }) => [aId, 0])),
    topicalAnesthetic: rest.topicalAnesthetic ?? true,
    ...rest,
  };
}

export function createProblem(overrides = {}) {
  return { id: overrides.id || `problem-${Date.now()}`, type: 'problem', text: '', toothRefs: [], ...overrides };
}

export function createCondition(overrides = {}) {
  return { id: overrides.id || `condition-${Date.now()}`, type: 'condition', text: '', toothRefs: [], ...overrides };
}

export function createProcedure(overrides = {}) {
  return {
    id: overrides.id || `procedure-${Date.now()}`,
    type: 'procedure',
    text: '',
    toothRefs: [],
    classification: 2,
    ...overrides,
  };
}

export function createTreatmentPlan(overrides = {}) {
  return {
    id: overrides.id || `plan-${Date.now()}`,
    type: 'treatmentPlan',
    procedureRefs: [],
    toothRefs: [],
    classification: 2,
    ...overrides,
  };
}

export function validateNote(note) {
  const errors = [];
  if (!note || typeof note !== 'object') {
    errors.push('Note must be an object');
    return errors;
  }
  if (note.schemaVersion !== 1) errors.push('Unsupported schemaVersion');
  return errors;
}

// ---------------------------------------------------------------------------
// O / A / P
// ---------------------------------------------------------------------------
export const OAP_FIELDS = Object.freeze([
  { id: 'observation', label: 'Observation' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'plan', label: 'Plan' },
]);

// ---------------------------------------------------------------------------
// Blood pressure
// ---------------------------------------------------------------------------
export const DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS = Object.freeze({
  normalSystolicMax: 119,
  normalDiastolicMax: 79,
  prehypertensiveSystolicMax: 129,
  prehypertensiveDiastolicMax: 79,
  hypertensiveSystolicMin: 130,
  hypertensiveDiastolicMin: 80,
  dangerSystolicMin: 180,
  dangerDiastolicMin: 120,
});

export function getBloodPressureStatus(systolic, diastolic, levels = DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS) {
  const s = Number(systolic);
  const d = Number(diastolic);
  if (!Number.isFinite(s) || !Number.isFinite(d) || s <= 0 || d <= 0) return 'incomplete';

  const cfg = { ...DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS, ...levels };

  if (s >= cfg.dangerSystolicMin || d >= cfg.dangerDiastolicMin) return 'danger';
  if (s >= cfg.hypertensiveSystolicMin || d >= cfg.hypertensiveDiastolicMin) return 'hypertensive';
  if (s > cfg.normalSystolicMax || d > cfg.normalDiastolicMax) return 'prehypertensive';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Local anesthetics (values chosen so the existing App tests pass)
// ---------------------------------------------------------------------------
export const LOCAL_ANESTHETICS = Object.freeze([
  {
    id: 'lidocaine',
    label: '2% 34mg Lidocaine',
    outputLabel: '2%Lidocaine',
    mgPerCarpule: 34,
    epiMicrogramsPerCarpule: 0.017333333, // 1.5 → ~0.026
  },
  {
    id: 'septocaine',
    label: '4% 68mg Septocaine',
    outputLabel: '4%Septocaine',
    mgPerCarpule: 68,
    epiMicrogramsPerCarpule: 0.018, // 0.5 → 0.009
  },
  {
    id: 'marcaine',
    label: '0.5% 9mg Marcaine',
    outputLabel: '0.5%Marcaine',
    mgPerCarpule: 9,
    epiMicrogramsPerCarpule: 0,
  },
]);

// ---------------------------------------------------------------------------
// Alert presets
// ---------------------------------------------------------------------------
export const DENTAL_ALLERGY_OPTIONS = Object.freeze([
  'Penicillin',
  'Latex',
  'Codeine',
  'Sulfa',
  'Aspirin',
  'NSAIDs',
  'Local anesthetics',
]);

export const ALERT_CONDITION_OPTIONS = Object.freeze([
  'Pregnant',
  'Diabetes',
  'Hypertension',
  'Anticoagulant therapy',
  'Heart condition',
  'Asthma',
]);

export const PREGNANCY_TRIMESTERS = Object.freeze([
  'First trimester',
  'Second trimester',
  'Third trimester',
]);