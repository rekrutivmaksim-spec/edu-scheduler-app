/**
 * Базовые цветовые палитры для 4 сезонов (обычные и яркие варианты)
 * Каждый сезон содержит 3 палитры
 */

export interface ColorPalette {
  [key: string]: string;
}

export interface SeasonPalettes {
  palette1: ColorPalette;
  palette2: ColorPalette;
  palette3: ColorPalette;
}

export interface SeasonalPalettesData {
  summer: SeasonPalettes;
  summerBright: SeasonPalettes;
  autumn: SeasonPalettes;
  autumnBright: SeasonPalettes;
  winter: SeasonPalettes;
  winterBright: SeasonPalettes;
  spring: SeasonPalettes;
  springBright: SeasonPalettes;
  summerSoft: SeasonPalettes;
  autumnVivid: SeasonPalettes;
  winterVivid: SeasonPalettes;
  springGentle: SeasonPalettes;
}

export const seasonalPalettes: SeasonalPalettesData = {
  // ========== ЛЕТО (обычное) ==========
  summer: {
    palette1: {
      "dark-raspberry": "#922455ff",
      "old-rose": "#cb93abff",
      rosewood: "#ad4d72ff",
      thistle: "#d2b4beff",
      "blush-rose": "#be6682ff",
      "cherry-rose": "#af1845ff",
      "dust-grey": "#d8cfd1ff",
      carmine: "#af283fff",
      "ruby-red": "#a11d2bff",
      burgundy: "#6c171fff",
    },
    palette2: {
      "deep-crimson": "#971c20ff",
      "clay-soil": "#763e36ff",
      "smoky-rose": "#865e58ff",
      silver: "#cfc5c3ff",
      bone: "#d0c8bbff",
      "tropical-teal": "#6f9f9fff",
      teal: "#0a7d88ff",
      "pacific-cyan": "#2e909dff",
      "powder-blue": "#b0bfcbff",
      "powder-blue-2": "#98adc2ff",
    },
    palette3: {
      "dusk-blue": "#2a4972ff",
      "wisteria-blue": "#869dc5ff",
      "slate-indigo": "#5065a4ff",
      "space-indigo-2": "#242c4bff",
      "space-indigo": "#2a3150ff",
      "lavender-grey": "#999fbbff",
      "pale-slate": "#b3b2c2ff",
      "amethyst-smoke": "#a287b0ff",
      "crimson-violet": "#591b44ff",
      "petal-pink": "#c185abff",
    },
  },

  // ========== ЛЕТО (яркое) ==========
  summerBright: {
    palette1: {
      "dark-raspberry": "#a01855ff",
      "sweet-peony": "#de82aaff",
      "hot-berry": "#c8326cff",
      "pink-mist": "#e1a2b7ff",
      "rose-punch": "#d44e79ff",
      "cherry-rose": "#b71042ff",
      "pastel-petal": "#e6c2c9ff",
      carmine: "#bc1a35ff",
      "ruby-red": "#aa1322ff",
      "dark-wine": "#760f19ff",
    },
    palette2: {
      "deep-crimson": "#a11217ff",
      chestnut: "#8a3124ff",
      "reddish-brown": "#a7483aff",
      "almond-silk": "#e0bab3ff",
      "pale-oak": "#e0cba9ff",
      "strong-cyan": "#4ec1c1ff",
      teal: "#07828dff",
      "pacific-blue": "#1e9daeff",
      "powder-blue": "#9cc0ddff",
      "cool-horizon": "#83add8ff",
    },
    palette3: {
      "steel-azure": "#1c4882ff",
      "wisteria-blue": "#7298d9ff",
      "royal-azure": "#3557c0ff",
      "space-indigo": "#182558ff",
      "twilight-indigo": "#1b285fff",
      "wisteria-blue-2": "#8291d3ff",
      "soft-periwinkle": "#a19dd8ff",
      "lavender-purple": "#ac6bccff",
      "crimson-violet": "#631248ff",
      "petal-pink": "#d76fb1ff",
    },
  },

  // ========== ОСЕНЬ (обычная) ==========
  autumn: {
    palette1: {
      "tomato-jam": "#d33032ff",
      "brown-red-3": "#993233ff",
      espresso: "#5b2626ff",
      "flag-red": "#c32e2eff",
      "brown-red": "#a02c26ff",
      "brown-red-2": "#a02e26ff",
      "blushed-brick": "#bc5a53ff",
      "bitter-chocolate": "#6e362cff",
      "rosy-copper-2": "#d1563aff",
      "rosy-copper": "#d06244ff",
    },
    palette2: {
      "dust-grey": "#d2c9c4ff",
      "pale-oak": "#c8b8acff",
      "coffee-bean": "#794f2fff",
      camel: "#b49276ff",
      "coffee-bean-2": "#644a32ff",
      "amber-earth": "#da892dff",
      tan: "#cba77dff",
      "harvest-gold": "#cd8c24ff",
      "olive-wood": "#887746ff",
      "old-gold": "#d2b54fff",
    },
    palette3: {
      "lime-moss": "#a7b250ff",
      "dusty-olive": "#6f8d5cff",
      "ash-grey": "#a8b5a0ff",
      "dark-spruce": "#2a533bff",
      verdigris: "#1b9587ff",
      "baltic-blue": "#245877ff",
      "yale-blue": "#264063ff",
      "french-blue": "#384b89ff",
      "velvet-purple": "#573467ff",
      "rosy-granite": "#83777dff",
    },
  },
  // ========== ОСЕНЬ (яркая) ==========
  autumnBright: {
    palette1: {
      "dark-wine": "#761d1eff",
      "mahogany-red": "#be191dff",
      "mahogany-red-2": "#a71b1aff",
      "rich-mahogany": "#2e1010ff",
      "dark-wine-2": "#7c1913ff",
      "dark-wine-3": "#7b1a13ff",
      "brick-red": "#af4037ff",
      espresso: "#461e16ff",
      "rusty-spice": "#c13d1eff",
      "red-ochre": "#c94722ff",
    },
    palette2: {
      silver: "#ccbfb9ff",
      "deep-walnut": "#53331aff",
      "faded-copper": "#ad7e57ff",
      "khaki-beige": "#c2ad9bff",
      "dark-coffee": "#3b2a1aff",
      ochre: "#c67313ff",
      camel: "#ca985dff",
      copperwood: "#b07311ff",
      "olive-bark": "#695a2fff",
      "metallic-gold": "#d5af25ff",
    },
    palette3: {
      "palm-leaf": "#909c3aff",
      "muted-teal": "#99a98eff",
      fern: "#577345ff",
      evergreen: "#11281bff",
      "blue-spruce": "#0b685dff",
      "deep-space-blue": "#11364bff",
      "prussian-blue": "#112035ff",
      "twilight-indigo": "#223367ff",
      "midnight-violet": "#341c3eff",
      "taupe-grey": "#6c5f66ff",
    },
  },

  // ========== ЗИМА (обычная) ==========
  winter: {
    palette1: {
      "cherry-rose": "#9d1544ff",
      "rose-wine": "#ce3b6fff",
      "berry-lipstick": "#c33664ff",
      "ruby-red": "#ab1a32ff",
      "intense-cherry": "#cd1b35ff",
      burgundy: "#771826ff",
      "sweet-peony": "#c67999ff",
      "pale-slate-3": "#cec3cbff",
      "dust-grey": "#d1c8c6ff",
      "dust-grey-2": "#cfcbc2ff",
    },
    palette2: {
      "soft-fawn": "#d3bf90ff",
      "dark-emerald": "#0b6647ff",
      "blue-spruce": "#076f66ff",
      "silver-2": "#c0cac9ff",
      "dark-slate-grey": "#1d3b3bff",
      silver: "#c3ccceff",
      "twitter-blue": "#0074b9ff",
      "baltic-blue": "#035ca5ff",
      "ink-black": "#09121bff",
      "steel-azure": "#0f4791ff",
    },
    palette3: {
      "pale-slate-2": "#bac2cfff",
      "french-blue": "#1f3e84ff",
      "lavender-grey": "#7d8298ff",
      "pale-slate": "#cacbcfff",
      "prussian-blue": "#15162aff",
      graphite: "#363441ff",
      "alabaster-grey": "#dedde3ff",
      "midnight-violet-2": "#241937ff",
      "pale-slate-4": "#c3bbcaff",
      "midnight-violet": "#211120ff",
    },
  },

  // ========== ЗИМА (яркая) ==========
  winterBright: {
    palette1: {
      "sweet-peony": "#da6797ff",
      "cherry-rose": "#a50e43ff",
      razzmatazz: "#df2a69ff",
      "raspberry-red": "#d7235fff",
      carmine: "#b6112cff",
      "flag-red": "#d4112eff",
      burgundy: "#7f1020ff",
      "almond-silk": "#e1beb7ff",
      "soft-fawn": "#e3c682ff",
      "pearl-beige": "#e0d3b3ff",
    },
    palette2: {
      "dark-emerald": "#076948ff",
      "blue-spruce": "#057168ff",
      "pearl-aqua": "#acdcd8ff",
      "dark-teal": "#134444ff",
      "light-blue": "#b3d8e0ff",
      "bright-teal-blue": "#0074b8ff",
      "baltic-blue": "#025ca6ff",
      "ink-black": "#06121eff",
      "steel-azure": "#0a4694ff",
      "powder-blue": "#a9bee0ff",
    },
    palette3: {
      "french-blue": "#14398fff",
      periwinkle: "#b8c0e0ff",
      "slate-indigo": "#576abcff",
      "prussian-blue": "#0d0f30ff",
      "space-indigo": "#292253ff",
      lavender: "#d8d4edff",
      "dark-amethyst": "#221041ff",
      wisteria: "#c4a8dcff",
      "midnight-violet": "#280b26ff",
      "pink-orchid": "#e0b3d4ff",
    },
  },

  // ========== ВЕСНА (обычная) ==========
  spring: {
    palette1: {
      "magenta-bloom": "#d25167ff",
      "lobster-pink": "#ca5f6fff",
      "lobster-pink-2": "#d06863ff",
      "flag-red": "#c6191fff",
      "brick-ember": "#c21a1aff",
      "light-coral": "#d57c76ff",
      "cotton-rose": "#d6b8b8ff",
      "powder-blush": "#e1b1a7ff",
      "tangerine-dream": "#e29875ff",
      "desert-sand": "#e3b6a0ff",
    },
    palette2: {
      silver: "#bcb3adff",
      "powder-petal": "#e0d2cbff",
      bone: "#e0d5c9ff",
      "chocolate-brown": "#9a5327ff",
      copper: "#b87c46ff",
      tan: "#d6b788ff",
      "apricot-cream": "#e5ca93ff",
      wheat: "#e5cda5ff",
      "straw-gold": "#e4c468ff",
      "dry-sage": "#c4ca96ff",
    },
    palette3: {
      "muted-teal": "#86b08aff",
      "sea-green": "#428e4dff",
      "blue-spruce": "#178070ff",
      "pacific-blue-2": "#41afc7ff",
      "pacific-blue": "#69a6bbff",
      "baltic-blue": "#09589bff",
      glaucous: "#6677a3ff",
      "twilight-indigo": "#1b305bff",
      "french-blue": "#3c467aff",
      "vintage-lavender": "#775f92ff",
    },
  },

  // ========== ВЕСНА (яркая) ==========
  springBright: {
    palette1: {
      amaranth: "#e2415cff",
      "amaranth-2": "#dc4c61ff",
      "flag-red": "#d01016ff",
      "brick-ember": "#ca1111ff",
      "lobster-pink": "#e15951ff",
      "vibrant-coral": "#e47068ff",
      "powder-blush": "#ecaa9dff",
      "powder-blush-2": "#e4a9a9ff",
      "tangerine-dream": "#ec936aff",
      "peach-fuzz": "#edb397ff",
    },
    palette2: {
      "desert-sand": "#d4af96ff",
      "almond-silk": "#ebcfc1ff",
      "almond-cream": "#ead4bdff",
      "rusty-spice": "#a95019ff",
      ochre: "#d17a2eff",
      "soft-fawn": "#e5bb7bff",
      "apricot-cream": "#eecd8bff",
      "apricot-cream-2": "#eecf9bff",
      "royal-gold": "#eeca5eff",
      "pale-amber": "#d2dd83ff",
    },
    palette3: {
      emerald: "#6bcc75ff",
      "medium-jungle": "#2ba63dff",
      "jungle-teal": "#0f8a78ff",
      "sky-surge-2": "#2fbbdaff",
      "sky-surge": "#50b2d3ff",
      "baltic-blue": "#06579dff",
      "smart-blue": "#4669c3ff",
      "twilight-indigo": "#122d64ff",
      "egyptian-blue": "#273990ff",
      "indigo-bloom": "#743eb2ff",
    },
  },

  // ========== ЛЕТО (мягкое / светлое) ==========
  summerSoft: {
    palette1: {
      "hot-berry": "#d8317cff",
      "magenta-bloom": "#e92c65ff",
      "sweet-peony": "#ce6d92ff",
      "old-rose": "#d8829dff",
      amaranth: "#de425cff",
      "scarlet-rush": "#e22b3dff",
      "intense-cherry": "#c22131ff",
      "primary-scarlet": "#e0252cff",
      "pastel-petal": "#e3bfccff",
      "pink-orchid": "#e0a7c0ff",
    },
    palette2: {
      "rosy-copper": "#bf5343ff",
      "dusty-rose": "#bc776cff",
      "soft-blush": "#e8d5d9ff",
      "almond-silk": "#e2cfcbff",
      bone: "#e2d7c4ff",
      "pearl-aqua": "#85c5c5ff",
      "strong-cyan": "#0dd0e1ff",
      "strong-cyan-2": "#43c5d6ff",
      "pale-sky": "#bbcfe0ff",
      "powder-blue": "#a9c2dbff",
    },
    palette3: {
      "powder-blue-2": "#9cb3dcff",
      "sapphire-sky": "#3572c1ff",
      glaucous: "#6d84caff",
      "ocean-twilight": "#3c4e9fff",
      "french-blue": "#374b9dff",
      periwinkle: "#a9b1d7ff",
      "periwinkle-2": "#bdbcdbff",
      wisteria: "#be99d0ff",
      lilac: "#da9ac3ff",
      "raspberry-plum": "#af2982ff",
    },
  },

  // ========== ОСЕНЬ (тёмная / насыщенная) ==========
  autumnVivid: {
    palette1: {
      "rich-mahogany": "#280c0cff",
      "deep-crimson": "#921313ff",
      "mahogany-red": "#a41215ff",
      "black-cherry": "#681517ff",
      "dark-garnet": "#6b130eff",
      "dark-garnet-2": "#6b140eff",
      "brown-red": "#9b3028ff",
      "rich-mahogany-2": "#3e1810ff",
      "oxidized-iron": "#a93116ff",
      "rusty-spice": "#ae3919ff",
    },
    palette2: {
      "rosy-taupe": "#be9b8bff",
      "deep-walnut": "#482a13ff",
      "dark-coffee": "#372513ff",
      "toffee-brown": "#9f6a3eff",
      camel: "#b9906eff",
      copperwood: "#ac620eff",
      "olive-bark": "#605022ff",
      "golden-earth": "#98630cff",
      bronze: "#c78335ff",
      "golden-bronze": "#b9971cff",
    },
    palette3: {
      olive: "#818c2aff",
      "sage-green": "#7ea563ff",
      fern: "#476a32ff",
      evergreen: "#0c2416ff",
      "pine-teal": "#075c52ff",
      "deep-space-blue": "#0c2e42ff",
      "prussian-blue": "#0d1b30ff",
      "twilight-indigo": "#192a5cff",
      "midnight-violet": "#2f143aff",
      "mauve-shadow": "#694457ff",
    },
  },

  // ========== ЗИМА (тёмная / насыщенная) ==========
  winterVivid: {
    palette1: {
      "rose-punch": "#c34f7fff",
      rosewood: "#bb265aff",
      "cherry-rose": "#ad2754ff",
      "dark-amaranth": "#890f3aff",
      "ruby-red": "#961329ff",
      "ruby-red-2": "#b1132aff",
      "night-bordeaux": "#68121fff",
      "rosy-taupe": "#c1a09aff",
      "soft-fawn": "#cdad62ff",
      "khaki-beige": "#c0b496ff",
    },
    palette2: {
      "emerald-depths": "#08583dff",
      "stormy-teal": "#055f57ff",
      "muted-teal": "#93bbb6ff",
      "cool-steel": "#98b7beff",
      "dark-teal": "#153535ff",
      "baltic-blue": "#00639cff",
      "steel-azure": "#034e8cff",
      "ink-black": "#070f18ff",
      "regal-navy-2": "#0b3c7cff",
      "wisteria-blue": "#8ca0c1ff",
    },
    palette3: {
      "regal-navy": "#163275ff",
      "dusty-grape": "#586392ff",
      "lavender-grey": "#9da4beff",
      "prussian-blue": "#0f1025ff",
      "midnight-violet-2": "#1e1333ff",
      "midnight-violet": "#2a253eff",
      thistle: "#b5afcfff",
      "amethyst-smoke": "#a78ebbff",
      lilac: "#be98b4ff",
      "midnight-violet-3": "#1f0d1eff",
    },
  },

  // ========== ВЕСНА (нежная) ==========
  springGentle: {
    palette1: {
      "bubblegum-pink": "#e26d80ff",
      "petal-rouge": "#dd7685ff",
      "strawberry-red": "#ea2f35ff",
      "racing-red": "#e92d2dff",
      "light-coral": "#e17f7aff",
      "light-coral-2": "#e4918bff",
      "cotton-rose": "#ecbeb4ff",
      "cotton-rose-2": "#e5c0c0ff",
      "tangerine-dream": "#ecaa8bff",
      "desert-sand": "#edc4afff",
    },
    palette2: {
      "powder-petal": "#ecdad1ff",
      "pale-oak": "#d4c1b3ff",
      "almond-cream": "#ebdcceff",
      chocolate: "#d76c2bff",
      "toasted-almond": "#d29560ff",
      "apricot-cream": "#e5c79aff",
      wheat: "#eed6a6ff",
      "wheat-2": "#eed8b2ff",
      jasmine: "#eed381ff",
      "vanilla-custard": "#d7dda2ff",
    },
    palette3: {
      celadon: "#92cd98ff",
      "moss-green": "#4cc25dff",
      "ocean-mist": "#1bc5acff",
      "sky-blue-light-2": "#5fc4dbff",
      "sky-blue-light": "#7bbed4ff",
      "azure-blue": "#0a7bdeff",
      glaucous: "#768cc4ff",
      "steel-azure": "#244ba0ff",
      "ocean-twilight": "#4155b8ff",
      "lavender-purple": "#906bbbff",
    },
  },
};