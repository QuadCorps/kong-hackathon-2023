module.exports = {
  plugins: {
    'postcss-nested': {},    // Add this line
    tailwindcss: {
      config: './tailwind.config.js'
    },
    autoprefixer: {}
  }
}
