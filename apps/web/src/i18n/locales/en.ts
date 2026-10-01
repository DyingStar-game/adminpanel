export const en = {
  app: {
    brand: 'DyingStar',
    section: 'Persistence',
  },
  topBar: {
    searchPlaceholder: 'Go to a UUID…',
    newItem: 'New item',
    server: 'Game server',
    noServer: 'No server configured',
  },
  live: {
    on: 'Live · 2 s',
    off: 'Paused',
    toggle: 'Toggle live refresh',
  },
  theme: {
    toggle: 'Toggle theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  language: {
    label: 'Language',
    en: 'English',
    fr: 'Français',
  },
  pagination: {
    range: '{{from}}–{{to}} of {{total}}',
    empty: 'No item',
    page: 'page {{page}} / {{pages}}',
    previous: 'Previous page',
    next: 'Next page',
  },
  value: {
    empty: 'empty',
    brokenLink: 'missing item',
    items_one: '{{count}} item',
    items_other: '{{count}} items',
    keys_one: '{{count}} key',
    keys_other: '{{count}} keys',
  },
  confirm: {
    cancel: 'Cancel',
  },
  home: {
    heading: 'Design system ready',
    next: 'The explorer arrives in the next step.',
    bff: 'BFF',
    bffOk: 'reachable — version {{version}}',
    bffDown: 'unreachable',
    bffLoading: 'checking…',
  },
};

export type Translations = typeof en;
