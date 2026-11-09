/**
 * English is the source of truth: its keys define `MessageKey`, so a typo in `t('…')` is a type
 * error, and every other catalog is checked against these keys.
 *
 * Keys are flat, dot-separated by area. `{name}` placeholders are interpolated by `translate`.
 * Scope today: navigation chrome and the Settings/Preferences/Profile screens.
 */
export const en = {
  // Portal and tab navigation
  'nav.dashboard': 'Dashboard',
  'nav.courses': 'Courses',
  'nav.earnings': 'Earnings',
  'nav.settings': 'Settings',
  'nav.reviewQueue': 'Review queue',
  'nav.people': 'People',
  'nav.transactions': 'Transactions',
  'nav.insights': 'Insights',
  'nav.auditLog': 'Audit log',
  'nav.explore': 'Explore',
  'nav.myLearning': 'My Learning',
  'nav.profile': 'Profile',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',

  // Preferences (shared by all three portals)
  'prefs.title': 'Preferences',
  'prefs.description': 'How Elevate looks and which language it uses on this device.',
  'prefs.appearance': 'Appearance',
  'prefs.appearance.description': 'System follows your device setting.',
  'prefs.theme.system': 'System',
  'prefs.theme.light': 'Light',
  'prefs.theme.dark': 'Dark',
  'prefs.language': 'Language',
  'prefs.language.description':
    'Applies to menus and settings. More of Elevate is translated over time.',

  // Settings pages
  'settings.eyebrow': 'Settings',
  'settings.teach.title': 'Your teacher profile',
  'settings.teach.description': 'What learners see on your course pages.',
  'settings.support.title': 'Your account',
  'settings.support.description': 'Preferences are saved on this device.',
  'account.title': 'Account',
  'account.email': 'Email',
  'account.role': 'Role',
  'account.commission': 'Commission',
  'account.approved': 'Approved',
  'role.superAdmin': 'Super admin',
  'role.supportAgent': 'Support agent',
  'role.teacher': 'Teacher',
  'role.learner': 'Learner',
  'role.staff': 'Staff',

  // Learner profile tab
  'profile.title': 'Your profile',
  'profile.displayName': 'Display name',
  'profile.displayName.hint': 'This is the name printed on your certificates.',
  'profile.name.placeholder': 'Your name',
  'profile.save': 'Save',
  'profile.saved': 'Saved',
} as const
