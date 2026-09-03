import { useEffect, useRef, useState } from 'react';
import './App.css';
import { autocorrectToothEntry, CLINICAL_CATEGORIES, createNote, createTextComponent, formatToothSurfaces, parseToothSurfaces, createToothRegistry, OAP_FIELDS, getBloodPressureStatus, DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS, LOCAL_ANESTHETICS, DENTAL_ALLERGY_OPTIONS, ALERT_CONDITION_OPTIONS, PREGNANCY_TRIMESTERS } from './noteSchema';
import { addDoc, deleteDoc, doc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { auth, archivedNotesCollection, firestore, layoutPreferencesCollection } from './firebase';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';

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
const savedNotesStorageKey = 'dental-note-maker.saved-notes';
const techNameStorageKey = 'dental-note-maker.tech-name';
const layoutPreferencesStorageKey = 'dental-note-maker.layout-preferences';

function logFirebase(message, details) {
  console.info(`[DentalNoteMaker Firebase] ${message}`, details || '');
}

function logFirebaseError(message, error) {
  console.error(`[DentalNoteMaker Firebase] ${message}`, error);
}

function loadCachedLayoutPreferences() {
  try {
    const saved = window.localStorage.getItem(layoutPreferencesStorageKey);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

function loadSavedNotes() {
  try {
    const savedNotes = window.localStorage.getItem(savedNotesStorageKey);
    const parsedNotes = savedNotes ? JSON.parse(savedNotes) : [];
    return Array.isArray(parsedNotes) ? parsedNotes : [];
  } catch {
    return [];
  }
}

const LANDING_FEATURES = [
  'Real-time Doctor-Tech collaboration',
  'MHS Genesis-ready formatting for DHA clinics',
  'Standardized military dental classifications (Class 1–4)',
  'Interactive tooth chart with multi-surface caries mapping',
  'Seamlessly import past notes & local history',
  'Cloud-synced note history & Firestore preferences',
  'Detailed Endo-Testing & PSR tables',
  'Built-in dental term & tooth surface autocorrect',
  'Quick-Copy with Shift + Enter',
  'Double-click to replace text snippets',
  'Fully customizable note templates & layouts',
];

function loadTechName() {
  return window.localStorage.getItem(techNameStorageKey) || '';
}

function WelcomeScreen({
  initialTechName,
  onContinue,
  onDoctorLogin,
  layoutPreferences = [],
  layoutPreferencesStatus = 'idle',
  onRefreshPreferences,
}) {
  const [techName, setTechName] = useState(initialTechName);
  const [selectedPreferenceId, setSelectedPreferenceId] = useState('');
  const [featureIndex, setFeatureIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setFeatureIndex((prev) => (prev + 1) % LANDING_FEATURES.length);
        setIsFading(false);
      }, 350);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="welcome-screen" id="view-technician-start">
      <div className="landing-container">
        <header className="landing-hero-header">
          <p className="eyebrow landing-kicker">CLINICAL NOTE SUITE · MHS GENESIS READY</p>
          <h1 className="landing-title">Dental Note Maker</h1>
          <p className="landing-version">v5 · Cloud Edition</p>
          <p className="landing-app-description">
            A standardized, collaborative clinical note generation and charting tool designed for clinics and military healthcare facilities. Streamlines tooth charting, restorative treatments, SOAP note composition, and seamless real-time handoffs between providers and technicians.
          </p>
        </header>

        <section className="welcome-panel login-box" aria-labelledby="welcome-title">
          <div className="login-box-header">
            <h2 id="welcome-title">Start a clinical note</h2>
            <p className="welcome-copy">
              Select your clinic template and enter your Tech Name to begin, or sign in as a doctor for cloud-synced records.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (techName.trim()) {
                const chosenPref = layoutPreferences.find((p) => p.id === selectedPreferenceId) || null;
                onContinue(techName.trim(), chosenPref);
              }
            }}
          >
            <div className="preference-select-field">
              <div className="preference-select-header">
                <label className="field-label" htmlFor="welcome-layout-preference" style={{ margin: 0 }}>
                  1. Clinic / Layout Template
                </label>
                {onRefreshPreferences && (
                  <button
                    type="button"
                    className="edit-link"
                    style={{ fontSize: '0.75rem' }}
                    onClick={onRefreshPreferences}
                    title="Refresh layout preferences from cloud"
                  >
                    {layoutPreferencesStatus === 'loading' ? 'Refreshing...' : '↻ Refresh templates'}
                  </button>
                )}
              </div>
              <select
                id="welcome-layout-preference"
                value={selectedPreferenceId}
                onChange={(event) => setSelectedPreferenceId(event.target.value)}
              >
                <option value="">Default / Standard DHA Clinic Template</option>
                {layoutPreferences.map((pref) => (
                  <option key={pref.id} value={pref.id}>
                    {pref.title} {pref.createdBy ? `(by ${pref.createdBy})` : ''}
                  </option>
                ))}
              </select>
              <p className="field-help" style={{ marginTop: '6px', fontSize: '0.8rem' }}>
                {selectedPreferenceId
                  ? 'Selected preference sets module arrangement and snippet presets.'
                  : 'Use current local workspace layout or select a preset saved in Firestore.'}
              </p>
            </div>

            <div className="form-field-group">
              <label className="field-label" htmlFor="welcome-tech-name">
                Tech Name
              </label>
              <input
                id="welcome-tech-name"
                value={techName}
                onChange={(event) => setTechName(event.target.value)}
                autoFocus
                placeholder="Enter your name..."
              />
            </div>

            <button className="primary-button welcome-submit" id="start-day-button" type="submit">
              Continue
            </button>
          </form>

          <div className="login-divider">
            <span>- or -</span>
          </div>

          <button
            type="button"
            className="secondary-button doctor-login-button"
            id="show-doctor-login-btn"
            onClick={onDoctorLogin}
          >
            Doctor Login / Firebase Account
          </button>
        </section>

        {/* 3. Feature Showcase Section with Rotating Feature Description */}
        <section className="feature-showcase" aria-label="A Collaborative Note-Making Tool">
          <h2>A Collaborative Note-Making Tool</h2>
          <p className="feature-showcase-desc">
            Built for speed and teamwork, enabling seamless real-time updates between doctors and technicians for DHA clinic operations.
          </p>
          <div className="feature-rotator" aria-live="polite">
            <span
              id="feature-text"
              className={`feature-rotator-text ${isFading ? 'fading' : 'active'}`}
            >
              {LANDING_FEATURES[featureIndex]}
            </span>
          </div>
          <div className="feature-pill-track" role="region" aria-label="Key features preview">
            {LANDING_FEATURES.slice(0, 6).map((feat, i) => (
              <span key={i} className="feature-chip">
                {feat}
              </span>
            ))}
          </div>
        </section>

        {/* 4. Non-DoD / Non-Navy Disclaimer Footer */}
        <footer className="landing-footer">
          <p className="disclaimer-text">
            This is a non-DoD, non-Navy affiliated website. The appearance of hyperlinks does not constitute endorsement. This website is provided as-is without any warranty of any kind. Users shall not enter, store, or transmit any Personally Identifiable Information (PII) or Protected Health Information (PHI).
          </p>
          <p className="landing-footer-contact">
            For questions or support, contact the developer:{' '}
            <a href="mailto:mark.g.horning.civ@health.mil">mark.g.horning.civ@health.mil</a>
          </p>
        </footer>
      </div>
    </main>
  );
}

function AuthModal({
  user,
  onClose,
  onAuthenticated,
  onSignedOut,
  cloudNotes,
  cloudStatus,
  onRestoreCloudNote,
  onOpenCloudLayouts,
}) {
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCloudNotesOpen, setIsCloudNotesOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const result = isCreateMode
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      onAuthenticated(result.user);
      onClose();
    } catch (error) {
      logFirebaseError(isCreateMode ? 'Account creation failed' : 'Login failed', error);
      setErrorMessage(error.message || 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="editor-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <header className="modal-header">
          <div><p className="eyebrow">Firebase account</p><h2 id="auth-title">{user ? 'Account' : isCreateMode ? 'Create account' : 'Log in'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close account dialog">×</button>
        </header>
        {user ? (
          <div className="modal-body auth-account-body">
            <p>Signed in as <strong>{user.email}</strong>.</p>
            <button type="button" className="secondary-button" onClick={() => setIsCloudNotesOpen(true)}>View cloud records</button>
            {onOpenCloudLayouts && (
              <button type="button" className="secondary-button" onClick={onOpenCloudLayouts}>Manage Cloud Layouts</button>
            )}
            <button type="button" className="secondary-button" onClick={onSignedOut}>Sign out</button>
            {isCloudNotesOpen && <CloudNotesModal cloudNotes={cloudNotes} cloudStatus={cloudStatus} onRestore={onRestoreCloudNote} onClose={() => setIsCloudNotesOpen(false)} />}
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="modal-body auth-form">
              <label className="field-label" htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
              <label className="field-label" htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required />
              {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
            </div>
            <footer className="modal-footer"><button type="button" className="secondary-button" onClick={() => setIsCreateMode((current) => !current)}>{isCreateMode ? 'Use login' : 'Create account'}</button><button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Working...' : isCreateMode ? 'Create account' : 'Log in'}</button></footer>
          </form>
        )}
      </section>
    </div>
  );
}

function CloudNotesModal({ cloudNotes, cloudStatus, onRestore, onClose }) {
  return (
    <div className="nested-modal-backdrop" role="presentation">
      <section className="cloud-notes-panel" role="dialog" aria-modal="true" aria-labelledby="cloud-notes-title">
        <header className="modal-header"><div><p className="eyebrow">Firebase archive</p><h2 id="cloud-notes-title">Cloud records</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close cloud records">×</button></header>
        <div className="modal-body">
          {cloudStatus === 'loading' && <p className="cloud-status" role="status">Loading cloud records...</p>}
          {cloudStatus === 'error' && <p className="cloud-status cloud-status-error" role="alert">Cloud records could not be loaded. Check the browser console for the Firebase error code and Firestore rules.</p>}
          {cloudStatus !== 'loading' && cloudNotes.length ? <div className="saved-notes-list">{cloudNotes.slice(0, 20).map((savedNote) => <button type="button" className="saved-note" key={savedNote.id} onClick={() => { onRestore(savedNote.note); onClose(); }}><span className="saved-note-label">{savedNote.technicianName || 'Technician'} · Cloud note</span><time dateTime={savedNote.savedAt}>{new Date(savedNote.savedAt).toLocaleString()}</time></button>)}</div> : cloudStatus !== 'loading' && cloudStatus !== 'error' && <p className="empty-history">No cloud records found for this account.</p>}
        </div>
      </section>
    </div>
  );
}

function CloudLayoutsModal({
  isOpen,
  onClose,
  layoutPreferences,
  layoutPreferencesStatus,
  onRefreshPreferences,
  onSavePreference,
  onDeletePreference,
  onApplyPreference,
  currentNote,
  currentSnippets,
  authUser,
}) {
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('current');
  const [fileContent, setFileContent] = useState(null);
  const [fileName, setFileName] = useState('');
  const [rawJson, setRawJson] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const existingPref = layoutPreferences.find(
    (p) => p.title?.trim().toLowerCase() === title.trim().toLowerCase()
  );

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setFileContent(parsed);
        setErrorMessage('');
      } catch {
        setErrorMessage('Invalid JSON file format.');
        setFileContent(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleSave(event) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await onSavePreference({
        title,
        source,
        jsonFileContent: fileContent,
        rawJsonText: rawJson,
      });
      setSuccessMessage(existingPref ? `Updated "${title}" in Firestore!` : `Saved "${title}" as new preference!`);
      setTitle('');
      setFileContent(null);
      setFileName('');
      setRawJson('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to save layout preference.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function downloadJson(pref) {
    const payload = pref.preferences || pref;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${(pref.title || 'layout-preference').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="editor-modal cloud-layout-modal" role="dialog" aria-modal="true" aria-labelledby="cloud-layouts-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Firestore Layout Preferences</p>
            <h2 id="cloud-layouts-title">Cloud Layout Preferences</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close cloud layouts dialog">×</button>
        </header>

        <div className="modal-body">
          <form className="cloud-layout-form" onSubmit={handleSave}>
            <div>
              <p className="field-label" style={{ fontWeight: 800, fontSize: '0.95rem' }}>Upload or Overwrite Layout Preference</p>
              <p className="field-help">Save custom UI arrangement, modules, and snippet sets to Firestore for technicians to select on login.</p>
            </div>

            <div>
              <label className="field-label" htmlFor="pref-title-input">Preference Title Name</label>
              <input
                id="pref-title-input"
                type="text"
                placeholder="e.g. Hygiene Recall, New Patient Comprehensive, Operative Restorative"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
              />
              {layoutPreferences.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <span className="field-help" style={{ fontSize: '0.78rem', marginRight: '6px' }}>Or select existing title to overwrite:</span>
                  <div className="title-chip-group">
                    {layoutPreferences.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="title-chip"
                        onClick={() => setTitle(p.title)}
                        title={`Select "${p.title}"`}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Layout Data Source</label>
              <div className="source-tabs">
                <button
                  type="button"
                  className={`source-tab ${source === 'current' ? 'is-active' : ''}`}
                  onClick={() => setSource('current')}
                >
                  Current Workspace
                </button>
                <button
                  type="button"
                  className={`source-tab ${source === 'file' ? 'is-active' : ''}`}
                  onClick={() => setSource('file')}
                >
                  Upload JSON File
                </button>
                <button
                  type="button"
                  className={`source-tab ${source === 'paste' ? 'is-active' : ''}`}
                  onClick={() => setSource('paste')}
                >
                  Paste JSON
                </button>
              </div>

              {source === 'current' && (
                <p className="field-help">
                  Will save current workspace configuration: <strong>{currentNote.sections?.length || 0} sections</strong> ({currentNote.sections?.flatMap((s) => s.elements).length || 0} modules) and <strong>{currentSnippets?.length || 0} snippets</strong>.
                </p>
              )}

              {source === 'file' && (
                <div>
                  <label className="secondary-button file-button" style={{ display: 'inline-block' }}>
                    {fileName ? `File: ${fileName}` : 'Choose JSON File'}
                    <input type="file" accept="application/json" onChange={handleFileChange} />
                  </label>
                  {fileName && <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: 'var(--teal-dark)', fontWeight: 700 }}>✓ Loaded</span>}
                </div>
              )}

              {source === 'paste' && (
                <div>
                  <textarea
                    placeholder='Paste JSON preference here... e.g. { "note": { "sections": [...], "layout": [...] }, "snippets": [...] }'
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                    style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  />
                </div>
              )}
            </div>

            {existingPref && (
              <div className="overwrite-alert">
                <span>⚠️</span>
                <div>
                  <strong>Overwrite Alert:</strong> A preference with title <em>"{existingPref.title}"</em> already exists in Firestore. Saving will <strong>overwrite</strong> its configuration.
                </div>
              </div>
            )}

            {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
            {successMessage && <p style={{ color: '#176b43', fontWeight: 700, margin: '4px 0' }} role="status">{successMessage}</p>}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting || !title.trim()}
              >
                {isSubmitting ? 'Saving to Firestore...' : existingPref ? `Overwrite "${existingPref.title}"` : 'Save as New Preference'}
              </button>
              {onRefreshPreferences && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onRefreshPreferences}
                  disabled={layoutPreferencesStatus === 'loading'}
                >
                  {layoutPreferencesStatus === 'loading' ? 'Refreshing...' : '↻ Refresh list'}
                </button>
              )}
            </div>
          </form>

          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--ink)' }}>
                Saved Firestore Preferences ({layoutPreferences.length})
              </h3>
            </div>

            {layoutPreferencesStatus === 'loading' && layoutPreferences.length === 0 && (
              <p className="cloud-status">Loading preferences from Firestore...</p>
            )}

            {layoutPreferences.length === 0 && layoutPreferencesStatus !== 'loading' && (
              <p className="empty-history">No preferences saved in Firestore yet. Upload your first layout preference above.</p>
            )}

            <div className="cloud-layouts-list">
              {layoutPreferences.map((pref) => {
                const prefData = pref.preferences || {};
                const noteData = prefData.note || {};
                const moduleCount = noteData.sections?.flatMap((s) => s.elements)?.length || 0;
                const snippetCount = prefData.snippets?.length || 0;
                const isConfirmingDelete = deleteConfirmId === pref.id;

                return (
                  <article key={pref.id} className="cloud-layout-card">
                    <div className="cloud-layout-card-header">
                      <div>
                        <h4 className="cloud-layout-card-title">{pref.title}</h4>
                        <div className="cloud-layout-meta">
                          <span className="cloud-layout-badge">{moduleCount} modules</span>
                          <span className="cloud-layout-badge">{snippetCount} snippets</span>
                          {pref.createdBy && <span>By {pref.createdBy}</span>}
                          {pref.updatedAt && (
                            <time dateTime={pref.updatedAt}>
                              Updated {new Date(pref.updatedAt).toLocaleDateString()}
                            </time>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="cloud-layout-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => onApplyPreference(pref)}
                        title="Load this layout into active workspace"
                      >
                        Apply to workspace
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => downloadJson(pref)}
                        title="Download JSON file"
                      >
                        Download JSON
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setTitle(pref.title);
                          setSource('current');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        title="Quick overwrite with current workspace"
                      >
                        Overwrite with current
                      </button>

                      {isConfirmingDelete ? (
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: '#a21e1e', fontWeight: 700 }}>Confirm delete?</span>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={async () => {
                              try {
                                await onDeletePreference(pref.id);
                                setDeleteConfirmId(null);
                              } catch (err) {
                                setErrorMessage(err.message || 'Could not delete preference.');
                              }
                            }}
                          >
                            Yes, delete
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => setDeleteConfirmId(pref.id)}
                          title="Delete this preference from Firestore"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
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
      event.stopPropagation();
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
  const [moduleKind, setModuleKind] = useState('text');

  function handleSubmit(event) {
    event.preventDefault();
    if (label.trim()) onCreate({ category, label: label.trim(), moduleKind });
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      handleSubmit(event);
    }
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
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="modal-body">
            <label className="field-label" htmlFor="text-module-category">Category</label>
            <select id="text-module-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {Object.values(CLINICAL_CATEGORIES).map(({ id, label: categoryLabel }) => (
                <option key={id} value={id}>{categoryLabel}</option>
              ))}
            </select>
            <label className="field-label module-label-field" htmlFor="text-module-kind">Module type</label>
            <select id="text-module-kind" value={moduleKind} onChange={(event) => setModuleKind(event.target.value)}>
              <option value="text">Textbox editor</option>
              <option value="oap">O / A / P problem</option>
              <option value="bloodPressure">Blood pressure</option>
              <option value="painScale">Pain scale (0-10)</option>
              <option value="alert">Allergy / Alert</option>
              <option value="treatmentPlan">Treatment planning</option>
              <option value="localAnesthetic">Local anesthetic</option>
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

function formatAnestheticNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function getAnestheticSummary(entries, topicalAnesthetic) {
  const parts = LOCAL_ANESTHETICS.flatMap((anesthetic) => {
    const carpules = Number(entries?.[anesthetic.id]) || 0;
    if (carpules <= 0) return [];
    const mg = carpules * anesthetic.mgPerCarpule;
    const epi = carpules * anesthetic.epiMicrogramsPerCarpule;
    return `${formatAnestheticNumber(mg)}mg ${anesthetic.outputLabel} with ${formatAnestheticNumber(epi)} micrograms epi`;
  });
  if (!parts.length) return '';
  if (topicalAnesthetic) parts.push('Topical anesthetic');
  return parts.join('; ');
}

function LocalAnestheticModal({ component, onCancel, onSave }) {
  const [entries, setEntries] = useState(() => Object.fromEntries(LOCAL_ANESTHETICS.map(({ id }) => [id, component.anestheticEntries?.[id] ?? 0])));
  const [topicalAnesthetic, setTopicalAnesthetic] = useState(component.topicalAnesthetic !== false);

  function updateEntry(id, value) {
    setEntries((current) => ({ ...current, [id]: value }));
  }

  function save(event) {
    event.preventDefault();
    onSave({ anestheticEntries: entries, topicalAnesthetic });
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      save(event);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="editor-modal local-anesthetic-modal" role="dialog" aria-modal="true" aria-labelledby="local-anesthetic-title">
        <header className="modal-header">
          <div><p className="eyebrow">Local anesthetic</p><h2 id="local-anesthetic-title">{component.externalLabel || component.label}</h2></div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close local anesthetic editor">×</button>
        </header>
        <form onSubmit={save} onKeyDown={handleKeyDown}>
          <div className="modal-body">
            <div className="anesthetic-entry-list">
              {LOCAL_ANESTHETICS.map((anesthetic) => (
                <label className="anesthetic-entry" key={anesthetic.id} htmlFor={`anesthetic-${anesthetic.id}`}>
                  <span>{anesthetic.label}</span>
                  <input id={`anesthetic-${anesthetic.id}`} aria-label={`${anesthetic.label} carpules`} type="number" min="0" step="0.1" value={entries[anesthetic.id]} onChange={(event) => updateEntry(anesthetic.id, event.target.value)} />
                  <span>carpules</span>
                </label>
              ))}
            </div>
            <label className="topical-toggle"><input type="checkbox" checked={topicalAnesthetic} onChange={(event) => setTopicalAnesthetic(event.target.checked)} /> Topical anesthetic</label>
            <p className="field-help">Totals are calculated from carpules. Zero-use anesthetics are omitted from output.</p>
            <p className="anesthetic-live-preview">{getAnestheticSummary(entries, topicalAnesthetic) || 'No anesthetic recorded.'}</p>
          </div>
          <footer className="modal-footer">
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Save anesthetic</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function BloodPressureModal({ component, onCancel, onSave }) {
  const [systolic, setSystolic] = useState(component.systolic || '');
  const [diastolic, setDiastolic] = useState(component.diastolic || '');
  const status = getBloodPressureStatus(systolic, diastolic, component.bloodPressureAlertLevels);
  const statusLabels = { incomplete: 'Enter a reading', normal: 'Normal', prehypertensive: 'Prehypertensive', hypertensive: 'Hypertensive', danger: 'Uncontrolled danger' };

  function save(event) {
    event.preventDefault();
    onSave({ systolic, diastolic });
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      save(event);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="editor-modal blood-pressure-modal" role="dialog" aria-modal="true" aria-labelledby="blood-pressure-title">
        <header className="modal-header">
          <div><p className="eyebrow">{CLINICAL_CATEGORIES[component.category]?.label || component.category}</p><h2 id="blood-pressure-title">{component.externalLabel || component.label}</h2></div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close blood pressure editor">×</button>
        </header>
        <form onSubmit={save} onKeyDown={handleKeyDown}>
          <div className={`modal-body blood-pressure-fields bp-status-${status}`}>
            <div className="blood-pressure-inputs">
              <div><label className="field-label" htmlFor="blood-pressure-systolic">Systolic</label><input id="blood-pressure-systolic" type="number" min="1" value={systolic} onChange={(event) => setSystolic(event.target.value)} placeholder="120" /></div>
              <span className="blood-pressure-slash">/</span>
              <div><label className="field-label" htmlFor="blood-pressure-diastolic">Diastolic</label><input id="blood-pressure-diastolic" type="number" min="1" value={diastolic} onChange={(event) => setDiastolic(event.target.value)} placeholder="80" /></div>
              <span className="blood-pressure-unit">mmHg</span>
            </div>
            <div className="blood-pressure-status" role="status" aria-label="Blood pressure status">{statusLabels[status]}</div>
            <p className="field-help">Normal &lt;120/&lt;80. Prehypertensive 120-129/&lt;80. Hypertensive 130/80 or higher. Danger 180/120 or higher.</p>
          </div>
          <footer className="modal-footer">
            <span className="keyboard-hint">Shift + Enter to save</span>
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Save blood pressure</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function getPlanSegments(component) {
  const plan = component.plan || '';
  const classifications = Array.isArray(component.planClassifications) ? component.planClassifications : [];
  if (!plan) return [];
  if (classifications.map((segment) => segment.text).join('') === plan) return classifications;
  return [{ text: plan, classification: 2 }];
}

function classifyPlanSelection(plan, classifications, start, end, classification) {
  const segments = getPlanSegments({ plan, planClassifications: classifications });
  const nextSegments = [];
  let cursor = 0;
  segments.forEach((segment) => {
    const segmentStart = cursor;
    const segmentEnd = cursor + segment.text.length;
    const overlapStart = Math.max(start, segmentStart);
    const overlapEnd = Math.min(end, segmentEnd);
    if (overlapStart >= overlapEnd) {
      nextSegments.push(segment);
    } else {
      const localStart = overlapStart - segmentStart;
      const localEnd = overlapEnd - segmentStart;
      if (localStart) nextSegments.push({ text: segment.text.slice(0, localStart), classification: segment.classification || 2 });
      nextSegments.push({ text: segment.text.slice(localStart, localEnd), classification });
      if (localEnd < segment.text.length) nextSegments.push({ text: segment.text.slice(localEnd), classification: segment.classification || 2 });
    }
    cursor = segmentEnd;
  });
  return nextSegments.filter((segment) => segment.text);
}

function getCariesTreatmentRows(teeth) {
  const grouped = {};
  Object.values(teeth).forEach((tooth) => {
    if (!tooth.surfaces.length && !tooth.notes?.trim() && !tooth.restoration) return;
    const classification = tooth.classification || 2;
    const text = `#${tooth.number}${tooth.surfaces.length ? formatToothSurfaces(tooth.surfaces) : ''}${tooth.restoration ? ` ${tooth.restoration}` : ''}${tooth.notes?.trim() ? ` ${tooth.notes.trim()}` : ''}`;
    if (!grouped[classification]) grouped[classification] = { text: [], toothIds: [] };
    grouped[classification].text.push(text);
    grouped[classification].toothIds.push(tooth.id);
  });
  return [3, 2, 1].filter((classification) => grouped[classification]).map((classification) => ({ id: `caries-class-${classification}`, category: `Operative Class ${classification}`, plan: grouped[classification].text.join('\n'), classification, source: null, toothIds: grouped[classification].toothIds }));
}

function getTreatmentPlanRows(note) {
  const rows = getCariesTreatmentRows(note.teeth);
  const groupedOapRows = {};
  note.sections.flatMap((section) => section.elements)
    .filter((element) => element.moduleKind === 'oap' && element.plan?.trim())
    .forEach((element) => getPlanSegments(element).forEach((segment, segmentIndex) => {
      const classification = segment.classification || 2;
      const label = element.externalLabel || element.label || CLINICAL_CATEGORIES[element.category]?.label || element.category;
      const key = `${element.id}:${classification}`;
      if (!groupedOapRows[key]) groupedOapRows[key] = { id: key, category: `${label} · Class ${classification}`, plan: [], classification, source: element, segmentIndexes: [] };
      groupedOapRows[key].plan.push(segment.text);
      groupedOapRows[key].segmentIndexes.push(segmentIndex);
    }));
  return [...rows, ...Object.values(groupedOapRows).map((row) => ({ ...row, plan: row.plan.join('\n') }))];
}

function TreatmentPlanModal({ note, treatmentPlan, onCancel, onUpdateOap, onDeleteCaries }) {
  const defaultRows = getTreatmentPlanRows(note);
  const [orderedIds, setOrderedIds] = useState(() => {
    const preferred = treatmentPlan?.treatmentPlanOrder || [];
    const defaultOrder = [...defaultRows].sort((left, right) => right.classification - left.classification);
    return [...preferred.filter((id) => defaultRows.some((row) => row.id === id)), ...defaultOrder.map((row) => row.id).filter((id) => !preferred.includes(id))];
  });
  const rows = orderedIds.map((id) => defaultRows.find((row) => row.id === id)).filter(Boolean);
  const [draggedRowId, setDraggedRowId] = useState(null);
  const [rowSelection, setRowSelection] = useState(null);

  useEffect(() => {
    const validIds = new Set(defaultRows.map((row) => row.id));
    const nextIds = orderedIds.filter((id) => validIds.has(id));
    const newRows = defaultRows.filter((row) => !nextIds.includes(row.id)).sort((left, right) => right.classification - left.classification);
    const mergedIds = [...nextIds];
    newRows.forEach((row) => {
      const insertAt = mergedIds.findIndex((id) => (defaultRows.find((item) => item.id === id)?.classification || 2) < row.classification);
      mergedIds.splice(insertAt < 0 ? mergedIds.length : insertAt, 0, row.id);
    });
    if (mergedIds.length !== orderedIds.length || mergedIds.some((id, index) => id !== orderedIds[index])) setOrderedIds(mergedIds);
  }, [note, treatmentPlan]);

  function updateRow(row, value) {
    if (!row.source) return;
    onUpdateOap(row.source.id, (component) => {
      const segments = getPlanSegments(component);
      const nextTexts = value.split('\n');
      row.segmentIndexes.forEach((segmentIndex, index) => {
        if (segments[segmentIndex]) segments[segmentIndex] = { ...segments[segmentIndex], text: nextTexts[index] || '' };
      });
      return { ...component, plan: segments.map((segment) => segment.text).join(''), planClassifications: segments };
    });
  }

  function setRowClass(row, classification) {
    if (!row.source) return;
    onUpdateOap(row.source.id, (component) => ({ ...component, planClassifications: getPlanSegments(component).map((segment, index) => row.segmentIndexes.includes(index) ? { ...segment, classification } : segment) }));
  }

  function deleteRow(row) {
    if (row.source) {
      onUpdateOap(row.source.id, (component) => {
        const deletedIndexes = new Set(row.segmentIndexes);
        const segments = getPlanSegments(component).filter((_, index) => !deletedIndexes.has(index));
        return { ...component, plan: segments.map((segment) => segment.text).join(''), planClassifications: segments };
      });
    } else if (row.toothIds?.length) onDeleteCaries(row.toothIds);
  }

  function openRowClassification(event, row) {
    if (!row.source) return;
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    if (start !== end) setRowSelection({ row, start, end, text: event.currentTarget.value.slice(start, end) });
  }

  function classifySelectedRow(classification) {
    const { row, start, end } = rowSelection;
    const segmentOffset = getPlanSegments(row.source).slice(0, row.segmentIndexes[0]).reduce((total, segment) => total + segment.text.length, 0);
    onUpdateOap(row.source.id, (component) => ({
      ...component,
      planClassifications: classifyPlanSelection(component.plan, component.planClassifications, segmentOffset + start, segmentOffset + end, classification),
    }));
    setRowSelection(null);
  }

  function moveRow(targetId) {
    if (!draggedRowId || draggedRowId === targetId) return;
    const nextIds = orderedIds.filter((id) => id !== draggedRowId);
    nextIds.splice(nextIds.indexOf(targetId), 0, draggedRowId);
    setOrderedIds(nextIds);
    if (treatmentPlan) onUpdateTreatmentPlan(treatmentPlan.id, (component) => ({ ...component, treatmentPlanOrder: nextIds }));
    setDraggedRowId(null);
  }

  function moveRowByOffset(rowId, offset) {
    const index = orderedIds.indexOf(rowId);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) return;
    const nextIds = [...orderedIds];
    [nextIds[index], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[index]];
    setOrderedIds(nextIds);
    if (treatmentPlan) onUpdateTreatmentPlan(treatmentPlan.id, (component) => ({ ...component, treatmentPlanOrder: nextIds }));
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="editor-modal treatment-plan-modal" role="dialog" aria-modal="true" aria-labelledby="treatment-plan-title" onKeyDown={handleKeyDown}>
        <header className="modal-header"><div><p className="eyebrow">Dental readiness</p><h2 id="treatment-plan-title">Treatment planning</h2></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Close treatment planning">×</button></header>
        <div className="modal-body">
          <div className="treatment-plan-header"><span>Category and plan</span><span>Class 3</span><span>Class 2</span><span>Class 1</span><span>Order</span><span aria-hidden="true" /></div>
          {rows.map((row) => {
            const selectedClass = row.classification || 2;
            return <div className="treatment-plan-row" key={row.id} draggable onDragStart={() => setDraggedRowId(row.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveRow(row.id)}>
              <div className="treatment-plan-content"><label className="field-label" htmlFor={`treatment-plan-${row.id}`}>{row.category}</label><textarea id={`treatment-plan-${row.id}`} rows={2} value={row.plan} onChange={(event) => updateRow(row, event.target.value)} onContextMenu={(event) => openRowClassification(event, row)} readOnly={!row.source} placeholder="Enter treatment plan..." /></div>
              {[3, 2, 1].map((classification) => <label className="treatment-class-option" key={classification}><input type="radio" name={`treatment-class-${row.id}`} value={classification} checked={selectedClass === classification} onChange={() => setRowClass(row, classification)} /> <span>{classification}</span></label>)}
              <div className="treatment-order-controls"><button type="button" className="icon-button" onClick={() => moveRowByOffset(row.id, -1)} disabled={rows[0].id === row.id} aria-label={`Move ${row.category} up`} title="Move up">&#9650;</button><button type="button" className="icon-button" onClick={() => moveRowByOffset(row.id, 1)} disabled={rows[rows.length - 1].id === row.id} aria-label={`Move ${row.category} down`} title="Move down">&#9660;</button></div>
              <button type="button" className="icon-button treatment-delete-button" onClick={() => deleteRow(row)} aria-label={`Delete ${row.category}`} title="Delete treatment row">🗑</button>
            </div>;
          })}
          {rowSelection && <div className="class-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRowSelection(null); }}>
            <div className="class-editor-modal" role="dialog" aria-label="Classify selected treatment text">
              <form onSubmit={(event) => { event.preventDefault(); classifySelectedRow(2); }}>
                <p className="eyebrow">Treatment plan chunk</p>
                <p className="selected-plan-text">{rowSelection.text}</p>
                <div className="plan-classification-actions">{[3, 2, 1].map((classification) => <button type="button" className="secondary-button" key={classification} onClick={() => classifySelectedRow(classification)}>Class {classification}</button>)}</div>
              </form>
            </div>
          </div>}
          {!rows.some((row) => row.plan) && <p className="empty-history">Add content to an OAP Plan or chart a caries finding to populate treatment planning.</p>}
        </div>
        <footer className="modal-footer"><span className="keyboard-hint">Shift + Enter to close</span><button type="button" className="secondary-button" onClick={onCancel}>Close</button></footer>
      </section>
    </div>
  );
}

function getAlertSummary(component) {
  if (component.alertNone || (!component.alertAllergies?.length && !component.alertConditions?.length && !component.alertCustomText?.trim())) return 'Allergies reviewed';
  const allergies = (component.alertAllergies || []).map((allergy) => `${allergy} Allergy`);
  const conditions = (component.alertConditions || []).map((condition) => condition === 'Pregnant' && component.pregnancyTrimester ? `${condition} (${component.pregnancyTrimester})` : condition);
  const custom = component.alertCustomText?.trim() ? [component.alertCustomText.trim()] : [];
  return [...allergies, ...conditions, ...custom].join('; ');
}

function AlertModal({ component, onCancel, onSave }) {
  const [allergies, setAllergies] = useState(component.alertAllergies || []);
  const [conditions, setConditions] = useState(component.alertConditions || []);
  const [pregnancyTrimester, setPregnancyTrimester] = useState(component.pregnancyTrimester || '');
  const [customText, setCustomText] = useState(component.alertCustomText || '');
  const [none, setNone] = useState(component.alertNone !== false && !(component.alertAllergies?.length || component.alertConditions?.length || component.alertCustomText?.trim()));

  function toggleOption(option, setValues) {
    setValues((current) => current.includes(option) ? current.filter((value) => value !== option) : [...current, option]);
    setNone(false);
  }

  function chooseNone(event) {
    const isChecked = event.target.checked;
    setNone(isChecked);
    if (isChecked) {
      setAllergies([]);
      setConditions([]);
      setPregnancyTrimester('');
      setCustomText('');
    }
  }

  function save(event) {
    event.preventDefault();
    onSave({ alertAllergies: allergies, alertConditions: conditions, pregnancyTrimester, alertCustomText: customText, alertNone: none && !allergies.length && !conditions.length && !customText.trim() });
  }

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      save(event);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="editor-modal alert-modal" role="dialog" aria-modal="true" aria-labelledby="alert-title">
        <header className="modal-header">
          <div><p className="eyebrow">Safety screening</p><h2 id="alert-title">{component.externalLabel || component.label}</h2></div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close allergy and alert editor">×</button>
        </header>
        <form onSubmit={save} onKeyDown={handleKeyDown}>
          <div className="modal-body alert-form">
            <label className="none-alert-option"><input type="checkbox" checked={none} onChange={chooseNone} /> None / no known alerts</label>
            <fieldset>
              <legend className="field-label">Allergies</legend>
              <div className="alert-option-grid">
                {DENTAL_ALLERGY_OPTIONS.map((option) => <label key={option}><input type="checkbox" checked={allergies.includes(option)} onChange={() => toggleOption(option, setAllergies)} /> {option}</label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">Conditions</legend>
              <div className="alert-option-grid">
                {ALERT_CONDITION_OPTIONS.map((option) => <label key={option}><input type="checkbox" checked={conditions.includes(option)} onChange={() => toggleOption(option, setConditions)} /> {option}</label>)}
              </div>
              {conditions.includes('Pregnant') && <label className="trimester-field" htmlFor="pregnancy-trimester">Pregnancy trimester<select id="pregnancy-trimester" value={pregnancyTrimester} onChange={(event) => { setPregnancyTrimester(event.target.value); setNone(false); }}><option value="">Select trimester</option>{PREGNANCY_TRIMESTERS.map((trimester) => <option key={trimester} value={trimester}>{trimester}</option>)}</select></label>}
            </fieldset>
            <div>
              <label className="field-label" htmlFor="alert-custom-text">Other alert or relevant detail</label>
              <textarea id="alert-custom-text" rows={3} value={customText} onChange={(event) => { setCustomText(event.target.value); if (event.target.value.trim()) setNone(false); }} placeholder="Enter an allergy, condition, or relevant detail..." />
            </div>
          </div>
          <footer className="modal-footer">
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Save alerts</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function OapEditorModal({ component, onCancel, onSave }) {
  const [draftValues, setDraftValues] = useState(() => ({
    ...Object.fromEntries(OAP_FIELDS.map(({ id }) => [id, component[id] || ''])),
    planClassifications: component.planClassifications || [],
  }));
  const [draftPreferences, setDraftPreferences] = useState(() => Object.fromEntries(OAP_FIELDS.map(({ id }) => [id, component.quickFillOptions?.[id] || []])));
  const [isManagingPreferences, setIsManagingPreferences] = useState(false);
  const [planSelection, setPlanSelection] = useState(null);

  function updateValue(field, value) {
    setDraftValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'plan' ? { planClassifications: value ? [{ text: value, classification: 2 }] : [] } : {}),
    }));
  }

  function updatePreference(field, index, value) {
    setDraftPreferences((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => itemIndex === index ? value : item),
    }));
  }

  function addPreference(field) {
    setDraftPreferences((current) => ({ ...current, [field]: [...current[field], ''] }));
  }

  function removePreference(field, index) {
    setDraftPreferences((current) => ({ ...current, [field]: current[field].filter((_, itemIndex) => itemIndex !== index) }));
  }

  function insertPreference(field, value) {
    updateValue(field, `${draftValues[field]}${draftValues[field] ? ' ' : ''}${value}`);
  }

  function openPlanClassification(event) {
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    if (start !== end) setPlanSelection({ start, end, text: event.currentTarget.value.slice(start, end) });
  }

  function renderPlanHighlight() {
    return getPlanSegments({ plan: draftValues.plan, planClassifications: draftValues.planClassifications }).map((segment, index) => (
      <span className={`oap-plan-chunk is-class-${segment.classification || 2}`} key={`${segment.text}-${index}`}>{segment.text}</span>
    ));
  }

  function classifySelectedPlan(classification) {
    setDraftValues((current) => ({
      ...current,
      planClassifications: classifyPlanSelection(current.plan, current.planClassifications || component.planClassifications, planSelection.start, planSelection.end, classification),
    }));
    setPlanSelection(null);
  }

  function savePreferences() {
    setDraftPreferences((current) => Object.fromEntries(Object.entries(current).map(([field, values]) => [field, values.filter((value) => value.trim())])));
    setIsManagingPreferences(false);
  }

  function handleKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const cleanedPreferences = Object.fromEntries(Object.entries(draftPreferences).map(([field, values]) => [field, values.filter((value) => value.trim())]));
      onSave({ ...draftValues, quickFillOptions: cleanedPreferences });
    }
  }

  useEffect(() => {
    function handleDocumentKeyDown(event) {
      handleKeyDown(event);
    }

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  });

  return (
    <div className="modal-backdrop" role="presentation" onKeyDown={handleKeyDown} onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="oap-editor-title">
        <header className="modal-header">
          <div><p className="eyebrow">{CLINICAL_CATEGORIES[component.category]?.label || component.category}</p><h2 id="oap-editor-title">{component.externalLabel || component.label}</h2></div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close O A P editor">×</button>
        </header>
        <div className="modal-body oap-fields">
          {OAP_FIELDS.map(({ id, label }) => (
            <div className="oap-field" key={id}>
              <label className="field-label" htmlFor={`oap-${id}`}>{label}</label>
              {id === 'plan' ? (
                <div className="oap-plan-editor">
                  <div className="oap-plan-highlight" aria-hidden="true">{renderPlanHighlight()}</div>
                  <textarea id="oap-plan" rows={3} value={draftValues[id]} onChange={(event) => updateValue(id, event.target.value)} onContextMenu={openPlanClassification} placeholder={`Enter ${label.toLowerCase()}...`} />
                </div>
              ) : <textarea id={`oap-${id}`} rows={3} value={draftValues[id]} onChange={(event) => updateValue(id, event.target.value)} placeholder={`Enter ${label.toLowerCase()}...`} />}
              {draftPreferences[id].length > 0 && <div className="quick-fill-controls">
                <select aria-label={`${label} quick fill`} defaultValue="" onChange={(event) => { if (event.target.value) insertPreference(id, event.target.value); event.target.value = ''; }}>
                  <option value="">Quick fill {label.toLowerCase()}</option>
                  {draftPreferences[id].map((value, index) => <option key={`${value}-${index}`} value={value}>{value}</option>)}
                </select>
              </div>}
            </div>
          ))}
          <button type="button" className="manage-snippets-button" onClick={() => setIsManagingPreferences((current) => !current)}>
            {isManagingPreferences ? 'Hide quick-fill preferences' : 'Manage quick-fill preferences'}
          </button>
          {isManagingPreferences && <div className="oap-preferences">
            {OAP_FIELDS.map(({ id, label }) => <div className="oap-preference-group" key={id}>
              <p className="field-label">{label} options</p>
              {draftPreferences[id].map((value, index) => <div className="snippet-preference" key={`${id}-${index}`}>
                <input aria-label={`${label} option ${index + 1}`} value={value} onChange={(event) => updatePreference(id, index, event.target.value)} />
                <button type="button" className="icon-button" onClick={() => removePreference(id, index)} aria-label={`Remove ${label} option ${index + 1}`}>×</button>
              </div>)}
              <button type="button" className="secondary-button" onClick={() => addPreference(id)}>Add {label.toLowerCase()} option</button>
            </div>)}
            <button type="button" className="secondary-button" onClick={savePreferences}>Save quick-fill preferences</button>
          </div>}
          {planSelection && <div className="plan-classification-popover" role="dialog" aria-label="Classify selected plan text">
            <p className="field-label">Classify selected plan text</p>
            <p className="selected-plan-text">{planSelection.text}</p>
            <div className="plan-classification-actions">{[3, 2, 1].map((classification) => <button type="button" className="secondary-button" key={classification} onClick={() => classifySelectedPlan(classification)}>Class {classification}</button>)}</div>
          </div>}
        </div>
        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => onSave({ ...draftValues, planClassifications: draftValues.planClassifications || component.planClassifications || [{ text: draftValues.plan, classification: 2 }], quickFillOptions: draftPreferences })}>Save O / A / P</button>
        </footer>
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
      event.stopPropagation();
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
                {draftNote.moduleKind === 'bloodPressure' && <div className="property-field property-field-wide blood-pressure-preferences">
                  <p className="field-label">Blood pressure alert levels</p>
                  <p className="field-help">Set the systolic and diastolic boundaries used for card color changes.</p>
                  <div className="bp-preference-grid">
                    <label>Normal systolic max<input aria-label="Normal systolic maximum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.normalSystolicMax ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.normalSystolicMax} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), normalSystolicMax: Number(event.target.value) || 1 })} /></label>
                    <label>Normal diastolic max<input aria-label="Normal diastolic maximum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.normalDiastolicMax ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.normalDiastolicMax} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), normalDiastolicMax: Number(event.target.value) || 1 })} /></label>
                    <label>Prehypertensive systolic max<input aria-label="Prehypertensive systolic maximum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.prehypertensiveSystolicMax ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.prehypertensiveSystolicMax} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), prehypertensiveSystolicMax: Number(event.target.value) || 1 })} /></label>
                    <label>Prehypertensive diastolic max<input aria-label="Prehypertensive diastolic maximum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.prehypertensiveDiastolicMax ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.prehypertensiveDiastolicMax} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), prehypertensiveDiastolicMax: Number(event.target.value) || 1 })} /></label>
                    <label>Hypertensive systolic min<input aria-label="Hypertensive systolic minimum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.hypertensiveSystolicMin ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.hypertensiveSystolicMin} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), hypertensiveSystolicMin: Number(event.target.value) || 1 })} /></label>
                    <label>Hypertensive diastolic min<input aria-label="Hypertensive diastolic minimum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.hypertensiveDiastolicMin ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.hypertensiveDiastolicMin} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), hypertensiveDiastolicMin: Number(event.target.value) || 1 })} /></label>
                    <label>Danger systolic min<input aria-label="Danger systolic minimum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.dangerSystolicMin ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.dangerSystolicMin} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), dangerSystolicMin: Number(event.target.value) || 1 })} /></label>
                    <label>Danger diastolic min<input aria-label="Danger diastolic minimum" type="number" min="1" value={draftNote.bloodPressureAlertLevels?.dangerDiastolicMin ?? DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS.dangerDiastolicMin} onChange={(event) => updateProperty('bloodPressureAlertLevels', { ...(draftNote.bloodPressureAlertLevels || DEFAULT_BLOOD_PRESSURE_ALERT_LEVELS), dangerDiastolicMin: Number(event.target.value) || 1 })} /></label>
                  </div>
                </div>}
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
      event.stopPropagation();
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
    const selectionStart = event.currentTarget.selectionStart ?? lastCaretPositionRef.current;
    const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
    const cursorPosition = selectionStart;
    lastCaretPositionRef.current = cursorPosition;
    const currentValue = event.currentTarget.value || draftSummary;
    const entries = [...currentValue.matchAll(/#\d{1,2}(?:\([^)]*\))?[^,]*(?=,|$)/g)];
    const entry = entries.find((match) => selectionStart < match.index + match[0].length && selectionEnd > match.index)
      || entries.find((match) => cursorPosition >= match.index && cursorPosition <= match.index + match[0].length)
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

  function handleClassKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveClass(event);
    }
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
            <form onSubmit={saveClass} onKeyDown={handleClassKeyDown}>
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
  const componentsMap = Object.fromEntries(note.sections.flatMap((section) => section.elements).map((element) => [element.id, element]));
  const normalizedLayout = layout.flatMap((element) => {
    const component = componentsMap[element.id];
    if (component?.moduleKind !== 'oap' || element.field) return [element];
    return OAP_FIELDS.map(({ id, label }) => ({
      id: `${component.id}:${id}`,
      type: 'oap',
      componentId: component.id,
      field: id,
      label: `${component.externalLabel || component.label} - ${label}`,
      order: element.order,
    }));
  });
  const [draftLayout, setDraftLayout] = useState(() => normalizedLayout.sort((left, right) => left.order - right.order));
  const [draggedId, setDraggedId] = useState(null);
  const [returnCount, setReturnCount] = useState(0);
  const [spaceCount, setSpaceCount] = useState(0);
  const [textLabel, setTextLabel] = useState('');

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

  function handleKeyDown(event) {
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveLayout();
    }
  }

  function addFormattingElement(type, count) {
    const safeCount = Math.max(0, Number(count) || 0);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const label = type === 'return' ? `Return x${safeCount}` : `Space x${safeCount}`;
    setDraftLayout((currentLayout) => [...currentLayout, { id, type, count: safeCount, label, order: currentLayout.length + 1 }]);
  }

  function addTextLabel() {
    const value = textLabel.trim();
    if (!value) return;
    const id = `label-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setDraftLayout((currentLayout) => [...currentLayout, { id, type: 'label', label: value, order: currentLayout.length + 1 }]);
    setTextLabel('');
  }

  function updateFormattingElement(id, count) {
    const safeCount = Math.max(0, Number(count) || 0);
    setDraftLayout((currentLayout) => currentLayout.map((element) => (
      element.id === id
        ? { ...element, count: safeCount, label: `${element.type === 'return' ? 'Return' : 'Space'} x${safeCount}` }
        : element
    )));
  }

  function toggleElementHidden(id) {
    setDraftLayout((currentLayout) => currentLayout.map((element) => (
      element.id === id ? { ...element, hidden: !element.hidden } : element
    )));
  }

  function updateElementSpacing(id, property, value) {
    const safeValue = Math.max(0, Number(value) || 0);
    setDraftLayout((currentLayout) => currentLayout.map((element) => (
      element.id === id ? { ...element, [property]: safeValue } : element
    )));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="editor-modal layout-modal" role="dialog" aria-modal="true" aria-labelledby="layout-title" onKeyDown={handleKeyDown}>
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
            <div className="layout-formatting-control">
              <label className="field-label" htmlFor="text-label">Text label</label>
              <input id="text-label" value={textLabel} onChange={(event) => setTextLabel(event.target.value)} placeholder="e.g. Problem list" />
              <button type="button" className="secondary-button" onClick={addTextLabel}>Add label</button>
            </div>
          </div>
          <div className="layout-list" aria-label="Output layout elements">
            {draftLayout.map((element, index) => {
              const component = componentsMap[element.componentId || element.id];
              const external = element.type === 'oap'
                ? `${component?.externalLabel || component?.label || element.componentId} - ${OAP_FIELDS.find((field) => field.id === element.field)?.label || element.field}`
                : component?.externalLabel ?? element.externalLabel ?? element.label;
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
                ) : element.type === 'label' ? (
                  <label className="layout-element-label">
                    <input aria-label={`Text label ${index + 1}`} value={element.label} onChange={(event) => setDraftLayout((currentLayout) => currentLayout.map((item) => item.id === element.id ? { ...item, label: event.target.value } : item))} onClick={(event) => event.stopPropagation()} />
                  </label>
                ) : <span className="layout-element-label">{external}</span>}
                <div className="layout-element-hidden">
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Hide ${element.type === 'return' ? 'Returns' : element.type === 'space' ? 'Spaces' : element.type === 'label' ? (element.label || 'label') : external}`}
                      checked={Boolean(element.hidden)}
                      onChange={() => toggleElementHidden(element.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span>Hidden</span>
                  </label>
                </div>
                {element.type !== 'return' && element.type !== 'space' && (
                  <div className="layout-element-spacing">
                    <label>Returns before<input aria-label={`Returns before ${external}`} type="number" min="0" value={element.returnsBefore ?? 0} onChange={(event) => updateElementSpacing(element.id, 'returnsBefore', event.target.value)} onClick={(event) => event.stopPropagation()} /></label>
                    <label>Spaces before<input aria-label={`Spaces before ${external}`} type="number" min="0" value={element.spacesBefore ?? 0} onChange={(event) => updateElementSpacing(element.id, 'spacesBefore', event.target.value)} onClick={(event) => event.stopPropagation()} /></label>
                  </div>
                )}
                {element.type === 'return' || element.type === 'space' || element.type === 'label' ? <button type="button" className="icon-button layout-remove-button" onClick={() => setDraftLayout((currentLayout) => currentLayout.filter((item) => item.id !== element.id))} aria-label={`Remove ${element.type}`}>×</button> : null}
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

function ModuleCard({ component, isArrangeMode, onDragStart, onDrop, onToggleLock, onEdit, onUpdate, onProperties }) {
  const diastolicInputRef = useRef(null);

  function updateBloodPressure(field, event) {
    onUpdate(component.id, (currentComponent) => ({ ...currentComponent, [field]: event.target.value }));
    if (field === 'systolic' && event.target.value.length >= 3) {
      diastolicInputRef.current?.focus();
    }
  }

  return (
      <article
      className={`text-element ${component.text ? '' : 'is-empty'} ${isArrangeMode ? 'is-arrangeable' : ''} ${component.layoutLocked ? 'is-locked' : ''} ${component.moduleKind === 'bloodPressure' ? `bp-status-${getBloodPressureStatus(component.systolic, component.diastolic, component.bloodPressureAlertLevels)}` : ''}`}
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
      onClick={() => { if (!isArrangeMode && !['bloodPressure', 'painScale'].includes(component.moduleKind)) onEdit(component.id); }}
    >
      {isArrangeMode && <button type="button" className="module-lock-button" onClick={() => onToggleLock(component.id)} aria-label={`${component.layoutLocked ? 'Unlock' : 'Lock'} ${component.externalLabel || component.label}`} title={component.layoutLocked ? 'Unlock module' : 'Lock module'}>{component.layoutLocked ? 'Locked' : 'Lock'}</button>}
      <div className="module-card-header">
        <div className="element-label">{component.externalLabel || component.label}</div>
        {!isArrangeMode && !['bloodPressure', 'painScale'].includes(component.moduleKind) && (
          <button type="button" className="edit-module-button" onClick={(event) => { event.stopPropagation(); onEdit(component.id); }} aria-label={`Edit ${component.externalLabel || component.label}`}>Edit content</button>
        )}
      </div>
      {component.moduleKind === 'bloodPressure' ? (
        <div className="blood-pressure-inline" onClick={(event) => event.stopPropagation()}>
          <div className="blood-pressure-inline-inputs">
            <input aria-label={`${component.externalLabel || component.label} systolic`} type="number" min="1" value={component.systolic || ''} onChange={(event) => updateBloodPressure('systolic', event)} placeholder="120" />
            <span>/</span>
            <input ref={diastolicInputRef} aria-label={`${component.externalLabel || component.label} diastolic`} type="number" min="1" value={component.diastolic || ''} onChange={(event) => updateBloodPressure('diastolic', event)} placeholder="80" />
            <span>mmHg</span>
          </div>
        </div>
      ) : component.moduleKind === 'painScale' ? (
        <div className="pain-scale-inline" onClick={(event) => event.stopPropagation()}>
          <input
            aria-label={`${component.externalLabel || component.label} pain score`}
            type="range"
            min="0"
            max="10"
            step="1"
            value={component.painScore ?? 0}
            onChange={(event) => onUpdate(component.id, (currentComponent) => ({ ...currentComponent, painScore: Number(event.target.value) }))}
          />
          <output>{component.painScore ?? 0}/10</output>
        </div>
      ) : component.moduleKind === 'alert' ? (
        <p className="alert-inline-summary">Alert: {getAlertSummary(component)}</p>
      ) : component.moduleKind === 'treatmentPlan' ? (
        <p className="treatment-plan-inline-summary">OAP treatment plans</p>
      ) : component.moduleKind === 'localAnesthetic' ? (
        <p className="local-anesthetic-summary">{getAnestheticSummary(component.anestheticEntries, component.topicalAnesthetic) || 'No anesthetic recorded.'}</p>
      ) : <p>{component.text || 'No text added to this component yet.'}</p>}
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
  function formatTreatmentPlanOutput(component) {
    const allRows = getTreatmentPlanRows(note);
    const savedOrder = component.treatmentPlanOrder || [];
    const orderedRows = [...savedOrder.map((id) => allRows.find((row) => row.id === id)).filter(Boolean), ...allRows.filter((row) => !savedOrder.includes(row.id))];
    const classes = [3, 2, 1].map((classification) => {
      const classRows = orderedRows.filter((row) => row.classification === classification);
      if (!classRows.length) return '';
      return `CLASS ${classification}:\n${classRows.map((row, index) => `     ${index + 1}) ${row.plan.replaceAll('\n', ' ')}`).join('\n')}`;
    }).filter(Boolean);
    return `${component.externalLabel || component.label}${classes.length ? `\n${classes.join('\n')}` : ''}`;
  }
  const generatedOutput = orderedLayout
    .filter((element) => !element.hidden)
    .map((element) => {
      const spacingBefore = `${'\n'.repeat(Math.max(0, Number(element.returnsBefore) || 0))}${' '.repeat(Math.max(0, Number(element.spacesBefore) || 0))}`;
      if (element.type === 'return') return '\n'.repeat(Math.max(0, Number(element.count) || 0));
      if (element.type === 'space') return ' '.repeat(Math.max(0, Number(element.count) || 0));
      if (element.type === 'label') return `${spacingBefore}${element.label || ''}`;
      const textComponent = textComponents[element.id];
      const oapComponent = textComponents[element.componentId];
      const internalLabel = element.internalLabel ?? textComponent?.internalLabel ?? element.label;

      if (element.type === 'oap' && oapComponent) {
        if (element.field === 'plan') return '';
        const field = OAP_FIELDS.find((item) => item.id === element.field);
        const content = oapComponent[element.field]?.trim() || 'None.';
        const categoryTitle = CLINICAL_CATEGORIES[oapComponent.category]?.label || oapComponent.category;
        return `${spacingBefore}${categoryTitle} ${field?.label || element.field}: ${content}`;
      }

      if (textComponent?.moduleKind === 'bloodPressure') {
        const content = textComponent.systolic && textComponent.diastolic
          ? `${textComponent.systolic}/${textComponent.diastolic} mmHg`
          : 'No reading recorded.';
        return `${spacingBefore}${internalLabel}: ${content}`;
      }

      if (textComponent?.moduleKind === 'painScale') {
        const content = `${textComponent.painScore ?? 0}/10`;
        return `${spacingBefore}${internalLabel?.trim() ? `${internalLabel}: ` : ''}${content}`;
      }

      if (textComponent?.moduleKind === 'alert') {
        return `${spacingBefore}Alert: ${getAlertSummary(textComponent)}`;
      }

      if (textComponent?.moduleKind === 'treatmentPlan') return `${spacingBefore}${formatTreatmentPlanOutput(textComponent)}`;

      if (textComponent?.moduleKind === 'localAnesthetic') {
        const content = getAnestheticSummary(textComponent.anestheticEntries, textComponent.topicalAnesthetic);
        return content ? `${spacingBefore}${internalLabel?.trim() ? `${internalLabel}: ` : ''}${content}` : '';
      }

      // Charting components: show content directly without label
      if (element.id === 'caries' || element.id === 'incipientCaries') {
        const summary = summaries[element.id] || '';
        return `${spacingBefore}${summary.trim() || 'None.'}`;
      }

      // Completed: show summary or text content directly without label
      if (element.id === 'completed') {
        const summary = summaries[element.id] || '';
        const text = textComponent?.text?.trim() || '';
        if (!summary.trim() && !text) return '';
        const content = text || summary || 'None.';
        return `${spacingBefore}${content}`;
      }

      if (textComponent?.moduleKind === 'oap') {
        const entries = OAP_FIELDS
          .filter(({ id }) => id !== 'plan')
          .map(({ id, label }) => textComponent[id]?.trim() ? `${label}: ${textComponent[id].trim()}` : '')
          .filter(Boolean);
        return entries.length ? `${spacingBefore}${internalLabel}: ${entries.join('\n')}` : '';
      }

      // Default behavior for labeled modules: internal label, then content on same line, no returns
      const content = textComponent ? (textComponent.text || 'No text added.') : (summaries[element.id] || 'No findings recorded.');
      return `${spacingBefore}${internalLabel}: ${content}`;
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
        <button type="button" className="reset-button" onClick={() => onReset?.()} aria-label="Reset content">Reset content</button>
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
      </div>
    </section>
  );
}

function SavedNotes({ savedNotes, technicianName, onRestore, isOpen }) {
  if (!isOpen) return null;

  return (
    <section className="saved-notes" aria-labelledby="saved-notes-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Local history</p>
          <h2 id="saved-notes-title">Saved states</h2>
        </div>
        <span className="saved-notes-count">{savedNotes.length} saved</span>
      </div>
      <div className="saved-notes-list">
        {savedNotes.slice(0, 20).map((savedNote) => (
          <button type="button" className="saved-note" key={savedNote.id} onClick={() => onRestore(savedNote.note)} aria-label={`Saved note: ${savedNote.technicianName || technicianName || 'Technician'} at ${new Date(savedNote.savedAt).toLocaleString()}`}>
            <span className="saved-note-label">{savedNote.technicianName || technicianName || 'Technician'} · Local note</span>
            <time dateTime={savedNote.savedAt}>{new Date(savedNote.savedAt).toLocaleString()}</time>
          </button>
        ))}
      </div>
    </section>
  );
}

// Top-level application state and persistence boundary for the prototype.
function App() {
  const [techName, setTechName] = useState(loadTechName);
  const [authUser, setAuthUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSavedNotesOpen, setIsSavedNotesOpen] = useState(true);
  const [note, setNote] = useState(loadNote);
  const [savedNotes, setSavedNotes] = useState(loadSavedNotes);
  const [cloudNotes, setCloudNotes] = useState([]);
  const [cloudStatus, setCloudStatus] = useState('idle');
  const [layoutPreferences, setLayoutPreferences] = useState(loadCachedLayoutPreferences);
  const [layoutPreferencesStatus, setLayoutPreferencesStatus] = useState('idle');
  const [isCloudLayoutsOpen, setIsCloudLayoutsOpen] = useState(false);
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

  async function fetchLayoutPreferences() {
    setLayoutPreferencesStatus('loading');
    try {
      const snapshot = await getDocs(layoutPreferencesCollection);
      const prefs = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      setLayoutPreferences(prefs);
      try {
        window.localStorage.setItem(layoutPreferencesStorageKey, JSON.stringify(prefs));
      } catch {
        // Ignore local storage quota errors
      }
      setLayoutPreferencesStatus('loaded');
      logFirebase('Loaded layout preferences from Firestore', { count: prefs.length });
    } catch (error) {
      setLayoutPreferencesStatus('error');
      // If permission is not yet granted in Firestore rules or user is offline, use cached preferences
      const cached = loadCachedLayoutPreferences();
      if (cached.length > 0) {
        setLayoutPreferences(cached);
      }
      logFirebase('Using local layout preferences (Firestore read pending rules update or offline)', error?.message);
    }
  }

  useEffect(() => {
    fetchLayoutPreferences();
  }, []);

  function applyPreferences(prefData, title = '') {
    if (!prefData) return;
    const preferences = prefData.preferences || prefData;
    if (Array.isArray(preferences.snippets)) {
      setSnippets(preferences.snippets);
    }
    if (preferences.note) {
      setNote((currentNote) => createNote({
        ...currentNote,
        ...preferences.note,
        teeth: createToothRegistry(),
        incipientCaries: createToothRegistry(),
        completed: createToothRegistry(),
      }));
    }
    setToastMessage(title ? `Applied layout: ${title}` : 'Applied layout preference');
    setTimeout(() => setToastMessage(null), 2000);
  }

  async function saveLayoutPreference({ title, source, jsonFileContent, rawJsonText }) {
    if (!authUser) {
      throw new Error('You must be signed in as a doctor to save layout preferences to Firestore.');
    }
    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      throw new Error('Please provide a title name for the preference.');
    }
    if (cleanTitle.length > 100) {
      throw new Error('Title must be 100 characters or fewer.');
    }

    let prefPayload = null;
    if (source === 'current') {
      prefPayload = {
        schemaVersion: 1,
        snippets,
        note: {
          layout: note.layout,
          interfaceLayout: note.interfaceLayout,
          sections: note.sections,
        },
      };
    } else if (source === 'file') {
      if (!jsonFileContent) throw new Error('Please select a valid JSON file.');
      prefPayload = typeof jsonFileContent === 'string' ? JSON.parse(jsonFileContent) : jsonFileContent;
    } else if (source === 'paste') {
      if (!rawJsonText?.trim()) throw new Error('Please enter or paste JSON preference content.');
      prefPayload = JSON.parse(rawJsonText);
    }

    if (!prefPayload || typeof prefPayload !== 'object') {
      throw new Error('Invalid preferences payload structure.');
    }

    const doctorName = authUser.displayName || authUser.email?.split('@')[0] || 'Doctor';
    const now = new Date().toISOString();
    const existing = layoutPreferences.find((p) => p.title.trim().toLowerCase() === cleanTitle.toLowerCase());

    const docData = {
      title: cleanTitle,
      preferences: prefPayload,
      userId: authUser.uid,
      createdBy: authUser.email || doctorName,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    };

    if (existing) {
      const prefDocRef = doc(firestore, 'layoutPreferences', existing.id);
      await setDoc(prefDocRef, docData);
      logFirebase('Overwrote layout preference in Firestore', { id: existing.id, title: cleanTitle });
      const updated = layoutPreferences.map((p) => (p.id === existing.id ? { ...docData, id: existing.id } : p));
      setLayoutPreferences(updated);
      window.localStorage.setItem(layoutPreferencesStorageKey, JSON.stringify(updated));
    } else {
      const newDoc = await addDoc(layoutPreferencesCollection, docData);
      logFirebase('Created new layout preference in Firestore', { id: newDoc.id, title: cleanTitle });
      const updated = [...layoutPreferences, { ...docData, id: newDoc.id }].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      setLayoutPreferences(updated);
      window.localStorage.setItem(layoutPreferencesStorageKey, JSON.stringify(updated));
    }

    try {
      await fetchLayoutPreferences();
    } catch {
      // Ignored if handled locally
    }
  }

  async function deleteLayoutPreference(prefId) {
    if (!authUser) {
      throw new Error('You must be signed in as a doctor to delete layout preferences.');
    }
    const prefDocRef = doc(firestore, 'layoutPreferences', prefId);
    await deleteDoc(prefDocRef);
    logFirebase('Deleted layout preference from Firestore', { id: prefId });
    const updated = layoutPreferences.filter((p) => p.id !== prefId);
    setLayoutPreferences(updated);
    window.localStorage.setItem(layoutPreferencesStorageKey, JSON.stringify(updated));
    try {
      await fetchLayoutPreferences();
    } catch {
      // Ignored if handled locally
    }
  }

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setAuthUser(user);
    if (user && !techName) {
      const name = user.displayName || user.email?.split('@')[0] || 'Doctor';
      window.localStorage.setItem(techNameStorageKey, name);
      setTechName(name);
    }
    logFirebase(user ? 'Authenticated user detected' : 'Signed-out mode: Firestore archive disabled', user?.email);
  }), [techName]);

  function continueToWorkspace(name, selectedPref = null) {
    window.localStorage.setItem(techNameStorageKey, name);
    setTechName(name);
    if (selectedPref) {
      applyPreferences(selectedPref, selectedPref.title);
    }
  }

  function handleAuthenticated(user) {
    setAuthUser(user);
    if (!techName) continueToWorkspace(user.displayName || user.email?.split('@')[0] || 'Doctor');
  }

  useEffect(() => {
    window.localStorage.setItem(snippetsStorageKey, JSON.stringify(snippets));
  }, [snippets]);

  useEffect(() => {
    window.localStorage.setItem(noteStorageKey, JSON.stringify(note));
  }, [note]);

  useEffect(() => {
    window.localStorage.setItem(savedNotesStorageKey, JSON.stringify(savedNotes));
  }, [savedNotes]);

  useEffect(() => {
    let isCurrent = true;
    if (!authUser) return undefined;
    setCloudStatus('loading');
    async function loadCloudArchive() {
      try {
        const archiveQuery = query(archivedNotesCollection, where('userId', '==', authUser.uid), limit(50));
        const snapshot = await getDocs(archiveQuery);
        const loadedCloudNotes = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
        if (isCurrent) {
          setCloudNotes(loadedCloudNotes);
          setCloudStatus('loaded');
        }
        logFirebase('Loaded archived notes for authenticated Doctor', { count: loadedCloudNotes.length, userId: authUser.uid });
      } catch (error) {
        if (isCurrent) setCloudStatus('error');
        logFirebaseError('Could not load authenticated Doctor cloud records; local records remain available', error);
      }
    }
    loadCloudArchive();
    return () => { isCurrent = false; };
  }, [authUser]);

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
    const savedAt = new Date().toISOString();
    const activeTechnicianName = authUser
      ? (authUser.displayName || authUser.email?.split('@')[0] || 'Doctor')
      : (techName?.trim() || 'Staff');
    const archiveEntry = { id: `saved-note-${Date.now()}`, savedAt, technicianName: activeTechnicianName, note: structuredClone(note) };
    setSavedNotes((currentSavedNotes) => [
      archiveEntry,
      ...currentSavedNotes,
    ]);
    if (authUser) {
      addDoc(archivedNotesCollection, { savedAt, userId: authUser.uid, technicianName: activeTechnicianName, note: archiveEntry.note })
        .then((document) => {
          setCloudNotes((currentCloudNotes) => [{ ...archiveEntry, id: document.id }, ...currentCloudNotes]);
          logFirebase('Archived note after reset', { documentId: document.id, savedAt, technicianName: activeTechnicianName });
        })
        .catch((error) => logFirebaseError('Could not archive note in Firestore; local archive retained', error));
    }
    setNote((currentNote) => {
      const clearedSections = currentNote.sections.map((section) => ({
        ...section,
        elements: section.elements.map((element) => ({
          ...element,
          text: element.type === 'text' ? '' : element.text,
          observation: element.moduleKind === 'oap' ? '' : element.observation,
          assessment: element.moduleKind === 'oap' ? '' : element.assessment,
          plan: element.moduleKind === 'oap' ? '' : element.plan,
          planClassifications: element.moduleKind === 'oap' ? [] : element.planClassifications,
          systolic: element.moduleKind === 'bloodPressure' ? '' : element.systolic,
          diastolic: element.moduleKind === 'bloodPressure' ? '' : element.diastolic,
          painScore: element.moduleKind === 'painScale' ? 0 : element.painScore,
          alertAllergies: element.moduleKind === 'alert' ? [] : element.alertAllergies,
          alertConditions: element.moduleKind === 'alert' ? [] : element.alertConditions,
          pregnancyTrimester: element.moduleKind === 'alert' ? '' : element.pregnancyTrimester,
          alertCustomText: element.moduleKind === 'alert' ? '' : element.alertCustomText,
          alertNone: element.moduleKind === 'alert' ? true : element.alertNone,
          anestheticEntries: element.moduleKind === 'localAnesthetic'
            ? Object.fromEntries(LOCAL_ANESTHETICS.map(({ id }) => [id, 0]))
            : element.anestheticEntries,
          topicalAnesthetic: element.moduleKind === 'localAnesthetic' ? true : element.topicalAnesthetic,
        })),
      }));
      return {
        ...currentNote,
        sections: clearedSections,
        teeth: createToothRegistry(),
        incipientCaries: createToothRegistry(),
        completed: createToothRegistry(),
      };
    });
    setSelectedToothId(null);
    setEditingComponentId(null);
    setEditingPropertiesComponentId(null);
  }

  function restoreSavedNote(savedNote) {
    setNote(createNote(savedNote));
    setSelectedToothId(null);
    setToastMessage('Saved state restored');
    setTimeout(() => setToastMessage(null), 1800);
  }

  async function signOutDoctor() {
    resetContent();
    await signOut(auth);
    setAuthUser(null);
    setTechName('');
    window.localStorage.removeItem(techNameStorageKey);
    setIsAuthOpen(false);
    setIsSavedNotesOpen(false);
  }

  function signOutTechnician() {
    resetContent();
    setTechName('');
    window.localStorage.removeItem(techNameStorageKey);
    setIsSavedNotesOpen(false);
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

  function addTextModule({ category, label, moduleKind }) {
    const component = createTextComponent({ category, label, moduleKind });
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

  if (!techName) {
    return (
      <>
        <WelcomeScreen
          initialTechName={techName}
          onContinue={continueToWorkspace}
          onDoctorLogin={() => setIsAuthOpen(true)}
          layoutPreferences={layoutPreferences}
          layoutPreferencesStatus={layoutPreferencesStatus}
          onRefreshPreferences={fetchLayoutPreferences}
        />
        {isAuthOpen && (
          <AuthModal
            user={authUser}
            cloudNotes={cloudNotes}
            cloudStatus={cloudStatus}
            onRestoreCloudNote={restoreSavedNote}
            onOpenCloudLayouts={() => setIsCloudLayoutsOpen(true)}
            onClose={() => setIsAuthOpen(false)}
            onAuthenticated={handleAuthenticated}
            onSignedOut={signOutDoctor}
          />
        )}
        {isCloudLayoutsOpen && (
          <CloudLayoutsModal
            isOpen={isCloudLayoutsOpen}
            onClose={() => setIsCloudLayoutsOpen(false)}
            layoutPreferences={layoutPreferences}
            layoutPreferencesStatus={layoutPreferencesStatus}
            onRefreshPreferences={fetchLayoutPreferences}
            onSavePreference={saveLayoutPreference}
            onDeletePreference={deleteLayoutPreference}
            onApplyPreference={(pref) => applyPreferences(pref, pref.title)}
            currentNote={note}
            currentSnippets={snippets}
            authUser={authUser}
          />
        )}
      </>
    );
  }

  return (
    <main className="app-shell" onContextMenuCapture={(event) => event.preventDefault()}>
      <header className="app-header">
        <div>
          <p className="eyebrow">DentalNoteMaker / prototype</p>
          <h1>Clinical note</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={() => setIsCloudLayoutsOpen(true)}>Cloud Layouts</button>
          <button type="button" className="secondary-button" onClick={exportPreferences}>Export JSON</button>
          <label className="secondary-button file-button">Import JSON<input type="file" accept="application/json" onChange={importPreferences} /></label>
          <button type="button" className="secondary-button" onClick={() => setIsLayoutOpen(true)}>Layout</button>
          <button type="button" className={`secondary-button ${isArrangeMode ? 'is-active' : ''}`} onClick={() => setIsArrangeMode((current) => !current)}>{isArrangeMode ? 'Lock layout' : 'Arrange modules'}</button>
          <button type="button" className="primary-button" onClick={() => setIsTextModuleOpen(true)}>+ Add module</button>
          <button type="button" className="secondary-button" onClick={() => setIsSavedNotesOpen((current) => !current)}>{isSavedNotesOpen ? 'Hide records' : 'Past 20 records'}</button>
          <button type="button" className="auth-status" onClick={() => setIsAuthOpen(true)} aria-label={authUser ? `${techName} · Account ${authUser.email}` : `${techName} · Log in or create account`}>
            <span className="auth-status-name">{techName}</span>
            <span className="auth-status-detail">{authUser ? authUser.email : 'Local only · Log in'}</span>
          </button>
          {!authUser && <button type="button" className="secondary-button" onClick={signOutTechnician}>Log off Tech</button>}
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
            <ModuleCard key={component.id} component={component} isArrangeMode={isArrangeMode} onDragStart={setDraggedModuleId} onDrop={updateModuleOrder} onToggleLock={(id) => updateTextComponent(id, (item) => ({ ...item, layoutLocked: !item.layoutLocked }))} onEdit={setEditingComponentId} onUpdate={updateTextComponent} onProperties={setEditingPropertiesComponentId} />
          ))}
        </section>
      )}

      <OutputPreview layout={note.layout} note={note} onReset={resetContent} onCopy={() => copyToClipboard()} />
      <SavedNotes savedNotes={savedNotes} technicianName={techName} onRestore={restoreSavedNote} isOpen={isSavedNotesOpen} />

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

      {isAuthOpen && (
        <AuthModal
          user={authUser}
          cloudNotes={cloudNotes}
          cloudStatus={cloudStatus}
          onRestoreCloudNote={restoreSavedNote}
          onOpenCloudLayouts={() => setIsCloudLayoutsOpen(true)}
          onClose={() => setIsAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
          onSignedOut={signOutDoctor}
        />
      )}

      {isCloudLayoutsOpen && (
        <CloudLayoutsModal
          isOpen={isCloudLayoutsOpen}
          onClose={() => setIsCloudLayoutsOpen(false)}
          layoutPreferences={layoutPreferences}
          layoutPreferencesStatus={layoutPreferencesStatus}
          onRefreshPreferences={fetchLayoutPreferences}
          onSavePreference={saveLayoutPreference}
          onDeletePreference={deleteLayoutPreference}
          onApplyPreference={(pref) => applyPreferences(pref, pref.title)}
          currentNote={note}
          currentSnippets={snippets}
          authUser={authUser}
        />
      )}

      {editingComponentId && (() => {
        const component = textComponents.find((item) => item.id === editingComponentId);
        if (!component) return null;
        return component.moduleKind === 'treatmentPlan' ? (
          <TreatmentPlanModal
            note={note}
            treatmentPlan={component}
            onCancel={() => setEditingComponentId(null)}
            onUpdateOap={updateTextComponent}
            onUpdateTreatmentPlan={updateTextComponent}
            onDeleteCaries={(toothIds) => setNote((currentNote) => ({ ...currentNote, teeth: Object.fromEntries(Object.entries(currentNote.teeth).map(([id, tooth]) => toothIds.includes(id) ? [id, { ...tooth, surfaces: [], notes: '', restoration: '', classification: 2 }] : [id, tooth])) }))}
          />
        ) : component.moduleKind === 'localAnesthetic' ? (
          <LocalAnestheticModal
            component={component}
            onCancel={() => setEditingComponentId(null)}
            onSave={(values) => {
              updateTextComponent(component.id, (currentComponent) => ({ ...currentComponent, ...values }));
              setEditingComponentId(null);
            }}
          />
        ) : component.moduleKind === 'bloodPressure' ? (
          <BloodPressureModal
            component={component}
            onCancel={() => setEditingComponentId(null)}
            onSave={(values) => {
              updateTextComponent(component.id, (currentComponent) => ({ ...currentComponent, ...values }));
              setEditingComponentId(null);
            }}
          />
        ) : component.moduleKind === 'oap' ? (
          <OapEditorModal
            component={component}
            onCancel={() => setEditingComponentId(null)}
            onSave={(values) => {
              updateTextComponent(component.id, (currentComponent) => ({ ...currentComponent, ...values }));
              setEditingComponentId(null);
            }}
          />
        ) : component.moduleKind === 'alert' ? (
          <AlertModal
            component={component}
            onCancel={() => setEditingComponentId(null)}
            onSave={(values) => {
              updateTextComponent(component.id, (currentComponent) => ({ ...currentComponent, ...values }));
              setEditingComponentId(null);
            }}
          />
        ) : (
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
