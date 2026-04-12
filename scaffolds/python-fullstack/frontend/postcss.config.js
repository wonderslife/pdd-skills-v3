export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
    'postcss-pxtorem': {
      rootValue: 37.5,
      unitPrecision: 5,
      propList: ['*', '!border*'],
      selectorBlackList: ['.no-rem'],
      replace: true,
      mediaQuery: false,
      minPixelValue: 0,
    },
  },
}
