import type { Adventure } from "./types";

export const laUltimaInspeccion: Adventure = {
  id: "la-ultima-inspeccion",
  title: "La última inspección en el acuario",
  system: "el-rastro-de-cthulhu",
  synopsis:
    "Eastbourne, 30 de marzo de 1934. El magnate Patrick Summers contrata a los investigadores para inspeccionar su flamante acuario de lujo, a tres meses de su inauguración. Lo que parecía una visita rutinaria por un complejo subterráneo se complica cuando todo se queda a oscuras.",
  scenes: [
    {
      id: "llegada-montacargas",
      title: "Llegada y montacargas",
      musicId: "radio-epoca",
      ambienceId: "costa-gaviotas",
      sfxIds: [
        "coche-grava",
        "puerta-coche",
        "llaves",
        "verja-metalica",
        "montacargas",
        "pasos-baldosa",
      ],
      cues: [
        { moment: "Llegada en limusina", soundIds: ["coche-grava"] },
        { moment: "Bajada al acuario", soundIds: ["montacargas"] },
      ],
    },
    {
      id: "hall-exposicion",
      title: "El hall y la exposición",
      musicId: "elegancia-inquietante",
      ambienceId: "burbujeo-acuario",
      sfxIds: ["pasos-baldosa", "puerta-chirrido", "pez-coleteando", "latido"],
      cues: [],
    },
    {
      id: "visita-guiada",
      title: "Visita guiada",
      musicId: "misterio-investigacion",
      ambienceId: "tanque-submarino",
      sfxIds: [
        "canto-ballena",
        "pasos-pasarela",
        "puerta-chirrido",
        "apagon",
        "chorro-agua",
      ],
      cues: [
        {
          moment: "El apagón (después, pasar a la sala del generador)",
          soundIds: ["apagon", "golpe-tension"],
        },
      ],
    },
    {
      id: "sala-generador",
      title: "Sala del generador",
      ambienceId: "sala-maquinas",
      sfxIds: [
        "generador-falla",
        "chispazo",
        "tuberia-revienta",
        "chorro-agua",
        "crujido-metal",
      ],
      cues: [
        {
          moment: "La tubería rota desde dentro",
          soundIds: ["crujido-metal"],
        },
      ],
    },
    {
      id: "muerte-en-el-hall",
      title: "Muerte en el hall",
      musicId: "tension-oscura",
      ambienceId: "luces-emergencia",
      sfxIds: [
        "cristal-estalla",
        "grito-hombre",
        "salpicadura",
        "pez-coleteando",
        "pasos-mojados",
        "latido",
        "perdida-estabilidad",
      ],
      cues: [
        {
          moment: "Antes de que lleguen al hall",
          soundIds: ["cristal-estalla", "grito-hombre"],
        },
        { moment: "Al descubrir el cuerpo", soundIds: ["golpe-tension"] },
      ],
    },
    {
      id: "investigacion",
      title: "Investigación en las salas",
      musicId: "misterio-investigacion",
      ambienceId: "luces-emergencia",
      sfxIds: [
        "taquilla-metal",
        "cajon-secreto",
        "papeles",
        "revolver-tambor",
        "palanca-compuerta",
        "pasos-mojados",
      ],
      cues: [
        { moment: "Todos los peces se giran a mirarlos", soundIds: ["susurros"] },
      ],
    },
    {
      id: "pasarelas-tanques",
      title: "Pasarelas sobre los tanques",
      musicId: "dron-abisal",
      ambienceId: "tanque-submarino",
      sfxIds: [
        "pasos-pasarela",
        "zambullida",
        "canto-ballena",
        "morsa",
        "salpicadura",
        "perdida-estabilidad",
      ],
      cues: [
        {
          moment: "El destello lila y las tres siluetas",
          soundIds: ["destello-extrano", "latido"],
        },
      ],
    },
    {
      id: "enfrentamiento-final",
      title: "Enfrentamiento final",
      musicId: "combate-horror",
      ambienceId: "tanque-submarino",
      sfxIds: [
        "chillido-inhumano",
        "zarpazo",
        "zambullida",
        "disparo-revolver",
        "disparo-arpon",
        "desague-remolino",
        "golpes-compuerta",
        "grito-mujer",
        "estatuilla-rompe",
        "perdida-estabilidad",
      ],
      cues: [
        { moment: "Aparecen las criaturas", soundIds: ["chillido-inhumano"] },
        {
          moment: "Arrastran a Cindy bajo el agua",
          soundIds: ["grito-mujer", "zambullida"],
        },
        { moment: "Al mirar la estatuilla", soundIds: ["trance-hipnotico"] },
        {
          moment: "La estatuilla se rompe",
          soundIds: ["estatuilla-rompe", "golpe-tension"],
        },
      ],
    },
    {
      id: "resolucion",
      title: "Resolución",
      musicId: "calma-tras-horror",
      ambienceId: "goteo-cavidad",
      sfxIds: ["generador-arranque", "montacargas", "sirena-lejana"],
      cues: [
        { moment: "Vuelve la luz", soundIds: ["generador-arranque"] },
        { moment: "Salen al exterior", soundIds: ["costa-gaviotas"] },
      ],
    },
  ],
};
