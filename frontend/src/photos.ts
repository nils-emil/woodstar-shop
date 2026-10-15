import type { TranslationKey } from '@/i18n/et'

/**
 * Openly licensed picture from Wikimedia Commons. It does not show a Puukapp locker or bag;
 * the caption says where it was taken. Replace with the company's own photography when it exists.
 */
export const photos = {
  birch: {
    src: '/photos/birch.jpg',
    width: 1200,
    height: 900,
    caption: 'caption_birch' as TranslationKey,
    creator: 'Minnecologies',
    license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:European_White_Birch_Firewood.JPG',
  },
}
