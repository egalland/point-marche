import { AppIcon } from './app-icon';
const procedures:Record<string,{before:string;command:string;after:string;detail:string;kind?:string}>={
 demarrer:{before:'Marché et semaine',command:'Choisir le marché et la semaine',after:'Point de la période sélectionnée',detail:'Vérifier les dates des imports avant de compléter le point.'},
 reprise:{before:'Semaine cible',command:'Reprendre le point précédent',after:'Contenu repris à contrôler',detail:'Relire les dossiers, dates et priorités avant de poursuivre.'},
 blocs:{before:'Bloc sélectionné',command:'⋯ → Configurer le bloc',after:'Paramètres flottants',detail:'Le menu apparaît en superposition ; les blocs restent en place.',kind:'menu'},
 disposition:{before:'Position initiale',command:'Saisir la poignée et glisser',after:'Nouvelle position',detail:'Le bloc déplacé change de position ; ses voisins restent immobiles.',kind:'move'},
 dimensions:{before:'Largeur et hauteur initiales',command:'Tirer le coin inférieur droit',after:'Dimensions ajustées',detail:'La largeur et la hauteur changent sans réorganiser les voisins.',kind:'resize'},
 grille:{before:'Repères visibles',command:'Activer ou désactiver Aimantation',after:'Position par paliers ou libre',detail:'Afficher la grille et aimanter sont deux réglages indépendants.',kind:'snap'},
 edition:{before:'Bloc en lecture',command:'Crayon → saisir dans le bloc',after:'Contenu modifié sur place',detail:'La palette flotte près du bloc ; son cadre garde ses dimensions.',kind:'edit'},
 format:{before:'Texte sélectionné',command:'Choisir un outil de mise en forme',after:'Texte mis en forme',detail:'Sélectionner les mots dans le bloc, puis utiliser la palette flottante.',kind:'edit'},
 jira:{before:'Centre d’import',command:'Jira → importer les données',after:'Tickets et personnes à vérifier',detail:'Contrôler les attributions et les filtres après l’import.'},
 planner:{before:'Centre d’import',command:'Planner → charger les données',after:'Simulations à contrôler',detail:'Vérifier les correspondances de marchés et les mois.'},
 manuel:{before:'Valeur importée',command:'Modifier le champ du point',after:'Modifié dans le point',detail:'Valeur importée permet de rétablir la donnée source quand ce bouton est disponible.'},
 dossiers:{before:'Bloc Dossiers',command:'＋ Dossier → modifier le contenu',after:'Publication et suivi renseignés',detail:'Le titre et le texte se saisissent dans le dossier ; le suivi est dans la palette.'},
 simulations:{before:'Bloc Simulations',command:'Crayon → nom, état et mois',after:'Simulation actualisée',detail:'Contrôler les groupes du mois courant et du mois suivant.'},
 promotions:{before:'Bloc Promotions',command:'Crayon → renseigner les champs',after:'Promotion complétée',detail:'Compléter période, achat, action et commentaire.'},
 indicateurs:{before:'Total ou vigilance',command:'Filtrer et ouvrir les détails',after:'Lignes à l’origine du résultat',detail:'Vérifier les sources et distinguer une valeur absente de zéro.'},
 sauvegarde:{before:'Saisie dans le brouillon',command:'Vérifier la synchronisation',after:'Brouillon synchronisé',detail:'Enregistrer met à jour le point partagé : cette action est distincte.'},
 exports:{before:'Espace Mail',command:'Préparer le mail + la page',after:'Fichier .eml + HTML joint',detail:'Ouvrir dans Outlook, relire, puis envoyer depuis Outlook.'},
 analyste:{before:'Vue Analyste',command:'Choisir la personne et la semaine',after:'Point de l’analyste sélectionné',detail:'Contrôler les tickets, simulations et l’état de sauvegarde.'},
 apparence:{before:'Paramètres',command:'Personnalisation → régler l’affichage',after:'Thème et lisibilité ajustés',detail:'Vérifier séparément lecture, mail et page HTML.'},
 depannage:{before:'Bloc absent ou contenu coupé',command:'Visibilité ou dimensions',after:'Bloc retrouvé ou contenu accessible',detail:'Réafficher le bloc ou augmenter sa hauteur ; consulter son état de sauvegarde.'},
 marches:{before:'Paramètres',command:'Marchés & seuils',after:'Règles du marché ajustées',detail:'Relire le radar Jira après une modification des seuils.'},
 annuaire:{before:'Paramètres',command:'Annuaire GLOBAL → rechercher',after:'Identité et marchés contrôlés',detail:'Vérifier les rattachements avant de refaire un import.'},
 historique:{before:'Historique des points',command:'Choisir et ouvrir un point',after:'Point retrouvé pour relecture',detail:'En autonome, vérifier aussi la réouverture du fichier exporté.'},
 variations:{before:'Statistiques et variations',command:'Choisir fournisseur et période',after:'Variation et détails affichés',detail:'Identifier la moyenne simple ou pondérée et contrôler les données.'},
};
function MiniScreen({kind,phase,label}:{kind?:string;phase:number;label:string}){
 return <div className={`modop-screen kind-${kind??'standard'} phase-${phase}`} aria-hidden="true"><div className="modop-screen-bar"><i/><i/><i/><span>Point marché</span></div><div className="modop-screen-body">{kind==='menu'?<><div className="modop-card">Dossiers <b>⋯</b></div>{phase===1&&<div className="modop-mini-palette">✎ Modifier le contenu<br/>⚙ Configurer le bloc<br/>↔ Disposition</div>}{phase===2&&<div className="modop-mini-palette">Titre <span>Dossiers</span><br/>Largeur <span>576</span></div>}</>:kind==='edit'?<>{phase===1&&<div className="modop-mini-palette tools">B　I　U　A　☷</div>}<div className="modop-card text">Notes du point<p>{phase===0?'Contrôle en cours.':phase===1?<mark>Contrôle en cours.│</mark>:<strong>Contrôle en cours.</strong>}</p></div></>:kind==='move'||kind==='resize'||kind==='snap'?<><div className="modop-neighbor">Jira</div><div className="modop-card movable">Dossiers <b>{kind==='resize'?'↘':'✥'}</b></div>{phase===1&&<span className="modop-gesture">{kind==='resize'?'↘':'→'}</span>}{kind==='snap'&&<small className="modop-snap">Aimantation {phase===0?'ON':'OFF'}</small>}</>:<><div className="modop-control">{label}</div><div className="modop-lines"><i/><i/><i/></div>{phase===2&&<span className="modop-result-mark">✓</span>}</>}</div></div>;
}
export function HelpProcedure({chapter,compact=false}:{chapter:string;compact?:boolean}){
 const p=procedures[chapter]??procedures.depannage;
 if(compact)return <div className="modop-compact"><AppIcon name={p.kind==='resize'?'resize':p.kind==='move'?'move':p.kind==='snap'?'magnet':'edit'}/><span>{p.command}</span></div>;
 return <figure className="modop-visual" aria-label={`Mode opératoire visuel : ${p.command}`}><figcaption><AppIcon name="eye"/><strong>Repères du mode opératoire</strong><small>Schéma des commandes et du résultat</small></figcaption><div className="modop-steps">{[p.before,p.command,p.after].map((label,i)=><section key={i}><header><b>{i+1}</b><span>{['Repérer','Agir','Vérifier'][i]}</span></header><MiniScreen kind={p.kind} phase={i} label={label}/><p>{label}</p></section>)}</div><p className="modop-detail">{p.detail}</p></figure>;
}
