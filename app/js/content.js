// Static content in Greek and English. Exercises and prompts are drafts and
// should be reviewed by a psychologist (see open decisions in docs/spec.md).

// Two-level emotion list: family → finer emotion.
export const EMOTION_FAMILIES = [
  {
    key: 'joy', el: 'Χαρά', en: 'Joy', color: '#e9c46a',
    children: [
      ['content', 'Ικανοποίηση', 'Contentment'],
      ['grateful', 'Ευγνωμοσύνη', 'Gratitude'],
      ['proud', 'Περηφάνια', 'Pride'],
      ['hopeful', 'Ελπίδα', 'Hope'],
      ['excited', 'Ενθουσιασμός', 'Excitement'],
      ['loved', 'Αγάπη', 'Feeling loved'],
    ],
  },
  {
    key: 'calm', el: 'Ηρεμία', en: 'Calm', color: '#8ab6a9',
    children: [
      ['relaxed', 'Χαλάρωση', 'Relaxed'],
      ['safe', 'Ασφάλεια', 'Safe'],
      ['relieved', 'Ανακούφιση', 'Relief'],
      ['present', 'Παρουσία', 'Present'],
    ],
  },
  {
    key: 'sadness', el: 'Λύπη', en: 'Sadness', color: '#7d9cc4',
    children: [
      ['lonely', 'Μοναξιά', 'Loneliness'],
      ['disappointed', 'Απογοήτευση', 'Disappointment'],
      ['grief', 'Πένθος', 'Grief'],
      ['hopeless', 'Απελπισία', 'Hopelessness'],
      ['empty', 'Κενό', 'Emptiness'],
      ['hurt', 'Πληγωμένος/η', 'Hurt'],
    ],
  },
  {
    key: 'fear', el: 'Φόβος', en: 'Fear', color: '#a99bc9',
    children: [
      ['anxious', 'Άγχος', 'Anxiety'],
      ['worried', 'Ανησυχία', 'Worry'],
      ['insecure', 'Ανασφάλεια', 'Insecurity'],
      ['overwhelmed', 'Υπερφόρτωση', 'Overwhelmed'],
      ['panic', 'Πανικός', 'Panic'],
    ],
  },
  {
    key: 'anger', el: 'Θυμός', en: 'Anger', color: '#d48c84',
    children: [
      ['frustrated', 'Εκνευρισμός', 'Frustration'],
      ['irritated', 'Ενόχληση', 'Irritation'],
      ['resentful', 'Πικρία', 'Resentment'],
      ['jealous', 'Ζήλια', 'Jealousy'],
    ],
  },
  {
    key: 'shame', el: 'Ντροπή', en: 'Shame', color: '#c4a484',
    children: [
      ['guilty', 'Ενοχή', 'Guilt'],
      ['embarrassed', 'Αμηχανία', 'Embarrassment'],
      ['inadequate', 'Ανεπάρκεια', 'Inadequacy'],
    ],
  },
  {
    key: 'tired', el: 'Κούραση', en: 'Tiredness', color: '#a8a8a0',
    children: [
      ['exhausted', 'Εξάντληση', 'Exhaustion'],
      ['numb', 'Μούδιασμα', 'Numbness'],
      ['bored', 'Βαρεμάρα', 'Boredom'],
    ],
  },
];

// Flat lookup: id → {id, el, en, family, color}
export const EMOTIONS = {};
for (const f of EMOTION_FAMILIES) {
  EMOTIONS[f.key] = { id: f.key, el: f.el, en: f.en, family: f.key, color: f.color };
  for (const [id, el, en] of f.children) EMOTIONS[id] = { id, el, en, family: f.key, color: f.color };
}

export const PROMPTS = [
  { theme: 'day', el: 'Τι σε απασχόλησε περισσότερο σήμερα;', en: 'What took up most of your mind today?' },
  { theme: 'day', el: 'Μια στιγμή της ημέρας που θέλεις να θυμάσαι.', en: 'One moment from today you want to remember.' },
  { theme: 'self', el: 'Τι χρειάζεσαι αυτή τη στιγμή και δεν το έχεις;', en: 'What do you need right now that you do not have?' },
  { theme: 'self', el: 'Τι θα έλεγες σε έναν φίλο που ένιωθε όπως εσύ τώρα;', en: 'What would you tell a friend who felt the way you do now?' },
  { theme: 'self', el: 'Ποια σκέψη επαναλαμβάνεται στο μυαλό σου τελευταία;', en: 'Which thought keeps coming back lately?' },
  { theme: 'relations', el: 'Ποιος σε έκανε να νιώσεις καλά πρόσφατα, και πώς;', en: 'Who made you feel good recently, and how?' },
  { theme: 'relations', el: 'Υπάρχει κάτι που δεν έχεις πει σε κάποιον;', en: 'Is there something you have not said to someone?' },
  { theme: 'growth', el: 'Τι έμαθες για τον εαυτό σου αυτή την εβδομάδα;', en: 'What did you learn about yourself this week?' },
  { theme: 'growth', el: 'Ένα μικρό βήμα που μπορείς να κάνεις αύριο.', en: 'One small step you can take tomorrow.' },
  { theme: 'body', el: 'Πώς νιώθει το σώμα σου τώρα; Πού κρατάς ένταση;', en: 'How does your body feel now? Where are you holding tension?' },
];

export const PROMPT_THEMES = {
  day: { el: 'Η μέρα μου', en: 'My day' },
  self: { el: 'Ο εαυτός μου', en: 'Myself' },
  relations: { el: 'Σχέσεις', en: 'Relationships' },
  growth: { el: 'Αυτοεξέλιξη', en: 'Growth' },
  body: { el: 'Σώμα', en: 'Body' },
};

export const EXERCISE_CATEGORIES = {
  calm: { el: 'Ηρεμία', en: 'Calm' },
  thoughts: { el: 'Σκέψεις', en: 'Thoughts' },
  growth: { el: 'Αυτοεξέλιξη', en: 'Growth' },
};

// Text exercises are a list of steps; each step is one answer field.
export const EXERCISES = [
  {
    id: 'thought_record',
    category: 'thoughts',
    el: 'Καταγραφή σκέψεων (CBT)',
    en: 'Thought record (CBT)',
    desc: {
      el: 'Γεγονός → σκέψη → συναίσθημα → εναλλακτική σκέψη.',
      en: 'Event → thought → feeling → alternative thought.',
    },
    steps: [
      { key: 'event', el: 'Τι συνέβη; Περιέγραψε το γεγονός σαν κάμερα, χωρίς ερμηνείες.', en: 'What happened? Describe it like a camera would, without interpretation.' },
      { key: 'thought', el: 'Ποια σκέψη πέρασε από το μυαλό σου;', en: 'What thought went through your mind?' },
      { key: 'feeling', el: 'Τι συναίσθημα ένιωσες και πόσο έντονα;', en: 'What did you feel, and how strongly?' },
      { key: 'evidence', el: 'Τι στηρίζει τη σκέψη και τι δεν τη στηρίζει;', en: 'What supports the thought, and what does not?' },
      { key: 'alternative', el: 'Ποια πιο ισορροπημένη σκέψη θα μπορούσε να ισχύει;', en: 'What more balanced thought could also be true?' },
      { key: 'after', el: 'Πώς νιώθεις τώρα;', en: 'How do you feel now?' },
    ],
  },
  {
    id: 'gratitude',
    category: 'growth',
    el: 'Ημερολόγιο ευγνωμοσύνης',
    en: 'Gratitude journal',
    desc: { el: 'Τρία πράγματα, μικρά ή μεγάλα.', en: 'Three things, big or small.' },
    steps: [
      { key: 'g1', el: 'Κάτι για το οποίο νιώθω ευγνωμοσύνη σήμερα…', en: 'Something I am grateful for today…' },
      { key: 'g2', el: 'Κάτι ακόμα…', en: 'Something else…' },
      { key: 'g3', el: 'Και ένα τρίτο…', en: 'And a third…' },
    ],
  },
  {
    id: 'breathing',
    category: 'calm',
    el: 'Αναπνοές',
    en: 'Breathing',
    desc: { el: 'Box breathing ή 4-7-8 με κινούμενο οδηγό.', en: 'Box breathing or 4-7-8 with an animated guide.' },
    breathing: true,
  },
];

// Breathing patterns: phases of [labelKey, seconds, scale target].
export const BREATHING = {
  box: { el: 'Box breathing (4-4-4-4)', en: 'Box breathing (4-4-4-4)', phases: [['inhale', 4, 1], ['hold', 4, 1], ['exhale', 4, 0], ['hold', 4, 0]] },
  '478': { el: '4-7-8', en: '4-7-8', phases: [['inhale', 4, 1], ['hold', 7, 1], ['exhale', 8, 0]] },
};

// Helplines. UNVERIFIED: these must be checked before release and, per the
// spec, eventually served from the server so they can be fixed without a new
// version. `tel` is what the call button dials.
export const HELPLINES = {
  cy: {
    el: 'Κύπρος', en: 'Cyprus',
    lines: [
      { el: 'Έκτακτη ανάγκη', en: 'Emergency', tel: '112' },
      { el: 'Cyprus Samaritans (συναισθηματική στήριξη)', en: 'Cyprus Samaritans (emotional support)', tel: '80007773' },
    ],
  },
  gr: {
    el: 'Ελλάδα', en: 'Greece',
    lines: [
      { el: 'Έκτακτη ανάγκη', en: 'Emergency', tel: '112' },
      { el: 'Γραμμή παρέμβασης για την αυτοκτονία (Κλίμακα)', en: 'Suicide prevention line (Klimaka)', tel: '1018' },
      { el: 'Γραμμή ψυχοκοινωνικής υποστήριξης', en: 'Psychosocial support line', tel: '10306' },
    ],
  },
  intl: {
    el: 'Διεθνείς', en: 'International',
    lines: [
      { el: 'Βρες γραμμή βοήθειας στη χώρα σου', en: 'Find a helpline in your country', url: 'https://findahelpline.com' },
    ],
  },
};

// Gentle detection: if an entry contains one of these, show a discreet SOS
// message. It never blocks, diagnoses or notifies anyone.
export const RISK_WORDS = [
  'αυτοκτον', 'να πεθάνω', 'να πεθανω', 'θέλω να τελειώσει', 'θελω να τελειωσει', 'να μην υπάρχω', 'να μην υπαρχω',
  'αυτοτραυματ', 'να κόψω τον εαυτό', 'δεν αντέχω άλλο', 'δεν αντεχω αλλο',
  'suicid', 'kill myself', 'want to die', 'end my life', 'end it all', 'self-harm', 'self harm', 'hurt myself', 'not be here anymore',
];

export function hasRiskWords(text) {
  const t = (text || '').toLowerCase();
  return RISK_WORDS.some((w) => t.includes(w));
}
