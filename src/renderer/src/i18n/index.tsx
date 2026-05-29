/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react'
import { de } from './locales/de'
import { en } from './locales/en'
import { fr } from './locales/fr'
import { es } from './locales/es'

export type Language = 'de' | 'en' | 'fr' | 'es'

const translations = { de, en, fr, es }

export type TranslationKey = keyof typeof de

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({
  language,
  setLanguage,
  children
}: {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  children: React.ReactNode
}): React.JSX.Element {
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const langDict = translations[language] || de
    let text = langDict[key] || de[key] || String(key)

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
      })
    }
    return text
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
