"use client";

import { AdmitCardsPage } from "@/components/admit-card/admit-cards-page";

/** Super admin: generate admit cards for every institution, then download. */
export default function AdmitCardsRoute() {
  return <AdmitCardsPage mode="super" />;
}
