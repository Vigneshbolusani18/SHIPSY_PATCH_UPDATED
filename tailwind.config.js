/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      colors: {
        brand: {
          50:"#eef6ff",100:"#d9ebff",200:"#b8d7ff",300:"#8bbaff",
          400:"#5a95ff",500:"#3b82f6",600:"#2f6ae6",700:"#2656c2",
          800:"#20479d",900:"#1d3d82"
        }
      }
    }
  },
  plugins: [],
};
