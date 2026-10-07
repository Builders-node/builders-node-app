import type { GalleryItem } from "@/components/GallerySection";
import gym from "@/assets/gallery-3.jpg";
import coworking from "@/assets/gallery-4.jpg";
import talks from "@/assets/gallery-9.webp";
import tennis from "@/assets/adv-tennis.webp";
import pool from "@/assets/life/pool.webp";
import beachClub from "@/assets/life/beach-club.webp";
import communityDinner from "@/assets/life/community-dinner.webp";
import diving from "@/assets/life/diving.webp";
import weekendTrip from "@/assets/life/weekend-trip.webp";

/**
 * The main landing's "Life at Builders Node": the nine moments from the
 * mock-up, each with the closest photo we have.
 *
 * Nine around the oval rather than eight — three across the top, one each
 * side, four along the bottom (narrower, so they fit).
 */
export const MAIN_GALLERY_ITEMS: GalleryItem[] = [
  { src: pool, label: "The pool on the 8th floor — best at sunset", top: "4%", left: "13%", w: "290px", h: "220px", rotate: "-3deg" },
  { src: gym, label: "Gym, downstairs", top: "1%", left: "calc(50% - 130px)", w: "260px", h: "200px", rotate: "1.5deg" },
  { src: coworking, label: "Coworking with an ocean view", top: "4%", right: "13%", w: "275px", h: "210px", rotate: "2.5deg" },
  { src: beachClub, label: "Beach club, when the laptop closes", top: "34%", left: "2%", w: "285px", h: "240px", rotate: "-2deg" },
  { src: communityDinner, label: "Community dinners, long table", top: "32%", right: "2%", w: "280px", h: "245px", rotate: "2deg" },
  { src: tennis, label: "Pickleball and tennis", bottom: "4%", left: "4%", w: "235px", h: "190px", rotate: "2deg" },
  { src: diving, label: "Diving the reef", bottom: "1%", left: "27%", w: "235px", h: "190px", rotate: "-2deg" },
  { src: talks, label: "Workshops and founder talks", bottom: "1%", right: "27%", w: "235px", h: "190px", rotate: "1.5deg" },
  { src: weekendTrip, label: "Weekend trips around the island", bottom: "4%", right: "4%", w: "235px", h: "190px", rotate: "-1.5deg" },
];
