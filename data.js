"use strict";

/* ════════════════════════════════════════════════════
   COUNTRY DATA
   Each entry: { name, abbr, seats, state }
   state is mutated at runtime by app.js
════════════════════════════════════════════════════ */
const euCountries = {
  "DEU":{name:"Allemagne",       abbr:"DE",seats:63,state:"neutral"},
  "FRA":{name:"France",          abbr:"FR",seats:52,state:"neutral"},
  "GBR":{name:"Royaume-Uni",     abbr:"UK",seats:52,state:"neutral"},
  "ITA":{name:"Italie",          abbr:"IT",seats:46,state:"neutral"},
  "ESP":{name:"Espagne",         abbr:"ES",seats:38,state:"neutral"},
  "UKR":{name:"Ukraine",         abbr:"UA",seats:31,state:"neutral"},
  "POL":{name:"Pologne",         abbr:"PL",seats:30,state:"neutral"},
  "ROU":{name:"Roumanie",        abbr:"RO",seats:17,state:"neutral"},
  "NLD":{name:"Pays-Bas",        abbr:"NL",seats:15,state:"neutral"},
  "BEL":{name:"Belgique",        abbr:"BE",seats:11,state:"neutral"},
  "CZE":{name:"Rép. Tchèque",    abbr:"CZ",seats:11,state:"neutral"},
  "SWE":{name:"Suède",           abbr:"SE",seats:11,state:"neutral"},
  "GRC":{name:"Grèce",           abbr:"GR",seats:10,state:"neutral"},
  "HUN":{name:"Hongrie",         abbr:"HU",seats:10,state:"neutral"},
  "PRT":{name:"Portugal",        abbr:"PT",seats:10,state:"neutral"},
  "AUT":{name:"Autriche",        abbr:"AT",seats:9, state:"neutral"},
  "CHE":{name:"Suisse",          abbr:"CH",seats:9, state:"neutral"},
  "BGR":{name:"Bulgarie",        abbr:"BG",seats:8, state:"neutral"},
  "SRB":{name:"Serbie",          abbr:"RS",seats:8, state:"neutral"},
  "DNK":{name:"Danemark",        abbr:"DK",seats:7, state:"neutral"},
  "FIN":{name:"Finlande",        abbr:"FI",seats:7, state:"neutral"},
  "IRL":{name:"Irlande",         abbr:"IE",seats:7, state:"neutral"},
  "NOR":{name:"Norvège",         abbr:"NO",seats:7, state:"neutral"},
  "SVK":{name:"Slovaquie",       abbr:"SK",seats:7, state:"neutral"},
  "HRV":{name:"Croatie",         abbr:"HR",seats:6, state:"neutral"},
  "ALB":{name:"Albanie",         abbr:"AL",seats:5, state:"neutral"},
  "BIH":{name:"Bosnie-Herz.",    abbr:"BA",seats:5, state:"neutral"},
  "LTU":{name:"Lituanie",        abbr:"LT",seats:5, state:"neutral"},
  "MDA":{name:"Moldavie",        abbr:"MD",seats:5, state:"neutral"},
  "CYP":{name:"Chypre",          abbr:"CY",seats:4, state:"neutral"},
  "EST":{name:"Estonie",         abbr:"EE",seats:4, state:"neutral"},
  "KOS":{name:"Kosovo",          abbr:"XK",seats:4, state:"neutral"},
  "LVA":{name:"Lettonie",        abbr:"LV",seats:4, state:"neutral"},
  "MKD":{name:"Macédoine du N.", abbr:"MK",seats:4, state:"neutral"},
  "SVN":{name:"Slovénie",        abbr:"SI",seats:4, state:"neutral"},
  "ISL":{name:"Islande",         abbr:"IS",seats:3, state:"neutral"},
  "LUX":{name:"Luxembourg",      abbr:"LU",seats:3, state:"neutral"},
  "MLT":{name:"Malte",           abbr:"MT",seats:3, state:"neutral"},
  "MNE":{name:"Monténégro",      abbr:"ME",seats:3, state:"neutral"}
};

/* ════════════════════════════════════════════════════
   MANUAL LABEL CENTRES
   Override D3's centroid for countries whose visual
   centre would otherwise fall outside the polygon
   (e.g. concave coasts, archipelagos, micro-states).
════════════════════════════════════════════════════ */
const manualCenters = {
  "FRA":[2.2,46.2],
  "NOR":[8.4,60.4],
  "ESP":[-3.7,40.4],
  "GBR":[-2.0,53.0],
  "GRC":[22.0,39.0],
  "HRV":[15.5,44.5],
  "PRT":[-8.2,39.5],
  "NLD":[5.2,52.1],
  "LUX":[6.1,49.8],
  "CYP":[33.0,35.1],
  "ISL":[-19.0,65.0],
  "MLT":[14.4,35.9],
  "KOS":[20.9,42.6]
};

/* ════════════════════════════════════════════════════
   ELECTION CONSTANTS
════════════════════════════════════════════════════ */
let TOTAL    = 538;
let MAJORITY = 270;

// ==========================================
// MOTEUR DÉMOGRAPHIQUE EUROPÉEN
// ==========================================
const vraisGrandsElecteurs = {
    "Allemagne": 96, "France": 81, "Italie": 76, "Royaume-Uni": 73, "Turquie": 90,
    "Espagne": 61, "Pologne": 53, "Ukraine": 50, "Roumanie": 33, "Pays-Bas": 31,
    "Belgique": 22, "Grèce": 21, "Rép. Tchèque": 21, "Tchéquie": 21, "Suède": 21, 
    "Portugal": 21, "Hongrie": 21, "Autriche": 20, "Suisse": 19, "Bulgarie": 17, 
    "Biélorussie": 16, "Danemark": 15, "Finlande": 15, "Slovaquie": 15, "Norvège": 15, 
    "Serbie": 15, "Irlande": 14, "Croatie": 12, "Lituanie": 11, "Slovénie": 9, 
    "Lettonie": 9, "Bosnie": 9, "Albanie": 8, "Moldavie": 8, "Estonie": 7, 
    "Macédoine": 7, "Chypre": 6, "Luxembourg": 6, "Kosovo": 6, "Malte": 6, 
    "Monténégro": 4, "Islande": 4
};

let nouveauTotal = 0;

for (const id in euCountries) {
    let nomPays = euCountries[id].name;
    let poids = 5; // Valeur par défaut pour les micros-états
    
    // Le moteur cherche le pays et lui attribue son vrai poids géopolitique
    for (const vraiNom in vraisGrandsElecteurs) {
        if (nomPays.includes(vraiNom) || vraiNom.includes(nomPays)) {
            poids = vraisGrandsElecteurs[vraiNom];
            break;
        }
    }
    
    euCountries[id].seats = poids; // On remplace le chiffre américain
    nouveauTotal += poids; // On additionne pour trouver le nouveau grand total
}

// Mise à jour automatique des règles de victoire !
TOTAL = nouveauTotal;
MAJORITY = Math.floor(TOTAL / 2) + 1;

/* ════════════════════════════════════════════════════
   STATE LOOKUP TABLES
════════════════════════════════════════════════════ */
const stateOrder = ["neutral","blue","lightBlue","red","lightRed"];

const stateColors = {
    neutral  : "#3d4460",
    blue     : "#003399",
    lightBlue: "#3366CC",
    red      : "#6A1B9A",
    lightRed : "#9C27B0"
};

const stateLabels = {
  neutral  : "Neutre",
  blue     : "Fédéralistes",
  lightBlue: "Légèrement Fédéralistes",
  red      : "Souverainistes",
  lightRed : "Légèrement Souverainistes"
};

const stateLabelColors = {
    neutral  : "#6b7399",
    blue     : "#003399", // Bleu Europe
    lightBlue: "#3366CC", // Bleu Europe clair
    red      : "#6A1B9A", // Pourpre Souverainiste
    lightRed : "#9C27B0"  // Pourpre clair
};

/* ════════════════════════════════════════════════════
   URL SERIALISATION CODES
   Short codes used in the ?map= query string so URLs
   stay compact even with many assigned countries.
════════════════════════════════════════════════════ */
const stateShort = {
  neutral  : "N",
  blue     : "B",
  lightBlue: "LB",
  red      : "R",
  lightRed : "LR"
};

const shortToState = {
  N : "neutral",
  B : "blue",
  LB: "lightBlue",
  R : "red",
  LR: "lightRed"
};

/* ════════════════════════════════════════════════════
   SCENARIO SETS (used by applyClivage in app.js)
════════════════════════════════════════════════════ */
const WEST_COUNTRIES = new Set([
  "FRA","DEU","GBR","ESP","PRT","NLD","BEL","IRL",
  "SWE","NOR","DNK","FIN","LUX","ISL","MLT","CHE"
]);

const EAST_COUNTRIES = new Set([
  "POL","HUN","ROU","BGR","SVK","SRB","UKR","MDA",
  "LTU","LVA","EST","ALB","BIH","MKD","MNE","KOS","HRV"
]);
// Countries absent from both sets (ITA, AUT, CZE, GRC, SVN)
// will be reset to neutral by applyClivage.