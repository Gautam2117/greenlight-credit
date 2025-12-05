/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:"#f2fbf7",100:"#d7f6e8",200:"#b1ead2",300:"#7ed8b8",
          400:"#4ec49c",500:"#28ad85",600:"#1d8e6e",
          700:"#19715a",800:"#155a49",900:"#124a3d"
        }
      },
      boxShadow: { soft: "0 10px 30px rgba(0,0,0,0.10)" }
    }
  },
  plugins: []
}
