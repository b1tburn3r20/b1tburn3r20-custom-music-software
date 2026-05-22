import { useAppStore } from "@/stores/useAppStore";
import ActiveArtist from "./artist/components/artist";

const ArtistView = () => {
  const view = useAppStore((f) => f.view);
  if (view !== "artist") {
    return null;
  }

  return (
    <div>
      {" "}
      <ActiveArtist />{" "}
    </div>
  );
};

export default ArtistView;
