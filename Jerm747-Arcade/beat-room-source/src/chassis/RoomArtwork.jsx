import portrait from '../assets/splash-boombox.jpg';
import landscape from '../assets/splash-boombox-wide.jpg';

export default function RoomArtwork({ onLoad, onError }) {
  return (
    <picture className="room-artwork">
      <source media="(orientation: landscape)" srcSet={landscape} />
      <img src={portrait} alt="Jerm747 Beat Room. Find your frequency. A boombox and vinyl record in amber and teal."
        draggable="false" fetchPriority="high" decoding="async" onLoad={onLoad} onError={onError} />
    </picture>
  );
}
