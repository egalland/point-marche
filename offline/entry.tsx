import React from "react";
import { createRoot } from "react-dom/client";
import { MarketPulseApp } from "../features/market-pulse/market-pulse-app";

const root = document.getElementById("root");
if (!root) throw new Error("Point de montage introuvable");
createRoot(root).render(<React.StrictMode><MarketPulseApp /></React.StrictMode>);
