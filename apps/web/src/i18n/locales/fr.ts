import type { Translations } from './en';

export const fr: Translations = {
  app: {
    brand: 'DyingStar',
    section: 'Persistance',
  },
  topBar: {
    searchPlaceholder: 'Aller à un UUID…',
    newItem: 'Nouvel objet',
    server: 'Serveur de jeu',
    noServer: 'Aucun serveur configuré',
  },
  live: {
    on: 'Live · 2 s',
    off: 'En pause',
    toggle: 'Activer ou suspendre le live',
  },
  theme: {
    toggle: 'Changer de thème',
    light: 'Clair',
    dark: 'Sombre',
    system: 'Système',
  },
  language: {
    label: 'Langue',
    en: 'English',
    fr: 'Français',
  },
  pagination: {
    range: '{{from}}–{{to}} sur {{total}}',
    empty: 'Aucun objet',
    page: 'page {{page}} / {{pages}}',
    previous: 'Page précédente',
    next: 'Page suivante',
  },
  value: {
    empty: 'vide',
    brokenLink: 'objet introuvable',
    items_one: '{{count}} élément',
    items_other: '{{count}} éléments',
    keys_one: '{{count}} clé',
    keys_other: '{{count}} clés',
  },
  confirm: {
    cancel: 'Annuler',
  },
  home: {
    heading: 'Design system prêt',
    next: "L'explorateur arrive à la prochaine étape.",
    bff: 'BFF',
    bffOk: 'joignable — version {{version}}',
    bffDown: 'injoignable',
    bffLoading: 'vérification…',
  },
};
