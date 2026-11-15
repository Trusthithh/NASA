export interface Hotspot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  dataset: string; // recommended variable (a dataset id from the backend)
  story: string;
}

export const HOTSPOTS: Hotspot[] = [
  {
    id: "arctic",
    name: "Arctic (Svalbard)",
    lat: 78.2,
    lon: 15.6,
    dataset: "skin_temperature",
    story:
      "The Arctic has warmed faster than the global average, a pattern called Arctic " +
      "amplification. Surface temperature here is a good place to look for it.",
  },
  {
    id: "siberia",
    name: "Siberia (Yakutsk)",
    lat: 62.0,
    lon: 129.7,
    dataset: "dew_point",
    story:
      "A permafrost region with one of the largest seasonal temperature swings on Earth. " +
      "Dew point shows how the near-surface moisture content is changing.",
  },
  {
    id: "amazon",
    name: "Amazon (Manaus)",
    lat: -3.1,
    lon: -60.0,
    dataset: "soil_moisture",
    story:
      "The Amazon recycles much of its own rainfall. Check root-zone soil wetness and " +
      "precipitation for signs of drying, and aerosols for smoke from fires.",
  },
  {
    id: "sahel",
    name: "Sahel (Niamey)",
    lat: 13.5,
    lon: 2.1,
    dataset: "precipitation",
    story:
      "A semi-arid belt south of the Sahara where rainfall fell sharply from the late 1960s " +
      "and later partly recovered. This record starts in 1981, so it covers the recovery period.",
  },
  {
    id: "himalaya",
    name: "Himalaya",
    lat: 28.5,
    lon: 85.0,
    dataset: "snow_fraction",
    story:
      "Often called the Third Pole for its large stores of ice and snow. Snow cover " +
      "fraction shows how much of the surface is snow-covered through the year.",
  },
  {
    id: "bodele",
    name: "Bodele Depression (Chad)",
    lat: 17.0,
    lon: 18.5,
    dataset: "aerosol",
    story:
      "One of the world's largest sources of airborne dust. Aerosol optical depth here " +
      "varies with wind and rainfall.",
  },
  {
    id: "delhi",
    name: "Indo-Gangetic Plain (Delhi)",
    lat: 28.6,
    lon: 77.2,
    dataset: "aerosol",
    story:
      "One of the most aerosol-laden regions on Earth, with dust, smoke and industrial " +
      "emissions all contributing to the haze.",
  },
  {
    id: "mediterranean",
    name: "Mediterranean (Athens)",
    lat: 37.98,
    lon: 23.73,
    dataset: "precipitation",
    story:
      "The Mediterranean basin is often described as a climate-change hotspot, with " +
      "warming and a tendency toward drier conditions. Test what the precipitation record shows.",
  },
  {
    id: "atacama",
    name: "Atacama Desert",
    lat: -23.9,
    lon: -69.2,
    dataset: "clear_sky_solar",
    story:
      "One of the driest and sunniest places on Earth, used to study solar energy " +
      "potential. Clear-sky irradiance excludes cloud effects.",
  },
];
