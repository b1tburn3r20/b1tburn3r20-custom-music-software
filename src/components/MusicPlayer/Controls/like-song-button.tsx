"use client";

import { addLikedSong, removeLikedSong } from "@/components/helpers/utilities";
import { useMusicStore } from "@/stores/useMusicStore";
import type { Song } from "@/types/DirectoryTypes";
import { Heart, HeartCrack } from "lucide-react";
import { useState } from "react";

interface LikeSongButtonProps {
  song: Song;
}
const LikeSongButton = ({ song }: LikeSongButtonProps) => {
  const likedSongs = useMusicStore((f) => f.likedSongs);
  const [hovered, setHovered] = useState(false);
  const handleLikeSong = () => {
    if (songLiked) {
      console.log("removing");
      removeLikedSong(song);
    } else {
      addLikedSong(song);
    }
  };
  const songLiked = likedSongs?.flatMap((s) => s?.path).includes(song?.path);
  if (!song) return null;
  return (
    <button
      onMouseOver={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => handleLikeSong()}
      className={`rounded-full flex justify-center items-center p-4 cursor-pointer hover:bg-secondary hover:text-red-500 transition-all duration-300 ${songLiked ? "text-red-500 hover:text-gray-500" : "hover:text-primary!"}`}
    >
      {hovered && songLiked ? <HeartCrack /> : <Heart />}
    </button>
  );
};

export default LikeSongButton;
