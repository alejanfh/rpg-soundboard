import type { Adventure } from "./types";

export const elLibro: Adventure = {
  id: "el-libro",
  title: "El libro",
  system: "el-rastro-de-cthulhu",
  synopsis:
    "Nueva York y Providence. Dos hombres aparecen muertos con menos de un día de diferencia: les han arrancado los ojos y seccionado la garganta. Lo único que los une es un raro poemario del siglo XIX, La senda invisible, y quien lo lee deja de estar solo dentro de su cabeza.",
  scenes: [
    {
      id: "primer-asesinato",
      title: "El primer asesinato",
      musicId: "tension-oscura",
      ambienceId: "lluvia",
      sfxIds: [
        "pasos-baldosa",
        "puerta-chirrido",
        "papeles",
        "latido",
        "sirena-lejana",
        "perdida-estabilidad",
      ],
      cues: [
        {
          moment: "Entran y ven las piernas tras la mesa volcada",
          soundIds: ["golpe-tension"],
        },
        { moment: "El cadáver sin ojos", soundIds: ["perdida-estabilidad"] },
        {
          moment: "Aviso de un segundo asesinato",
          soundIds: ["sirena-lejana"],
        },
      ],
    },
    {
      id: "segundo-asesinato",
      title: "El segundo asesinato",
      musicId: "tension-oscura",
      ambienceId: "goteo-cavidad",
      sfxIds: [
        "pasos-baldosa",
        "llaves",
        "puerta-chirrido",
        "cajon-secreto",
        "papeles",
        "perdida-estabilidad",
      ],
      cues: [
        {
          moment: "Sullivan abre la habitación 56",
          soundIds: ["llaves", "puerta-chirrido"],
        },
        { moment: "El hedor y el segundo cadáver", soundIds: ["golpe-tension"] },
      ],
    },
    {
      id: "investigaciones-nueva-york",
      title: "Fordham y el profesor Drew",
      musicId: "misterio-investigacion",
      sfxIds: ["papeles", "pasos-baldosa", "cajon-secreto", "portazo"],
      cues: [
        { moment: "Revisan el registro de préstamos", soundIds: ["papeles"] },
      ],
    },
    {
      id: "francis-moon",
      title: "Francis Moon",
      musicId: "misterio-investigacion",
      ambienceId: "lluvia",
      sfxIds: ["pasos-mojados", "papeles", "puerta-chirrido"],
      cues: [
        { moment: "Aparece el detective", soundIds: ["pasos-mojados"] },
        { moment: "Saca su cuaderno de notas", soundIds: ["papeles"] },
      ],
    },
    {
      id: "biblioteca-publica",
      title: "El horror en la biblioteca",
      musicId: "tension-oscura",
      sfxIds: ["papeles", "pasos-baldosa", "susurros", "golpe-tension"],
      cues: [
        {
          moment: "Leen la advertencia de J.R. Smith",
          soundIds: ["susurros", "golpe-tension"],
        },
      ],
    },
    {
      id: "leyendo-la-senda-invisible",
      title: "Leyendo La senda invisible",
      musicId: "trance-hipnotico",
      ambienceId: "zumbido-subterraneo",
      sfxIds: [
        "papeles",
        "susurros",
        "latido",
        "destello-extrano",
        "puerta-chirrido",
        "perdida-estabilidad",
      ],
      cues: [
        { moment: "Control de Estabilidad al hojearlo", soundIds: ["perdida-estabilidad"] },
        { moment: "El cielo se vuelve rojo", soundIds: ["destello-extrano"] },
        { moment: "Algo merodea fuera de la ventana", soundIds: ["susurros"] },
        {
          moment: "Nivel 3: el chirrido en la mansión",
          soundIds: ["puerta-chirrido", "golpe-tension"],
        },
      ],
    },
    {
      id: "helena-tyler",
      title: "Helena Tyler",
      musicId: "elegancia-inquietante",
      sfxIds: ["puerta-chirrido", "pasos-baldosa", "susurros", "latido"],
      cues: [
        { moment: "Archibald: «el cielo era rojo»", soundIds: ["susurros"] },
      ],
    },
    {
      id: "asesino-ataca-de-nuevo",
      title: "El asesino ataca de nuevo",
      musicId: "tension-oscura",
      ambienceId: "lluvia",
      sfxIds: [
        "sirena-lejana",
        "pasos-baldosa",
        "golpe-tension",
        "susurros",
        "perdida-estabilidad",
      ],
      cues: [
        {
          moment: "Encuentran a Helena y a su padre",
          soundIds: ["golpe-tension", "perdida-estabilidad"],
        },
        {
          moment: "La vecina: un hombre que cojeaba",
          soundIds: ["susurros"],
        },
      ],
    },
    {
      id: "gollam-e-hijos",
      title: "Gollam e Hijos",
      musicId: "misterio-investigacion",
      sfxIds: ["puerta-chirrido", "papeles", "pasos-baldosa"],
      cues: [
        { moment: "La lista de ejemplares", soundIds: ["papeles"] },
      ],
    },
    {
      id: "mansion-holland",
      title: "La mansión Holland",
      musicId: "elegancia-inquietante",
      sfxIds: ["coche-grava", "puerta-coche", "pasos-baldosa", "puerta-chirrido"],
      cues: [
        {
          moment: "Llega Holland en su automóvil",
          soundIds: ["coche-grava", "puerta-coche"],
        },
      ],
    },
    {
      id: "ruinas-bellgrave",
      title: "Las ruinas de la casa Bellgrave",
      musicId: "dron-abisal",
      ambienceId: "viento-nocturno",
      sfxIds: [
        "puerta-chirrido",
        "crujido-metal",
        "susurros",
        "destello-extrano",
        "grito-hombre",
        "perdida-estabilidad",
      ],
      cues: [
        { moment: "Abren la trampilla del sótano", soundIds: ["puerta-chirrido"] },
        {
          moment: "La mansión aparece intacta",
          soundIds: ["destello-extrano", "perdida-estabilidad"],
        },
        { moment: "Moon: «¡Los ojos rojos!»", soundIds: ["grito-hombre"] },
      ],
    },
    {
      id: "buscando-ejemplares",
      title: "Buscando los ejemplares",
      musicId: "tension-oscura",
      ambienceId: "viento-nocturno",
      sfxIds: [
        "coche-grava",
        "puerta-coche",
        "papeles",
        "destello-extrano",
        "golpe-tension",
      ],
      cues: [
        { moment: "Luces rojas en el cielo", soundIds: ["destello-extrano"] },
        { moment: "Muerte de la Srta. Danvers", soundIds: ["golpe-tension"] },
      ],
    },
    {
      id: "enfrentamiento-moon",
      title: "Enfrentándose a Francis Moon",
      musicId: "combate-horror",
      sfxIds: [
        "disparo-revolver",
        "revolver-tambor",
        "cristal-estalla",
        "grito-hombre",
        "chispazo",
        "destello-extrano",
        "perdida-estabilidad",
      ],
      cues: [
        { moment: "Moon dispara", soundIds: ["disparo-revolver"] },
        { moment: "Aparece la primera chispa roja", soundIds: ["destello-extrano"] },
        {
          moment: "Moon arde: «¡Otra vez no!»",
          soundIds: ["grito-hombre", "chispazo"],
        },
      ],
    },
    {
      id: "muerte-de-holland",
      title: "La muerte de Holland",
      musicId: "horror-ascendente",
      sfxIds: [
        "disparo-revolver",
        "pasos-baldosa",
        "portazo",
        "cristal-estalla",
        "chispazo",
        "grito-hombre",
      ],
      cues: [
        { moment: "Moon dispara a Wallis", soundIds: ["disparo-revolver"] },
        {
          moment: "Los fuegos funden las cristaleras",
          soundIds: ["cristal-estalla", "destello-extrano"],
        },
        { moment: "«¡Maldito seas, Bellgrave!»", soundIds: ["grito-hombre"] },
      ],
    },
    {
      id: "haciendo-desaparecer-a-bellgrave",
      title: "Haciendo desaparecer a Bellgrave",
      musicId: "horror-ascendente",
      ambienceId: "viento-nocturno",
      sfxIds: [
        "susurros",
        "latido",
        "destello-extrano",
        "chispazo",
        "perdida-estabilidad",
      ],
      cues: [
        {
          moment: "Las luces se acercan",
          soundIds: ["destello-extrano", "latido"],
        },
        { moment: "Bellgrave ríe en sus mentes", soundIds: ["susurros"] },
      ],
    },
    {
      id: "resolucion",
      title: "Resolución",
      musicId: "calma-tras-horror",
      ambienceId: "lluvia",
      sfxIds: ["sirena-lejana", "pasos-mojados"],
      cues: [],
    },
  ],
};
