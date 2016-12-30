/* eslint-disable quote-props */

/**
 * The NES palette is divided into 4 subpalettes of 4 colors each, one of which is used for a common
 * background/transparent color.
 */
export const COLORS_PER_SUBPALETTE = 4;
export const SUBPALETTES_PER_IMAGE = 4;

/**
 * There are multiple identical (?) "blacks" in the NES palette, but most games use 0x0F as the
 * standard black
 */
export const CANONICAL_BLACK = '0f';

/**
 * This maps the internal color enumeration to hex colors.
 */
export const palette = {
  '00': '#7c7c7c',
  '01': '#0923f8',
  '02': '#0417b9',
  '03': '#4430b9',
  '04': '#920f82',
  '05': '#a60424',
  '06': '#a6120d',
  '07': '#861508',
  '08': '#4f2f04',
  '09': '#0c770f',
  '0a': '#09670b',
  '0b': '#065707',
  '0c': '#034057',
  '0d': '#000000',
  '0e': '#000000',
  '0f': '#000000', // canonical black
  '10': '#bcbcbc',
  '11': '#147cf5',
  '12': '#0f5ef4',
  '13': '#684df8',
  '14': '#d61eca',
  '15': '#e20e5a',
  '16': '#f53a1b',
  '17': '#e25c22',
  '18': '#ab7b19',
  '19': '#1ab61e',
  '1a': '#17a61a',
  '1b': '#17a749',
  '1c': '#128887',
  '1d': '#000000',
  '1e': '#000000',
  '1f': '#000000',
  '20': '#f8f8f8',
  '21': '#44bdfa',
  '22': '#6a8bf9',
  '23': '#987cf5',
  '24': '#f67df6',
  '25': '#f65b98',
  '26': '#f6785d',
  '27': '#fa9f4e',
  '28': '#f7b72a',
  '29': '#baf638',
  '2a': '#5dd65b',
  '2b': '#60f69b',
  '2c': '#27e7d8',
  '2d': '#787878',
  '2e': '#000000',
  '2f': '#000000',
  '30': '#fcfcfc',
  '31': '#a6e4fb',
  '32': '#b8b9f6',
  '33': '#d8baf6',
  '34': '#f7baf7',
  '35': '#f7a5c0',
  '36': '#efd0b2',
  '37': '#fbdfab',
  '38': '#f7d77e',
  '39': '#d9f680',
  '3a': '#baf7ba',
  '3b': '#baf7d9',
  '3c': '#2cfcfb',
  '3d': '#d8d8d8',
  '3e': '#000000',
  '3f': '#000000',
};

/**
 * Converts a color in whatever format to the [r,g,b] format required by DitherJS
 *
 * @param  {Array|Object|string|number} anyColor - source color
 * @return {Array} [r,g,b] color
 */
export function normalizeColor(anyColor) {
  let color = anyColor;

  if (Array.isArray(color)) {
    return color;
  }

  if (typeof color === 'object') {
    return [
      color.r || color.red || 0,
      color.g || color.green || 0,
      color.b || color.blue || 0,
    ];
  }

  if (typeof color === 'string') {
    color = color.toLowerCase().replace(/[^0-9a-f]/, '');
    if (color.length === 3) {
      color = color.split('').map(v => v + v).join('');
    }
    color = parseInt(color, 16);
  }

  return [
    /* eslint-disable no-bitwise */
    (color >> 16) & 0xff,
    (color >> 8) & 0xff,
    color & 0xff,
    /* eslint-enable no-bitwise */
  ];
}

/**
 * DitherJS just wants a list of [r,g,b] values for colors
 *
 * @param {Array} colorKeys - an array of NES palette keys
 * @return {Array} all [r,g,b] colors to use in the palette
 */
export function generatePalette(colorKeys) {
  return colorKeys.map(key => normalizeColor(palette[key]));
}

/**
 * Standard palette of unique NES colors that DitherJS can use
 */
export const nesPalette = generatePalette((
  [palette[CANONICAL_BLACK]]
    .concat(Object.keys(palette).filter(key => palette[key] !== '#000000'))
));

export default nesPalette;
