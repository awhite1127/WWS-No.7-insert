import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
import "./ui-polish.css";

async function mount() {
  if (import.meta.env.DEV && !window.wws) await import("./web-shim");
  createApp(App).mount("#app");
}
void mount();
