export const NOTE_SCHEMA_VERSION = 1;

export const DENTAL_CLASSIFICATIONS = Object.freeze({
  1: { code: 1, label: 'Elective', description: 'Care can be deferred without immediate concern.' },
  2: { code: 2, label: 'Routine', description: 'Care should be provided during routine scheduling.' },
  3: { code: 3, label: 'Urgent', description: 'Care requires prompt attention.' },
  4: { code: 4, label: 'Not examined', description: 'Dental readiness has not been established.' },
});

export const CLINICAL_CATEGORIES = Object.freeze({
  encounter: { id: 'encounter', label: 'Encounter' },
  communication: { id: 'communication', label: 'Communication and learning needs' },
  military: { id: 'military', label: 'Military readiness' },
  vitals: { id: 'vitals', label: 'Vitals' },
  subjective: { id: 'subjective', label: 'Subjective' },
  radiographs: { id: 'radiographs', label: 'Radiographs' },
  caries: { id: 'caries', label: 'Caries and defective restorations' },
  softTissue: { id: 'softTissue', label: 'Soft tissue and oral cancer screening' },
  periodontal: { id: 'periodontal', label: 'Periodontal' },
  endodontic: { id: 'endodontic', label: 'Endodontic' },
  tmj: { id: 'tmj', label: 'TMJ' },
  occlusion: { id: 'occlusion', label: 'Occlusion' },
  oralSurgery: { id: 'oralSurgery', label: 'Oral surgery' },
  otherFindings: { id: 'otherFindings', label: 'Other findings' },
  assessment: { id: 'assessment', label: 'Assessment and diagnosis' },
  treatmentPlan: { id: 'treatmentPlan', label: 'Treatment plan' },
  personnel: { id: 'personnel', label: 'Personnel and signatures' },
});

export const CLINICAL_CATEGORY_IDS = Object.freeze(Object.keys(CLINICAL_CATEGORIES));

export const TOOTH_SURFACES = Object.freeze(['M', 'D', 'F/B', 'L', 'O']);
export const PERMANENT_UNIVERSAL_TEETH = Object.freeze(Array.from({ length: 32 }, (_, index) => String(index + 1)));
export const DEFAULT_OUTPUT_LAYOUT = Object.freeze([
  { id: 'caries', label: 'Caries / Defective', order: 1 },
  { id: 'incipientCaries', label: 'Incipient Caries', order: 2 },
  { id: 'completed', label: 'Completed', order: 3 },
]);
export const DEFAULT_INTERFACE_LAYOUT = Object.freeze([]);

export function isAnteriorTooth(number) {
  const toothNumber = Number(number);
  return (toothNumber >= 6 && toothNumber <= 11) || (toothNumber >= 22 && toothNumber <= 27);
}

export function parseToothSurfaces(value = '', toothNumber) {
  const isAnterior = toothNumber !== undefined && isAnteriorTooth(toothNumber);
  const normalizedValue = String(value).toUpperCase().replace(/[\s,]+/g, '').replaceAll('F/B', 'FB');
  const surfaces = [];

  for (let index = 0; index < normalizedValue.length; index += 1) {
    const token = normalizedValue.slice(index, index + 2);
    if (token === 'FB') {
      surfaces.push(isAnterior ? 'F' : 'F/B');
      index += 1;
    } else if (normalizedValue[index] === 'F' || normalizedValue[index] === 'B') {
      surfaces.push(isAnterior ? 'F' : 'F/B');
    } else if (normalizedValue[index] === 'P') {
      surfaces.push('L');
    } else if (normalizedValue[index] === 'I') {
      surfaces.push(isAnterior ? 'I' : 'O');
    } else if (normalizedValue[index] === 'O') {
      surfaces.push(isAnterior ? 'I' : 'O');
    } else if (TOOTH_SURFACES.includes(normalizedValue[index])) {
      surfaces.push(normalizedValue[index]);
    }
  }

  return surfaces.filter((surface, index) => surfaces.indexOf(surface) === index);
}

export function formatToothSurfaces(surfaces = []) {
  const surfaceOrder = ['M', 'I', 'O', 'D', 'F', 'F/B', 'L'];
  return `(${[...surfaces]
    .filter((surface, index) => surfaces.indexOf(surface) === index)
    .sort((left, right) => surfaceOrder.indexOf(left) - surfaceOrder.indexOf(right))
    .map((surface) => surface.replace('/', ''))
    .join('')})`;
}

export function autocorrectToothEntry(value) {
  const input = String(value);
  return input.replace(/(^|,\s*|\s)(#?)(\d{1,2})-?([A-Za-z/]+)(\s)$/g, (match, prefix, hash, number, surfaceText, trailingSpace, offset) => {
    const surfaces = parseToothSurfaces(surfaceText, number);
    if (!surfaces.length) return match;
    const displaySurfaces = formatToothSurfaces(surfaces).replace('FB', 'B').replace('I', 'O');
    const precedingText = input.slice(0, offset);
    const separator = prefix.trim() || !/#\d{1,2}\([^)]*\)\s*$/.test(precedingText) ? prefix : ', ';
    return `${separator}#${number}${displaySurfaces}${trailingSpace}`;
  });
}

export function createToothReference(number, surfaces = []) {
  return {
    id: `tooth-${number}`,
    numberingSystem: 'universal',
    number: String(number),
    surfaces: surfaces.filter((surface) => TOOTH_SURFACES.includes(surface)),
    classification: 2,
    restoration: '',
    notes: '',
  };
}

export function createToothRegistry(numbers = PERMANENT_UNIVERSAL_TEETH) {
  return numbers.reduce((registry, number) => {
    const tooth = createToothReference(number);
    registry[tooth.id] = { ...tooth, dentition: 'permanent', status: 'present' };
    return registry;
  }, {});
}

export function createElement({ id, type = 'text', text = '', order = 1, toothRefs = [], ...fields } = {}) {
  return {
    id: id || `${type}-${Date.now()}`,
    type,
    order,
    text,
    toothRefs,
    // External label shown in the main UI, internal label used in output preview
    externalLabel: fields.externalLabel ?? fields.label ?? '',
    internalLabel: fields.internalLabel ?? fields.label ?? '',
    // Width percent used by the UI to size text modules horizontally
    widthPercent: fields.widthPercent ?? 100,
    ...fields,
  };
}

export function createTextComponent({ id, category = 'otherFindings', label = 'Clinical notes', text = '', order = 1, section = category } = {}) {
  return createElement({
    id: id || `text-${category}-${Date.now()}`,
    type: 'text',
    category,
    label,
    externalLabel: label,
    internalLabel: label,
    widthPercent: 100,
    text,
    section,
    order,
    layoutLocked: false,
  });
}

export function createSection({ id, title, order, elements = [] }) {
  return { id, title, order, elements };
}

export function createProblem(fields = {}) {
  return createElement({
    type: 'problem',
    category: 'general',
    status: 'active',
    classification: 2,
    ...fields,
  });
}

export function createCondition(fields = {}) {
  return createElement({
    type: 'condition',
    category: 'general',
    status: 'active',
    ...fields,
  });
}

export function createProcedure(fields = {}) {
  return createElement({
    type: 'procedure',
    category: 'operative',
    status: 'planned',
    classification: 2,
    ...fields,
  });
}

export function createTreatmentPlan(fields = {}) {
  return {
    id: fields.id || `treatment-plan-${Date.now()}`,
    type: 'treatmentPlan',
    category: 'treatmentPlan',
    title: fields.title || 'Treatment plan',
    status: fields.status || 'proposed',
    classification: fields.classification || 2,
    procedureRefs: fields.procedureRefs || [],
    toothRefs: fields.toothRefs || [],
    order: fields.order || 1,
  };
}

export function createNote(fields = {}) {
  return {
    id: fields.id || `note-${Date.now()}`,
    schemaVersion: NOTE_SCHEMA_VERSION,
    status: fields.status || 'draft',
    numberingSystem: fields.numberingSystem || 'universal',
    encounter: fields.encounter || {
      type: null,
      form: null,
      status: 'draft',
    },
    communication: fields.communication || {
      language: null,
      learningType: null,
      impairments: [],
      culturalConsiderations: null,
    },
    military: fields.military || {
      flightStatus: 'N/A',
      dentalClassification: 2,
    },
    vitals: fields.vitals || {
      bloodPressure: null,
    },
    createdAt: fields.createdAt || null,
    updatedAt: fields.updatedAt || null,
    teeth: fields.teeth || createToothRegistry(),
    incipientCaries: fields.incipientCaries || createToothRegistry(),
    completed: fields.completed || createToothRegistry(),
    layout: fields.layout || DEFAULT_OUTPUT_LAYOUT.map((element) => ({ ...element })),
    interfaceLayout: fields.interfaceLayout || [...DEFAULT_INTERFACE_LAYOUT],
    riskAssessments: fields.riskAssessments || [],
    treatmentPlans: fields.treatmentPlans || [],
    personnel: fields.personnel || {},
    sections: fields.sections || [],
  };
}

export function getAllElements(note) {
  return note.sections.flatMap((section) => section.elements);
}

export function validateNote(note) {
  const errors = [];
  if (!note || typeof note !== 'object') return ['Note must be an object.'];
  if (!note.id) errors.push('Note requires an id.');
  if (note.schemaVersion !== NOTE_SCHEMA_VERSION) errors.push(`Note schemaVersion must be ${NOTE_SCHEMA_VERSION}.`);
  if (!Array.isArray(note.sections)) errors.push('Note requires sections.');
  if (!note.teeth || typeof note.teeth !== 'object' || Array.isArray(note.teeth)) errors.push('Note requires a teeth map.');
  if (!note.military || !DENTAL_CLASSIFICATIONS[note.military.dentalClassification]) errors.push('Note requires a valid dental classification.');

  getAllElements(note).forEach((element) => {
    if (!element.id) errors.push('Every element requires an id.');
    if (!element.type) errors.push(`Element ${element.id || 'without an id'} requires a type.`);
    if (!Array.isArray(element.toothRefs)) errors.push(`Element ${element.id} requires toothRefs.`);
    if (element.category !== undefined && typeof element.category !== 'string') errors.push(`Element ${element.id} category must be a string.`);
  });

  return errors;
}
