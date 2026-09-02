import React from "react";
import { createRoot } from "react-dom/client";
import { OfflineApp } from "./offline-app";

const root = document.getElementById("root");
if (!root) throw new Error("Point de montage introuvable");
createRoot(root).render(<React.StrictMode><OfflineApp /></React.StrictMode>);
