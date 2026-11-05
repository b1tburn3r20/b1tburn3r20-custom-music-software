// Apply the last theme before first paint (the real setting arrives from the main process).
try {
  var t = localStorage.getItem("b1t:theme");
  if (t) {
    document.documentElement.dataset.theme = t;
    document.documentElement.classList.toggle("dark", localStorage.getItem("b1t:theme-mode") !== "light");
  }
} catch (e) {
  /* storage unavailable: the default theme is fine */
}
