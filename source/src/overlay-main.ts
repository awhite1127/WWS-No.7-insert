import { createApp } from "vue";
import OverlayView from "./components/OverlayView.vue";
import "./style.css";
import "./ui-polish.css";

document.documentElement.classList.add("overlay-mode");
document.body.classList.add("overlay-mode");

async function mount() {
  if (import.meta.env.DEV && !window.wws) await import("./web-shim");
  createApp(OverlayView).mount("#app");
}
void mount();
