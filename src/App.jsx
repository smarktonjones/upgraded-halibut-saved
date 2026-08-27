import { useEffect, useRef, useState } from 'react';
import './App.css';
import { autocorrectToothEntry, CLINICAL_CATEGORIES, createNote, createTextComponent, formatToothSurfaces, parseToothSurfaces, createToothRegistry } from './noteSchema';

// Default reusable phrases shown in the text editor until preferences are changed.
const defaultSnippets = [
  {
    id: 'normal-exam',
    label: 'Normal exam',
    text: 'Extraoral and intraoral examination reveals no significant findings.',
  },
  {
    id: 'oral-hygiene',
    label: 'Oral hygiene instruction',
    text: 'Oral hygiene instructions reviewed, including brushing and interdental cleaning.',
  },
  {
    id: 'follow-up',
    label: 'Follow-up',
    text: 'Patient will return for follow-up as discussed.',
  },
];

const snippetsStorageKey = 'dental-note-maker.snippet-preferences';
const noteStorageKey = 'dental-note-maker.note';

// Preferences and the database-shaped note are restored from the browser cache.
function loadSnippets() {
  try {
    const savedSnippets = window.localStorage.getItem(snippetsStorageKey);
    return savedSnippets ? JSON.parse(savedSnippets) : defaultSnippets;
  } catch {
    return defaultSnippets;
  }
}

function loadNote() {
  try {
    const savedNote = window.localStorage.getItem(noteStorageKey);
    return savedNote ? createNote(JSON.parse(savedNote)) : createNote({ id: 'note-prototype-1' });
  } catch {
    return createNote({ id: 'note-prototype-1' });
  }
}

// Text editing, snippet insertion, and snippet preference management.
function TextEditorModal({ initialText, snippets, onCancel, onSave, onSaveSnippets }) {
  const [draftText, setDraftText] = useState(initialText);
  const [selectedSnippetId, setSelectedSnippetId] = useState(snippets[0]?.id ?? '');
  const [isManagingSnippets, setIsManagingSnippets] = useState(false);
  const [draftSnippets, setDraftSnippets] = useState(snippets);
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const selectedSnippet = snippets.find(({ id }) => id === selectedSnippetId);

  function insertSnippet(replaceSelection) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draftText.length;
    const end = replaceSelection
      ? textarea?.selectionEnd ?? start
      : start;
    if (!selectedSnippet) return;
    const nextText = `${draftText.slice(0, start)}${selectedSnippet.text}${draftText.slice(end)}`;

    setDraftText(nextText);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const cursorPosition = start + selectedSnippet.text.length;
      textareaRef.current?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  function updateSnippet(index, property, value) {
    setDraftSnippets((currentSnippets) => currentSnippets.map((snippet, snippetIndex) => (
      snippetIndex === index ? { ...snippet, [property]: value } : snippet
    )));
  }

  function addSnippet() {
    const id = `snippet-${Date.now()}`;
    setDraftSnippets((currentSnippets) => [...currentSnippets, { id, label: 'New snippet', text: '' }]);
    setSelectedSnippetId(id);
  }

  function removeSnippet(index) {
    setDraftSnippets((currentSnippets) => currentSnippets.filter((_, snippetIndex) => snippetIndex !== index));
  }

  function saveSnippetPreferences() {
    const validSnippets = draftSnippets.filter(({ label, text }) => label.trim() && text.trim());
    onSaveSnippets(validSnippets);
    setIsManagingSnippets(false);
    setSelectedSnippetId(validSnippets[0]?.id ?? '');
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      onSave(draftText);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onKeyDown={handleKeyDown} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Note component</p>
            <h2 id="editor-title">Edit text</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close editor">×</button>
        </header>

        <div className="modal-body">
          <label className="field-label" htmlFor="note-text">Clinical text</label>
          <textarea
            ref={textareaRef}
            id="note-text"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            rows={8}
            spellCheck="true"
            placeholder="Enter the text for this note component..."
          />

          <div className="snippet-panel">
            <div>
              <p className="field-label">Snippets</p>
              <p className="field-help">Insert a reusable phrase at the cursor or replace selected text.</p>
            </div>
            <div className="snippet-controls">
              <select
                aria-label="Choose a snippet"
                value={selectedSnippetId}
                onChange={(event) => setSelectedSnippetId(event.target.value)}
              >
                {snippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.label}</option>)}
              </select>
              <button type="button" className="secondary-button" onClick={() => insertSnippet(false)}>Add</button>
              <button type="button" className="secondary-button" onClick={() => insertSnippet(true)}>Replace</button>
            </div>
            <button type="button" className="manage-snippets-button" onClick={() => setIsManagingSnippets((isManaging) => !isManaging)}>
              {isManagingSnippets ? 'Hide snippet preferences' : 'Manage snippet preferences'}
            </button>
            {isManagingSnippets && (
              <div className="snippet-preferences">
                {draftSnippets.map((snippet, index) => (
                  <div className="snippet-preference" key={snippet.id}>
                    <input aria-label={`Snippet ${index + 1} name`} value={snippet.label} onChange={(event) => updateSnippet(index, 'label', event.target.value)} />
                    <input aria-label={`Snippet ${index + 1} text`} value={snippet.text} onChange={(event) => updateSnippet(index, 'text', event.target.value)} />
                    <button type="button" className="icon-button" onClick={() => removeSnippet(index)} aria-label={`Remove ${snippet.label || `snippet ${index + 1}`}`}>×</button>
                  </div>
                ))}
                <div className="snippet-preference-actions">
                  <button type="button" className="secondary-button" onClick={addSnippet}>Add snippet</button>
                  <button type="button" className="secondary-button" onClick={saveSnippetPreferences}>Save snippet preferences</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="modal-footer">
          <span className="keyboard-hint">Shift + Enter to save</span>
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => onSave(draftText)}>Save text</button>
        </footer>
      </section>
    </div>
  );
}

function TextModuleModal({ onCancel, onCreate }) {
  const [category, setCategory] = useState('otherFindings');
  const [label, setLabel] = useState('Clinical notes');

  function handleSubmit(event) {
    event.preventDefault();
    if (label.trim()) onCreate({ category, label: label.trim() });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="text-module-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Schema component</p>
            <h2 id="text-module-title">Add text module</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close text module">×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="field-label" htmlFor="text-module-category">Category</label>
            <select id="text-module-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {Object.values(CLINICAL_CATEGORIES).map(({ id, label: categoryLabel }) => (
                <option key={id} value={id}>{categoryLabel}</option>
              ))}
            </select>
            <label className="field-label module-label-field" htmlFor="text-module-label">Component label</label>
            <input id="text-module-label" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
            <p className="field-help module-help">The label appears on the note, in Layout, and in the generated output.</p>
          </div>
          <footer className="modal-footer">
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Add module</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// Generic metadata editor for a note element, opened from its context menu.
function PropertiesModal({ note, onCancel, onSave, onDelete }) {
  const [draftNote, setDraftNote] = useState(note);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    document.getElementById('note-id')?.focus();
  }, []);

  function updateProperty(property, value) {
    setDraftNote((currentNote) => ({ ...currentNote, [property]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ ...draftNote, order: Number(draftNote.order) || 1 });
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      onSave({ ...draftNote, order: Number(draftNote.order) || 1 });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onKeyDown={handleKeyDown} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="editor-modal properties-modal" role="dialog" aria-modal="true" aria-labelledby="properties-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Database fields</p>
            <h2 id="properties-title">Element properties</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close properties">×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="property-grid">
              <div className="property-field property-field-wide">
                <label className="field-label" htmlFor="note-id">Element ID</label>
                <input id="note-id" value={draftNote.id} onChange={(event) => updateProperty('id', event.target.value)} />
              </div>
              {draftNote.type === 'text' && <>
                <div className="property-field">
                  <label className="field-label" htmlFor="note-label">Label</label>
                  <input id="note-label" value={draftNote.label || ''} onChange={(event) => updateProperty('label', event.target.value)} />
                </div>
                <div className="property-field">
                  <label className="field-label" htmlFor="note-external-label">External label</label>
                  <input id="note-external-label" value={draftNote.externalLabel || ''} onChange={(event) => updateProperty('externalLabel', event.target.value)} />
                </div>
                <div className="property-field">
                  <label className="field-label" htmlFor="note-internal-label">Internal label</label>
                  <input id="note-internal-label" value={draftNote.internalLabel || ''} onChange={(event) => updateProperty('internalLabel', event.target.value)} />
                </div>
                  <div className="property-field">
                    <label className="field-label" htmlFor="note-width-percent">Width (%)</label>
                    <input id="note-width-percent" type="number" min="10" max="100" step="1" value={draftNote.widthPercent ?? 100} onChange={(event) => updateProperty('widthPercent', Number(event.target.value) || 100)} />
                  </div>
                <div className="property-field">
                  <label className="field-label" htmlFor="note-category">Category</label>
                  <select id="note-category" value={draftNote.category || 'otherFindings'} onChange={(event) => setDraftNote((currentNote) => ({ ...currentNote, category: event.target.value, section: event.target.value }))}>
                    {Object.values(CLINICAL_CATEGORIES).map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </div>
              </>}
              <div className="property-field">
                <label className="field-label" htmlFor="note-type">Type</label>
                <select id="note-type" value={draftNote.type} onChange={(event) => updateProperty('type', event.target.value)}>
                  <option value="text">Text</option>
                  <option value="finding">Finding</option>
                  <option value="procedure">Procedure</option>
                </select>
              </div>
              <div className="property-field">
                <label className="field-label" htmlFor="note-order">Display order</label>
                <input id="note-order" type="number" min="1" value={draftNote.order} onChange={(event) => updateProperty('order', event.target.value)} />
              </div>
              <div className="property-field property-field-wide">
                <label className="field-label" htmlFor="note-section">Section</label>
                <select id="note-section" value={draftNote.section} onChange={(event) => updateProperty('section', event.target.value)}>
                  <option value="subjective">Subjective</option>
                  <option value="objective">Objective</option>
                  <option value="assessment">Assessment</option>
                  <option value="plan">Plan</option>
                </select>
              </div>
            </div>
            <p className="field-help properties-help">These fields are saved on the schema element and control where it appears in the note.</p>
          </div>

          <footer className="modal-footer">
            {onDelete && !confirmDelete && (
              <button type="button" className="secondary-button danger-button" onClick={() => setConfirmDelete(true)}>Delete module</button>
            )}
            {onDelete && confirmDelete && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#8a1f1f', fontWeight: 700 }}>Confirm delete?</span>
                <button type="button" className="secondary-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button type="button" className="primary-button" onClick={() => { onDelete(); setConfirmDelete(false); }}>Delete</button>
              </div>
            )}
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Save properties</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// Tooth chart view. Each tab has an independent persisted tooth registry.
function ToothChart({ teeth, findingType, selectedToothId, onToggleTooth, onSaveToothDetails }) {
  const upperTeeth = Array.from({ length: 16 }, (_, index) => String(index + 1));
  const lowerTeeth = Array.from({ length: 16 }, (_, index) => String(32 - index));
  const [editingTooth, setEditingTooth] = useState(null);
  const [surfaceInput, setSurfaceInput] = useState('');
  const [toothNotes, setToothNotes] = useState('');
  const [toothClassification, setToothClassification] = useState(2);
  const [toothRestoration, setToothRestoration] = useState('');
  const surfaceInputRef = useRef(null);
  const isIncipient = findingType === 'incipientCaries';
  const isCompleted = findingType === 'completed';

  useEffect(() => {
    if (!editingTooth) return undefined;
    function closeWhenClickedOutside(event) {
      if (!event.target.closest('.tooth-detail-popover') && !event.target.closest('.tooth-button')) {
        setEditingTooth(null);
      }
    }
    document.addEventListener('mousedown', closeWhenClickedOutside);
    return () => document.removeEventListener('mousedown', closeWhenClickedOutside);
  }, [editingTooth]);

  function openToothDetails(toothId, event) {
    onToggleTooth(toothId);
    const tooth = teeth[toothId];
    const bounds = event.currentTarget.getBoundingClientRect();
    setEditingTooth({ ...tooth, anchor: { top: bounds.top, right: bounds.right } });
    setSurfaceInput(formatToothSurfaces(tooth.surfaces));
    setToothNotes(tooth.notes || '');
    setToothClassification(isIncipient ? 2 : tooth.classification || 2);
    setToothRestoration(tooth.restoration || '');
  }

  useEffect(() => {
    if (editingTooth) {
      surfaceInputRef.current?.focus();
      surfaceInputRef.current?.select();
    }
  }, [editingTooth]);

  function saveToothDetails(event) {
    event.preventDefault();
    const surfaces = parseToothSurfaces(surfaceInput, editingTooth.number);
    onSaveToothDetails(editingTooth.id, surfaces, isIncipient || isCompleted ? 2 : toothClassification, toothNotes, isCompleted ? toothRestoration : '');
    setEditingTooth(null);
  }

  function handlePopoverKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      const surfaces = parseToothSurfaces(surfaceInput, editingTooth.number);
      onSaveToothDetails(editingTooth.id, surfaces, isIncipient || isCompleted ? 2 : toothClassification, toothNotes, isCompleted ? toothRestoration : '');
      setEditingTooth(null);
    }
  }

  function renderTooth(number) {
    const toothId = `tooth-${number}`;
    const tooth = teeth[toothId];
    const isSelected = selectedToothId === toothId;
    const isUpper = Number(number) <= 16;
    const isRightSide = Number(number) <= 8 || Number(number) >= 25;
    return (
      <button
        className={`tooth-button ${isSelected ? 'is-selected' : ''}`}
        key={toothId}
        type="button"
        aria-label={`Tooth ${number}`}
        aria-pressed={isSelected}
        title={`${isIncipient ? 'Incipient caries: ' : isCompleted ? 'Completed: ' : ''}Tooth ${number}${!isCompleted ? ` - class ${tooth.classification}` : ''}${tooth.surfaces.length ? ` ${formatToothSurfaces(tooth.surfaces)}` : ''}${tooth.restoration ? ` ${tooth.restoration}` : ''}`}
        onClick={(event) => openToothDetails(toothId, event)}
      >
        <span className={`tooth-crown ${isUpper ? 'is-upper' : 'is-lower'} ${isRightSide ? 'is-right-side' : 'is-left-side'}`} aria-hidden="true">
          {!isIncipient && tooth.classification === 3 && <span className="tooth-class-marker">3</span>}
          <span className={`tooth-surface tooth-surface-m ${tooth.surfaces.includes('M') ? 'is-affected' : ''}`} />
          <span className={`tooth-surface tooth-surface-d ${tooth.surfaces.includes('D') ? 'is-affected' : ''}`} />
          <span className={`tooth-surface tooth-surface-fb ${tooth.surfaces.includes('F/B') || tooth.surfaces.includes('F') ? 'is-affected' : ''}`} />
          <span className={`tooth-surface tooth-surface-l ${tooth.surfaces.includes('L') ? 'is-affected' : ''}`} />
          <span className={`tooth-surface tooth-surface-o ${tooth.surfaces.includes('O') || tooth.surfaces.includes('I') ? 'is-affected' : ''}`} />
        </span>
        <span className="tooth-number">{number}</span>
      </button>
    );
  }

  return (
    <section className={`tooth-chart ${isIncipient ? 'is-incipient' : ''} ${isCompleted ? 'is-completed' : ''}`} aria-labelledby="tooth-chart-title">
      <div className="chart-heading">
        <div>
          <p className="section-kicker">Dental map</p>
          <h2 id="tooth-chart-title">Tooth chart</h2>
        </div>
        <span className="chart-selection-count">{selectedToothId ? '1 selected' : 'None selected'}</span>
      </div>
      <p className="field-help">Universal numbering. Select surfaces to record {isIncipient ? 'incipient caries' : isCompleted ? 'completed restorations' : 'caries or defective restorations'}.</p>
      <div className="dentition-row" aria-label="Upper teeth">{upperTeeth.map(renderTooth)}</div>
      <div className="chart-midline" aria-hidden="true" />
      <div className="dentition-row" aria-label="Lower teeth">{lowerTeeth.map(renderTooth)}</div>
      {editingTooth && (
        <div
          className="tooth-detail-popover"
          role="dialog"
          aria-label={`Edit tooth ${editingTooth.number}`}
          style={{ top: editingTooth.anchor.top, left: editingTooth.anchor.right + 12 }}
        >
          <form onSubmit={saveToothDetails} onKeyDown={handlePopoverKeyDown}>
            <div>
              <p className="field-label">Tooth {editingTooth.number}</p>
              <p className="field-help">Enter affected surfaces using M, D, F/B, L, and O.</p>
            </div>
            <label className="field-label" htmlFor="affected-surfaces">Affected surfaces</label>
            <input ref={surfaceInputRef} id="affected-surfaces" value={surfaceInput} onChange={(event) => setSurfaceInput(event.target.value)} placeholder="M,O" />
            {isCompleted && (
              <>
                <label className="field-label" htmlFor="tooth-restoration">Restoration</label>
                <select id="tooth-restoration" value={toothRestoration} onChange={(event) => setToothRestoration(event.target.value)}>
                  <option value="">Select material</option>
                  <option value="composite">Composite</option>
                  <option value="amalgam">Amalgam</option>
                </select>
              </>
            )}
            {!isIncipient && !isCompleted && (
              <>
                <label className="field-label" htmlFor="tooth-classification">Dental class</label>
                <select id="tooth-classification" value={toothClassification} onChange={(event) => setToothClassification(Number(event.target.value))}>
                  <option value="1">1 - Elective</option>
                  <option value="2">2 - Routine</option>
                  <option value="3">3 - Urgent</option>
                  <option value="4">4 - Not examined</option>
                </select>
              </>
            )}
            <label className="field-label" htmlFor="tooth-notes">Tooth notes</label>
            <textarea id="tooth-notes" rows="3" value={toothNotes} onChange={(event) => setToothNotes(event.target.value)} placeholder="Add notes about this tooth..." />
            <div className="tooth-detail-actions">
              <button type="button" className="secondary-button" onClick={() => setEditingTooth(null)}>Cancel</button>
              <button type="submit" className="primary-button">Save tooth</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

// Produces the readable tooth-entry string from the canonical tooth registry.
function formatToothSummary(teeth) {
  return Object.values(teeth)
    .sort((left, right) => Number(left.number) - Number(right.number))
    .map((tooth) => {
      if (!tooth.surfaces.length && !tooth.notes?.trim() && !tooth.restoration) return null;
      const surfaces = tooth.surfaces.length ? formatToothSurfaces(tooth.surfaces) : '';
      return `#${tooth.number}${surfaces}${tooth.restoration ? ` ${tooth.restoration}` : ''}${tooth.notes?.trim() ? ` ${tooth.notes.trim()}` : ''}`;
    })
    .filter(Boolean)
    .join(', ');
}

// Editable tooth output. It synchronizes shorthand text back into individual teeth.
function ToothSummary({ teeth, findingType, onUpdateTeeth }) {
  const [draftSummary, setDraftSummary] = useState(() => formatToothSummary(teeth));
  const [parseMessage, setParseMessage] = useState('');
  const [classEditor, setClassEditor] = useState(null);
  const [classValue, setClassValue] = useState(2);
  const outputRef = useRef(null);
  const lastCaretPositionRef = useRef(0);
  const isIncipient = findingType === 'incipientCaries';
  const isCompleted = findingType === 'completed';

  useEffect(() => {
    setDraftSummary(formatToothSummary(teeth));
  }, [teeth]);

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.style.height = 'auto';
    outputRef.current.style.height = `${outputRef.current.scrollHeight}px`;
  }, [draftSummary]);

  function saveSummary() {
    const entries = draftSummary.split(/,\s*(?=#)/).map((entry) => entry.trim()).filter(Boolean);
    const updates = {};
    const invalidEntries = [];
    const parsedToothIds = new Set();

    entries.forEach((entry) => {
      const match = entry.match(/^#?(\d{1,2})\s*(?:\(([^)]*)\))?\s*(.*)$/);
      const toothNumber = match?.[1];
      const tooth = toothNumber ? teeth[`tooth-${toothNumber}`] : null;
      if (!match || !tooth) {
        invalidEntries.push(entry);
        return;
      }
      parsedToothIds.add(tooth.id);
      const detailText = match[3].trim();
      const restorationMatch = isCompleted ? detailText.match(/^(composite|amalgam)\b\s*/i) : null;
      updates[tooth.id] = {
        surfaces: parseToothSurfaces(match[2] || '', tooth.number),
        notes: restorationMatch ? detailText.slice(restorationMatch[0].length).trim() : detailText,
        ...(isCompleted ? { restoration: restorationMatch?.[1].toLowerCase() || '' } : {}),
        ...(isIncipient ? { classification: 2 } : {}),
      };
    });

    if (invalidEntries.length) {
      setParseMessage(`Could not parse: ${invalidEntries.join(', ')}. Valid entries were saved.`);
    } else {
      setParseMessage('Saved to the note.');
    }
    if (!invalidEntries.length) {
      Object.values(teeth).forEach((tooth) => {
        if (!parsedToothIds.has(tooth.id)) {
          updates[tooth.id] = {
            surfaces: [],
            ...(isCompleted ? { restoration: '' } : {}),
            notes: '',
            classification: 2,
          };
        }
      });
    }
    if (Object.keys(updates).length) onUpdateTeeth(updates);
  }

  function handleSummaryChange(event) {
    const nextValue = event.target.value;
    setDraftSummary(nextValue.endsWith(' ') ? autocorrectToothEntry(nextValue) : nextValue);
  }

  function openClassEditorForTooth(tooth, event) {
    if (!tooth) return;
    event.preventDefault();
    setClassValue(tooth.classification || 2);
    setClassEditor({ tooth, top: event.clientY, left: event.clientX });
  }

  function openClassEditor(event) {
    event.preventDefault();
    const cursorPosition = event.currentTarget.selectionStart ?? lastCaretPositionRef.current;
    lastCaretPositionRef.current = cursorPosition;
    const currentValue = event.currentTarget.value || draftSummary;
    const entries = [...currentValue.matchAll(/#\d{1,2}(?:\([^)]*\))?[^,]*(?=,|$)/g)];
    const entry = entries.find((match) => cursorPosition >= match.index && cursorPosition <= match.index + match[0].length)
      || entries.reduce((closest, match) => (
        Math.abs(match.index - cursorPosition) < Math.abs(closest.index - cursorPosition) ? match : closest
      ), entries[0]);
    if (!entry) return;
    const toothNumber = entry[0].match(/^#?(\d{1,2})/)?.[1];
    const tooth = toothNumber ? teeth[`tooth-${toothNumber}`] : null;
    openClassEditorForTooth(tooth, event);
  }

  function handleSummaryMouseDown(event) {
    if (event.button !== 2) return;
    event.preventDefault();
    openClassEditor(event);
  }

  function saveClass(event) {
    event.preventDefault();
    onUpdateTeeth({ [classEditor.tooth.id]: { classification: Number(classValue) } });
    setClassEditor(null);
  }

  function renderSummaryHighlight() {
    return draftSummary.split(/(,\s*)/).map((part, index) => {
      const match = part.match(/^#?(\d{1,2})\s*(\([^)]*\))?/);
      const tooth = match ? teeth[`tooth-${match[1]}`] : null;
      if (!tooth || !match[0]) return <span key={`${part}-${index}`}>{part}</span>;
      return (
        <span key={`${part}-${index}`}>
          <span className={tooth.classification === 3 ? 'is-urgent' : isIncipient ? 'is-incipient' : isCompleted ? 'is-completed' : ''}>{match[0]}</span>
          {part.slice(match[0].length)}
        </span>
      );
    });
  }

  return (
    <section className="tooth-summary" aria-labelledby="tooth-summary-title">
      <label className="field-label" htmlFor="tooth-summary-output" id="tooth-summary-title">{isIncipient ? 'Incipient caries output' : isCompleted ? 'Completed output' : 'Caries / defective output'}</label>
      <div className="tooth-summary-editor">
        <div className="tooth-summary-highlight" aria-hidden="true">{renderSummaryHighlight()}</div>
        <textarea ref={outputRef} id="tooth-summary-output" rows={1} value={draftSummary} onChange={handleSummaryChange} onSelect={(event) => { lastCaretPositionRef.current = event.currentTarget.selectionStart; }} onBlur={saveSummary} onMouseDown={handleSummaryMouseDown} onContextMenuCapture={(event) => event.preventDefault()} onContextMenu={openClassEditor} placeholder="Type entries such as #3(MOD) composite fx..." />
      </div>
      <p className="field-help summary-message" role="status">{parseMessage || `Type ${isIncipient ? 'incipient caries' : isCompleted ? 'completed restoration' : 'finding'} entries separated by commas; changes save when you leave this field.`}</p>
      {!isIncipient && !isCompleted && classEditor && (
        <div className="class-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClassEditor(null); }}>
          <div className="class-editor-modal" role="dialog" aria-label={`Edit class for tooth ${classEditor.tooth.number}`}>
            <form onSubmit={saveClass}>
              <p className="eyebrow">Tooth {classEditor.tooth.number}</p>
              <label className="field-label" htmlFor="summary-tooth-class">Dental class</label>
              <select id="summary-tooth-class" value={classValue} onChange={(event) => setClassValue(event.target.value)} autoFocus>
                <option value="1">1 - Elective</option>
                <option value="2">2 - Routine</option>
                <option value="3">3 - Urgent</option>
                <option value="4">4 - Not examined</option>
              </select>
              <div className="tooth-detail-actions">
                <button type="button" className="secondary-button" onClick={() => setClassEditor(null)}>Cancel</button>
                <button type="submit" className="primary-button">Save class</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function LayoutModal({ layout, note, onCancel, onSave }) {
  const [draftLayout, setDraftLayout] = useState(() => [...layout].sort((left, right) => left.order - right.order));
  const [draggedId, setDraggedId] = useState(null);
  const [returnCount, setReturnCount] = useState(0);
  const [spaceCount, setSpaceCount] = useState(0);

  function moveElement(droppedId) {
    if (!draggedId || draggedId === droppedId) return;
    setDraftLayout((currentLayout) => {
      const nextLayout = [...currentLayout];
      const draggedIndex = nextLayout.findIndex((element) => element.id === draggedId);
      const droppedIndex = nextLayout.findIndex((element) => element.id === droppedId);
      const [draggedElement] = nextLayout.splice(draggedIndex, 1);
      nextLayout.splice(droppedIndex, 0, draggedElement);
      return nextLayout;
    });
    setDraggedId(null);
  }

  function saveLayout() {
    onSave(draftLayout.map((element, index) => ({ ...element, order: index + 1 })));
  }

  function addFormattingElement(type, count) {
    const safeCount = Math.max(0, Number(count) || 0);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const label = type === 'return' ? `Return x${safeCount}` : `Space x${safeCount}`;
    setDraftLayout((currentLayout) => [...currentLayout, { id, type, count: safeCount, label, order: currentLayout.length + 1 }]);
  }

  function updateFormattingElement(id, count) {
    const safeCount = Math.max(0, Number(count) || 0);
    setDraftLayout((currentLayout) => currentLayout.map((element) => (
      element.id === id
        ? { ...element, count: safeCount, label: `${element.type === 'return' ? 'Return' : 'Space'} x${safeCount}` }
        : element
    )));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="editor-modal layout-modal" role="dialog" aria-modal="true" aria-labelledby="layout-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Output module</p>
            <h2 id="layout-title">Layout</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close layout">×</button>
        </header>
        <div className="modal-body">
          <p className="field-help">Drag the elements into the order you want them to appear in the output.</p>
          <div className="layout-formatting-controls" aria-label="Add formatting elements">
            <div className="layout-formatting-control">
              <label className="field-label" htmlFor="return-count">Returns</label>
              <input id="return-count" type="number" min="0" value={returnCount} onChange={(event) => setReturnCount(event.target.value)} />
              <button type="button" className="secondary-button" onClick={() => addFormattingElement('return', returnCount)}>Add return</button>
            </div>
            <div className="layout-formatting-control">
              <label className="field-label" htmlFor="space-count">Spaces</label>
              <input id="space-count" type="number" min="0" value={spaceCount} onChange={(event) => setSpaceCount(event.target.value)} />
              <button type="button" className="secondary-button" onClick={() => addFormattingElement('space', spaceCount)}>Add spaces</button>
            </div>
          </div>
          <div className="layout-list" aria-label="Output layout elements">
            {draftLayout.map((element, index) => {
              const componentsMap = Object.fromEntries(note.sections.flatMap((section) => section.elements).map((el) => [el.id, el]));
              const external = componentsMap[element.id]?.externalLabel ?? element.externalLabel ?? element.label;
              return (
              <div
                className="layout-element"
                key={element.id}
                draggable
                onDragStart={() => setDraggedId(element.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveElement(element.id)}
              >
                <span className="layout-element-order">{index + 1}</span>
                {element.type === 'return' || element.type === 'space' ? (
                  <label className="layout-element-label">
                    {element.type === 'return' ? 'Returns' : 'Spaces'}
                    <input aria-label={`${element.type} count`} type="number" min="0" value={element.count ?? 0} onChange={(event) => updateFormattingElement(element.id, event.target.value)} onClick={(event) => event.stopPropagation()} />
                  </label>
                ) : <span className="layout-element-label">{external}</span>}
                {element.type === 'return' || element.type === 'space' ? <button type="button" className="icon-button layout-remove-button" onClick={() => setDraftLayout((currentLayout) => currentLayout.filter((item) => item.id !== element.id))} aria-label={`Remove ${element.type}`}>×</button> : null}
                <span className="layout-element-handle" aria-hidden="true">↕</span>
              </div>
            );
            })}
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={saveLayout}>Save layout</button>
        </footer>
      </section>
    </div>
  );
}

function ModuleCard({ component, isArrangeMode, onDragStart, onDrop, onToggleLock, onEdit, onProperties }) {
  return (
      <article
      className={`text-element ${component.text ? '' : 'is-empty'} ${isArrangeMode ? 'is-arrangeable' : ''} ${component.layoutLocked ? 'is-locked' : ''}`}
        style={{ flex: `0 0 ${component.widthPercent ?? 100}%` }}
      data-note-id={component.id}
      data-note-type={component.type}
      data-note-category={component.category}
      data-note-section={component.section}
      data-note-order={component.order}
      draggable={isArrangeMode && !component.layoutLocked}
      onDragStart={() => onDragStart(component.id)}
      onDragOver={(event) => { if (isArrangeMode) event.preventDefault(); }}
      onDrop={() => onDrop(component.id)}
      onContextMenu={(event) => { event.preventDefault(); onProperties(component.id); }}
      onClick={() => { if (!isArrangeMode) onEdit(component.id); }}
    >
      {isArrangeMode && <button type="button" className="module-lock-button" onClick={() => onToggleLock(component.id)} aria-label={`${component.layoutLocked ? 'Unlock' : 'Lock'} ${component.externalLabel || component.label}`} title={component.layoutLocked ? 'Unlock module' : 'Lock module'}>{component.layoutLocked ? 'Locked' : 'Lock'}</button>}
      <div className="element-label">{component.externalLabel || component.label}</div>
      <p>{component.text || 'No text added to this component yet.'}</p>
      {/* Clicking the article opens the editor; no separate edit button needed */}
    </article>
  );
}

function OutputPreview({ layout, note, onReset, onCopy }) {
  const [draftOutput, setDraftOutput] = useState('');
  const summaries = {
    caries: formatToothSummary(note.teeth),
    incipientCaries: formatToothSummary(note.incipientCaries),
    completed: formatToothSummary(note.completed),
  };
  const textComponents = Object.fromEntries(
    note.sections.flatMap((section) => section.elements)
      .filter((element) => element.type === 'text')
      .map((element) => [element.id, element]),
  );
  const orderedLayout = [...layout].sort((left, right) => left.order - right.order);
  const generatedOutput = orderedLayout
    .map((element) => {
      if (element.type === 'return') return '\n'.repeat(Math.max(0, Number(element.count) || 0));
      if (element.type === 'space') return ' '.repeat(Math.max(0, Number(element.count) || 0));
      const textComponent = textComponents[element.id];
      const internalLabel = element.internalLabel ?? textComponent?.internalLabel ?? element.label;

      // Charting components: show as "InternalLabel: summary" with default 'None.' and no extra returns
      if (element.id === 'caries' || element.id === 'incipientCaries') {
        const summary = summaries[element.id] || '';
        return `${internalLabel}: ${summary.trim() || 'None.'}`;
      }

      // Completed: only include if there is content (either summary or text entered)
      if (element.id === 'completed') {
        const summary = summaries[element.id] || '';
        const text = textComponent?.text?.trim() || '';
        if (!summary.trim() && !text) return '';
        const content = text || summary || 'None.';
        return `${internalLabel}: ${content}`;
      }

      // Default behavior for labeled modules: internal label, then content on same line, no returns
      const content = textComponent ? (textComponent.text || 'No text added.') : (summaries[element.id] || 'No findings recorded.');
      return `${internalLabel}: ${content}`;
    })
    .join('');

  useEffect(() => {
    setDraftOutput(generatedOutput);
  }, [generatedOutput]);

  return (
    <section className="output-preview" aria-labelledby="output-preview-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Output module</p>
          <h2 id="output-preview-title">Output preview</h2>
        </div>
      </div>
      <div className="output-preview-content">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <textarea
            aria-label="Output preview"
            value={draftOutput}
            onChange={(event) => setDraftOutput(event.target.value)}
            rows={Math.max(6, orderedLayout.length * 3)}
            onKeyDown={(event) => { if (event.shiftKey && event.key === 'Enter') { event.preventDefault(); onCopy?.(); } }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="copy-button" onClick={() => onCopy?.()} aria-label="Copy output">Copy</button>
          </div>
        </div>
        <button type="button" className="reset-button" onClick={() => { if (window.confirm('Reset content? This will clear textbox entries and tooth findings.')) onReset?.(); }} aria-label="Reset content">Reset content</button>
      </div>
    </section>
  );
}

// Top-level application state and persistence boundary for the prototype.
function App() {
  const [note, setNote] = useState(loadNote);
  const [toastMessage, setToastMessage] = useState(null);
  const [editingPropertiesComponentId, setEditingPropertiesComponentId] = useState(null);
  const [snippets, setSnippets] = useState(loadSnippets);
  const [selectedToothId, setSelectedToothId] = useState(null);
  const [findingType, setFindingType] = useState('caries');
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [isTextModuleOpen, setIsTextModuleOpen] = useState(false);
  const [isArrangeMode, setIsArrangeMode] = useState(false);
  const [draggedModuleId, setDraggedModuleId] = useState(null);
  const [editingComponentId, setEditingComponentId] = useState(null);
  const textComponents = note.sections.flatMap((section) => section.elements)
    .filter((element) => element.type === 'text')
    .sort((left, right) => left.order - right.order);
  const findingStorageKey = findingType === 'incipientCaries' ? 'incipientCaries' : findingType === 'completed' ? 'completed' : 'teeth';
  const teeth = note[findingStorageKey];

  useEffect(() => {
    window.localStorage.setItem(snippetsStorageKey, JSON.stringify(snippets));
  }, [snippets]);

  useEffect(() => {
    window.localStorage.setItem(noteStorageKey, JSON.stringify(note));
  }, [note]);

  // Global copy to clipboard handler and toast
  function copyToClipboard() {
    const textarea = document.querySelector('textarea[aria-label="Output preview"]');
    const text = textarea ? textarea.value : '';
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setToastMessage('Output copied to clipboard');
        setTimeout(() => setToastMessage(null), 1800);
      }).catch(() => {
        const t = document.createElement('textarea');
        t.value = text;
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
        setToastMessage('Output copied to clipboard');
        setTimeout(() => setToastMessage(null), 1800);
      });
    } else {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
      setToastMessage('Output copied to clipboard');
      setTimeout(() => setToastMessage(null), 1800);
    }
  }

  // Global Shift+Enter copy except when a modal is open
  useEffect(() => {
    function handler(event) {
      if (event.shiftKey && event.key === 'Enter') {
        // if any modal-backdrop exists, do not copy
        if (document.querySelector('.modal-backdrop')) return;
        event.preventDefault();
        copyToClipboard();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [note]);

  // Exports user-editable snippet preferences for backup or future Firestore import.
  function exportPreferences() {
    const preferences = {
      schemaVersion: 1,
      snippets,
      note: { layout: note.layout, interfaceLayout: note.interfaceLayout, sections: note.sections },
    };
    const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'dental-note-maker-preferences.json';
    try {
      link.click();
    } catch {
      // some environments (jsdom) don't implement navigation for blob: URLs
    }
    URL.revokeObjectURL(downloadUrl);
  }

  function importPreferences(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const preferences = JSON.parse(reader.result);
        if (Array.isArray(preferences.snippets)) setSnippets(preferences.snippets);
        if (preferences.note) setNote((currentNote) => createNote({ ...currentNote, ...preferences.note }));
      } catch {
        // Invalid files do not replace the active note.
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function updateTextComponent(componentId, updater) {
    setNote((currentNote) => ({
      ...currentNote,
      sections: currentNote.sections.map((section) => ({
        ...section,
        elements: section.elements.map((element) => (
          element.id === componentId ? updater(element) : element
        )),
      })),
    }));
  }

  function updateModuleOrder(droppedId) {
    if (!draggedModuleId || draggedModuleId === droppedId) return;
    setNote((currentNote) => {
      const ids = currentNote.interfaceLayout.filter((id) => id !== draggedModuleId);
      const targetIndex = ids.indexOf(droppedId);
      ids.splice(targetIndex < 0 ? ids.length : targetIndex, 0, draggedModuleId);
      return { ...currentNote, interfaceLayout: ids };
    });
    setDraggedModuleId(null);
  }

  function deleteModule(moduleId) {
    setNote((currentNote) => {
      const nextSections = currentNote.sections.map((section) => ({
        ...section,
        elements: section.elements.filter((element) => element.id !== moduleId),
      })).filter((section) => section.elements.length > 0);
      const nextLayout = currentNote.layout.filter((item) => item.id !== moduleId);
      return {
        ...currentNote,
        sections: nextSections,
        interfaceLayout: currentNote.interfaceLayout.filter((id) => id !== moduleId),
        layout: nextLayout,
      };
    });
    setEditingPropertiesComponentId(null);
  }

  function resetContent() {
    setNote((currentNote) => {
      const clearedSections = currentNote.sections.map((section) => ({
        ...section,
        elements: section.elements.map((element) => ({ ...element, text: element.type === 'text' ? '' : element.text })),
      }));
      return {
        ...currentNote,
        sections: clearedSections,
        teeth: createToothRegistry(),
        incipientCaries: createToothRegistry(),
        completed: createToothRegistry(),
      };
    });
  }

  function updateElementById(elementId, updatedElement) {
    setNote((currentNote) => {
      const nextSections = currentNote.sections.map((section) => ({ ...section, elements: section.elements.filter((element) => element.id !== elementId) }));
      const targetSectionId = updatedElement.section || updatedElement.category || 'subjective';
      const sectionIndex = nextSections.findIndex((section) => section.id === targetSectionId);
      const requestedOrder = Number(updatedElement.order) || 1;
      const nextElement = {
        ...updatedElement,
        section: targetSectionId,
        order: requestedOrder,
      };
      if (sectionIndex >= 0) nextSections[sectionIndex] = {
        ...nextSections[sectionIndex],
        elements: [...nextSections[sectionIndex].elements, nextElement].sort((left, right) => left.order - right.order),
      };
      else nextSections.push({ id: targetSectionId, title: CLINICAL_CATEGORIES[targetSectionId]?.label || targetSectionId, order: nextSections.length + 1, elements: [nextElement] });
      return {
        ...currentNote,
        sections: nextSections,
        interfaceLayout: currentNote.interfaceLayout.map((id) => id === elementId ? nextElement.id : id),
        layout: currentNote.layout.map((item) => item.id === elementId ? { ...item, id: nextElement.id, label: nextElement.label || item.label } : item),
      };
    });
  }

  function addTextModule({ category, label }) {
    const component = createTextComponent({ category, label });
    setNote((currentNote) => {
      const sectionIndex = currentNote.sections.findIndex((section) => section.id === category);
      const nextSections = [...currentNote.sections];
      const nextElement = { ...component, order: sectionIndex >= 0 ? nextSections[sectionIndex].elements.length + 1 : 1 };
      if (sectionIndex >= 0) {
        nextSections[sectionIndex] = {
          ...nextSections[sectionIndex],
          elements: [...nextSections[sectionIndex].elements, nextElement],
        };
      } else {
        nextSections.push({ id: category, title: CLINICAL_CATEGORIES[category].label, order: nextSections.length + 1, elements: [nextElement] });
      }
      return {
        ...currentNote,
        sections: nextSections,
            layout: [...currentNote.layout, { id: component.id, label: component.label, order: currentNote.layout.length + 1 }],
            interfaceLayout: [...currentNote.interfaceLayout, component.id],
      };
    });
    setIsTextModuleOpen(false);
  }

  function toggleTooth(toothId) {
    setSelectedToothId((currentId) => (currentId === toothId ? null : toothId));
  }

  function saveToothDetails(toothId, surfaces, classification, notes, restoration) {
    setNote((currentNote) => ({
      ...currentNote,
      [findingStorageKey]: {
        ...currentNote[findingStorageKey],
        [toothId]: {
          ...currentNote[findingStorageKey][toothId],
          surfaces,
          status: 'present',
          classification,
          restoration,
          notes,
        },
      },
    }));
  }

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setEditingPropertiesComponentId(null);
        setIsLayoutOpen(false);
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <main className="app-shell" onContextMenuCapture={(event) => event.preventDefault()}>
      <header className="app-header">
        <div>
          <p className="eyebrow">DentalNoteMaker / prototype</p>
          <h1>Clinical note</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={exportPreferences}>Export JSON</button>
          <label className="secondary-button file-button">Import JSON<input type="file" accept="application/json" onChange={importPreferences} /></label>
          <button type="button" className="secondary-button" onClick={() => setIsLayoutOpen(true)}>Layout</button>
          <button type="button" className={`secondary-button ${isArrangeMode ? 'is-active' : ''}`} onClick={() => setIsArrangeMode((current) => !current)}>{isArrangeMode ? 'Lock layout' : 'Arrange modules'}</button>
          <button type="button" className="primary-button" onClick={() => setIsTextModuleOpen(true)}>+ Add module</button>
          <span className="status-pill">Draft</span>
        </div>
      </header>

      <div className="finding-tabs" role="tablist" aria-label="Dental findings">
        <button type="button" role="tab" aria-selected={findingType === 'caries'} className={findingType === 'caries' ? 'is-active' : ''} onClick={() => { setFindingType('caries'); setSelectedToothId(null); }}>Caries / Defective</button>
        <button type="button" role="tab" aria-selected={findingType === 'incipientCaries'} className={findingType === 'incipientCaries' ? 'is-active' : ''} onClick={() => { setFindingType('incipientCaries'); setSelectedToothId(null); }}>Incipient Caries</button>
        <button type="button" role="tab" aria-selected={findingType === 'completed'} className={findingType === 'completed' ? 'is-active' : ''} onClick={() => { setFindingType('completed'); setSelectedToothId(null); }}>Completed</button>
      </div>
      <ToothChart
        teeth={teeth}
        findingType={findingType}
        selectedToothId={selectedToothId}
        onToggleTooth={toggleTooth}
        onSaveToothDetails={saveToothDetails}
      />
      <ToothSummary
        teeth={teeth}
        findingType={findingType}
        onUpdateTeeth={(updates) => setNote((currentNote) => ({
          ...currentNote,
          [findingStorageKey]: Object.entries(updates).reduce((nextTeeth, [toothId, update]) => ({
            ...nextTeeth,
            [toothId]: { ...nextTeeth[toothId], ...update },
          }), currentNote[findingStorageKey]),
        }))}
      />

      {textComponents.length > 0 && (
        <section className="note-section text-modules-section">
          {/* Removed per-section add button; top-level '+ Add module' remains in header */}
          {[...textComponents].sort((left, right) => {
            const leftIndex = note.interfaceLayout.indexOf(left.id);
            const rightIndex = note.interfaceLayout.indexOf(right.id);
            return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
          }).map((component) => (
            <ModuleCard key={component.id} component={component} isArrangeMode={isArrangeMode} onDragStart={setDraggedModuleId} onDrop={updateModuleOrder} onToggleLock={(id) => updateTextComponent(id, (item) => ({ ...item, layoutLocked: !item.layoutLocked }))} onEdit={setEditingComponentId} onProperties={setEditingPropertiesComponentId} />
          ))}
        </section>
      )}

      <OutputPreview layout={note.layout} note={note} onReset={resetContent} onCopy={() => copyToClipboard()} />

      {isLayoutOpen && (
        <LayoutModal
          layout={note.layout}
          note={note}
          onCancel={() => setIsLayoutOpen(false)}
          onReset={resetContent}
          onSave={(layout) => {
            setNote((currentNote) => ({ ...currentNote, layout }));
            setIsLayoutOpen(false);
          }}
        />
      )}

      {isTextModuleOpen && (
        <TextModuleModal
          onCancel={() => setIsTextModuleOpen(false)}
          onCreate={addTextModule}
        />
      )}

      {editingComponentId && (() => {
        const component = textComponents.find((item) => item.id === editingComponentId);
        if (!component) return null;
        return (
          <TextEditorModal
            initialText={component.text}
            snippets={snippets}
            onCancel={() => setEditingComponentId(null)}
            onSaveSnippets={setSnippets}
            onSave={(text) => {
              updateTextComponent(component.id, (currentComponent) => ({ ...currentComponent, text }));
              setEditingComponentId(null);
            }}
          />
        );
      })()}

      {editingPropertiesComponentId && (() => {
        const component = textComponents.find((item) => item.id === editingPropertiesComponentId);
        if (!component) return null;
        return (
          <PropertiesModal
            note={component}
            onCancel={() => setEditingPropertiesComponentId(null)}
            onDelete={() => deleteModule(component.id)}
            onSave={(updatedComponent) => {
              updateElementById(component.id, updatedComponent);
              setEditingPropertiesComponentId(null);
            }}
          />
        );
      })()}
      {toastMessage && (
        <div className={`toast ${toastMessage ? 'show' : ''}`} role="status">{toastMessage}</div>
      )}
    </main>
  );
}

export default App;
