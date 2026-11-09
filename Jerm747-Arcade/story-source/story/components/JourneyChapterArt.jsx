const SCENES = {
  studio: { file: "studio", alt: "Earbud Jerm delivers an award-nomination envelope to OG Jerm in the recording studio." },
  letter: { file: "studio", alt: "OG Jerm opens his nomination letter in the studio." },
  limo: { file: "limo", alt: "A large bodyguard opens a black limousine door while OG Jerm faces a slender, shadowed suited figure seated inside." },
  airport: { file: "airport", alt: "OG Jerm and his suitcase at the airport, ready to depart for Japan." },
  flight: { file: "flight", alt: "OG Jerm wearing blue headphones aboard the flight to Japan at sunrise." },
};
export default function JourneyChapterArt({ scene }) {
  const art = SCENES[scene] || SCENES.studio;
  return <img className="journey-chapter-art" src={`/images/groove-squad/chapter8/${art.file}.png.webp`} alt={art.alt} draggable="false" />;
}
