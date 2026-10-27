"use client";
import { APP_VERSION } from "@/lib/app-version";
import { WorkspaceHelp } from '@/components/workspace-help';
export default function HelpPage(){return <main className="v51-help-home"><h1>Aide du Point marché · {APP_VERSION}</h1><p>Retrouve les modes opératoires, les schémas et la recherche documentaire.</p><WorkspaceHelp initialOpen/><a href="/">← Revenir au Point marché</a></main>;}
