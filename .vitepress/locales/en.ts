import type { Translations } from '../i18n.ts';

export const en = {
  brand: 'FINKI Hub',
  courses: 'Courses',
  description: 'A collection of course recordings from FINKI',
  favorites: {
    add: 'Add to favorites',
    remove: 'Remove from favorites',
    title: 'Favorites',
  },
  footer:
    'This is an unofficial site. Recording links are public; we neither own nor host the recordings. All copyright belongs to FINKI.',
  home: {
    browse: 'Browse all courses',
    contribute: 'How to contribute',
    coursesDetails:
      'Each page brings together recordings, playlists and notes for a specific course.',
    coursesTitle: 'By course',
    linksDetails:
      'Recordings organised by week or topic, with clear labels for lectures, exercises and consultations.',
    linksTitle: 'Organised links',
    navigationDetails: 'Browse all courses easily using the sidebar.',
    navigationTitle: 'Quick navigation',
    tagline: 'Everything in one place, organised by course.',
    text: 'A collection of lecture and exercise recordings.',
  },
  introduction: {
    closing: 'Happy studying and good luck with your exams!',
    contributeBody:
      'If you have new links or spot an error, feel free to submit a pull request or open an issue in the repository. Guidelines:',
    contributeHeading: 'Contribute',
    contributeLinks:
      'Include a short description and clearly organised recording links',
    contributePage: 'Add a new `.md` page in `courses/` for a new course',
    contributeStyle: 'Follow the style and format of the existing pages',
    description:
      'This is an unofficial collection of links to lecture recordings, exercises and additional materials for FINKI courses. It helps students find and follow recordings in one place.',
    educational: 'Content is shared solely for educational purposes',
    findFormats: 'Information about the format (lectures, labs, consultations)',
    findHeading: 'What you will find here',
    findNotes: 'Notes or useful resources related to the course',
    findPlaylists: 'Playlists (YouTube and similar platforms) where available',
    findRecordings: 'Links to recordings organised by week or topic',
    organizationBody:
      'Each course has its own Markdown page. The pages appear in the sidebar for easy navigation. Example course:',
    organizationHeading: 'Course organisation',
    removal:
      'If you are a rights holder and would like something removed, contact us through the repository',
    rights:
      'All rights to the recordings belong to their respective owners or authors',
    rightsHeading: 'Notes and copyright',
    startBody:
      'Choose a course from the sidebar to open its page with all recordings and useful links.',
    startTitle: 'Getting started',
    unofficial:
      'This is an unofficial project and is not affiliated with FINKI',
  },
  language: 'Language',
  learnify: {
    after: '.',
    before: 'For private tutoring in this course, visit',
    title: 'Private tutoring',
  },
  nav: { home: 'Home', introduction: 'Introduction' },
  notes: {
    grouping: 'The links could be grouped and ordered more clearly',
    mismatchedExercises:
      'The lectures and exercises probably do not cover the same topics; only their order is correct',
    none: 'None',
    olderRecordings: 'Older lecture recordings are also available',
  },
  search: {
    button: { buttonAriaLabel: 'Search', buttonText: 'Search' },
    modal: {
      backButtonTitle: 'Back',
      displayDetails: 'Show details',
      footer: {
        closeKeyAriaLabel: 'Escape',
        closeText: 'close',
        navigateDownKeyAriaLabel: 'Down arrow',
        navigateText: 'navigate',
        navigateUpKeyAriaLabel: 'Up arrow',
        selectKeyAriaLabel: 'Enter',
        selectText: 'select',
      },
      noResultsText: 'No results found',
      resetButtonTitle: 'Clear search',
    },
  },
  sections: {
    additional: 'Additional content',
    exercises: 'Exercises',
    exercisesAndLabs: 'Exercises + Labs',
    lectures: 'Lectures',
    lecturesAndExercises: 'Lectures + Exercises',
    notes: 'Notes',
  },
  semester: 'Semester {number}',
  theme: {
    darkModeSwitchLabel: 'Theme',
    darkModeSwitchTitle: 'Dark theme',
    extraMenuLabel: 'More options',
    lightModeSwitchTitle: 'Light theme',
    navMenuLabel: 'Main navigation',
    notFoundLinkLabel: 'Return to the homepage',
    notFoundLinkText: 'Back to home',
    notFoundQuote: 'Check the address or return to the homepage.',
    notFoundTitle: 'PAGE NOT FOUND',
    outlineLabel: 'On this page',
    permalink: 'Permalink to “{title}”',
    returnToTopLabel: 'Back to top',
    sidebarMenuLabel: 'Menu',
    sidebarNavigation: 'Course navigation',
    skipToContentLabel: 'Skip to content',
  },
  title: 'FINKI Hub / Recordings',
} as const satisfies Translations;
