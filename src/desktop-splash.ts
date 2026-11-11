import { listen } from "@tauri-apps/api/event";
import "./styles/desktop-splash.css";
void listen<string>("taha-startup-stage", (event) => {
  document.getElementById("stage")!.textContent = event.payload;
});
