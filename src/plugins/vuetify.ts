import 'vuetify/lib/styles/main.css'
import { createVuetify } from 'vuetify'
import {
  mdiAlertCircleOutline,
  mdiChevronDown,
  mdiCloseCircleOutline,
  mdiContentCopy,
  mdiFileSearchOutline,
  mdiFilterOutline,
  mdiFormatListBulleted,
  mdiImageOffOutline,
  mdiMagnify,
  mdiMagnifyScan,
  mdiOpenInNew,
  mdiPlusCircleOutline,
  mdiTranslate,
  mdiTuneVariant,
  mdiViewGridOutline,
} from '@mdi/js'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

const iconAliases = {
  ...aliases,
  search: mdiMagnify,
  expand: mdiChevronDown,
  filters: mdiTuneVariant,
  viewCard: mdiViewGridOutline,
  viewList: mdiFormatListBulleted,
  externalLink: mdiOpenInNew,
  searchScan: mdiMagnifyScan,
  alertCircleOutline: mdiAlertCircleOutline,
  fileSearchOutline: mdiFileSearchOutline,
  copyContent: mdiContentCopy,
  addFilter: mdiPlusCircleOutline,
  applyFilter: mdiFilterOutline,
  closeCircle: mdiCloseCircleOutline,
  language: mdiTranslate,
  coverMissing: mdiImageOffOutline,
}

export const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases: iconAliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'archive',
    themes: {
      archive: {
        dark: false,
        colors: {
          primary: '#F596AA',
          'on-primary': '#4f2230',
          secondary: '#C77892',
          'on-secondary': '#4f2230',
          accent: '#F37E99',
          'on-accent': '#4f2230',
          success: '#497351',
          'on-success': '#fffaf4',
          warning: '#a26b1a',
          'on-warning': '#fffaf4',
          error: '#9d4040',
          'on-error': '#fffaf4',
          background: '#fbf1f4',
          surface: '#fffaf4',
          'surface-variant': '#f6e5ea',
          'on-surface': '#1f2d33',
          'on-surface-variant': '#5d6b70',
          outline: '#e7c2cc',
        },
      },
    },
  },
  defaults: {
    VCard: {
      rounded: 'xl',
    },
    VBtn: {
      rounded: 'xl',
      elevation: 0,
    },
    VChip: {
      rounded: 'xl',
      size: 'small',
    },
    VTextField: {
      density: 'comfortable',
      variant: 'outlined',
      hideDetails: 'auto',
    },
    VCombobox: {
      density: 'comfortable',
      variant: 'outlined',
      hideDetails: 'auto',
      chips: true,
      closableChips: true,
    },
  },
})
